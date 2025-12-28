import { supabase } from '../utils/supabaseClient'
import type { JobDTO, ResumeDTO, MetaData } from '../types/supabase'
import type { User } from '@supabase/supabase-js'

// Helper to transform Job DB response to Frontend DTO
export const transformJob = (job: any): JobDTO => {
  return {
    id: job.id,
    title: job.title,
    city: job.cities?.name || 'Unknown',
    min_years: job.min_years,
    level: job.career_levels?.name || 'Unknown',
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    degree: job.degrees?.name || 'Unknown',
    degree_required: job.degrees?.name || 'Unknown',
    industry: job.industries?.name || 'Unknown',
    required_skills: job.job_skills?.filter((js: any) => js.is_required).map((js: any) => js.skills?.name).filter(Boolean) || [],
    nice_to_have_skills: job.job_skills?.filter((js: any) => !js.is_required).map((js: any) => js.skills?.name).filter(Boolean) || [],
    description: job.description || '职位描述暂未从数据库读取...' 
  }
}

// Helper to transform Resume DB response to Frontend DTO
export const transformResume = (resume: any): ResumeDTO => {
  return {
    id: resume.id,
    name: resume.candidate_name,
    candidate_name: resume.candidate_name,
    gender: resume.gender,
    city: resume.cities?.name || 'Unknown',
    expected_city: resume.cities?.name || 'Unknown',
    years: resume.years_of_experience,
    years_of_experience: resume.years_of_experience,
    level: resume.career_levels?.name || 'Unknown',
    current_level: resume.career_levels?.name || 'Unknown',
    salary_min: resume.expected_salary_min,
    salary_max: resume.expected_salary_max,
    skills: resume.resume_skills?.map((rs: any) => rs.skills?.name).filter(Boolean) || [],
    degree: resume.educations?.[0]?.degrees?.name || 'Unknown',
    avatar_url: resume.avatar_url || null,
    educations: resume.educations?.map((edu: any) => ({
      ...edu,
      degree: edu.degrees,
      major_industry: edu.industries // Assuming join alias or direct mapping
    })) || [],
    experiences: resume.experiences?.map((exp: any) => ({
      ...exp,
      industry: exp.industries
    })) || []
  }
}

export const supabaseService = {
  // --- AUTH ---
  async loginOrRegister(username: string, password: string): Promise<{ user: User | null, error: any }> {
    // Force username flow: append dummy domain to satisfy Supabase Auth requirements
    // We trim whitespace and convert to lowercase to ensure uniqueness consistency
    const cleanUsername = username.trim()
    const email = `${cleanUsername}@resumematcher.local` 
    
    // 1. Try Login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (!loginError && loginData.user) {
      return { user: loginData.user, error: null }
    }

    // 2. If login failed, try Register (Auto-registration)
    // We assume the error might be "Invalid login credentials" which covers both "User not found" and "Wrong password"
    if (loginError) {
       const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
         email,
         password,
         options: {
           data: {
             username: cleanUsername,
             role: 'user' // Default role
           }
         }
       })
       
       if (signUpError) {
          // If signup fails because user already exists, it means the initial login failed due to wrong password
          if (signUpError.message.includes('already registered')) {
             return { user: null, error: new Error('用户名已存在或密码错误') }
          }
          return { user: null, error: signUpError }
       }
       
       return { user: signUpData.user, error: null }
    }

    return { user: null, error: loginError }
  },

  async signOut() {
    return await supabase.auth.signOut()
  },

  async getUser() {
    return await supabase.auth.getUser()
  },

  // Get User Profile (Role)
  async getUserProfile(userId: string): Promise<{ data: any, error: any }> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  // --- META (Admin) ---
  // Get Meta Data for filters
  async getMeta(): Promise<{ data: any, error: any }> {
    try {
      const [cities, levels, skills, industries, degrees] = await Promise.all([
        supabase.from('cities').select('id, name'),
        supabase.from('career_levels').select('id, name, label, level'),
        supabase.from('skills').select('id, name'),
        supabase.from('industries').select('id, name'),
        supabase.from('degrees').select('id, name, level')
      ])

      return {
        data: {
          cities: cities.data || [],
          levels: levels.data || [],
          skills: skills.data || [],
          industries: industries.data || [],
          degrees: degrees.data || []
        },
        error: null
      }
    } catch (error) {
      console.error('Error fetching meta:', error)
      return { data: null, error }
    }
  },

  // --- JOBS ---
  // Get Jobs List
  async getJobs(params: any = {}): Promise<{ data: { items: JobDTO[], total: number }, error: any }> {
    // Re-constructing query to support optional !inner joins for filtering
    let selectStr = `
        *,
        cities(name),
        career_levels(name),
        degrees(name),
        industries(name),
        job_skills!left(
          is_required,
          skills(name)
        )
    `
    
    // Dynamic Join Type for Filtering
    if (params.skill) {
        selectStr = selectStr.replace('job_skills!left', 'job_skills!inner')
    }
    
    let query = supabase.from('jobs').select(selectStr, { count: 'exact' })

    // Apply filters
    if (params.city) query = query.not('cities', 'is', null).filter('cities.name', 'eq', params.city)
    if (params.level) query = query.not('career_levels', 'is', null).filter('career_levels.name', 'eq', params.level)
    if (params.industry) query = query.not('industries', 'is', null).filter('industries.name', 'eq', params.industry)
    if (params.degree) query = query.not('degrees', 'is', null).filter('degrees.name', 'eq', params.degree)
    
    if (params.min_years !== undefined) {
        // Filter jobs that require at least X years?
        // Or jobs that require exactly X? 
        // Usually filters are "Jobs requiring <= X years" (for candidates) or "Jobs requiring >= X" (for finding senior roles).
        // Let's assume >= for "Minimum Years Requirement" filter.
        query = query.gte('min_years', params.min_years)
    }
    
    if (params.skill) {
        // Filter jobs that require this skill
        // job_skills.skills.name
        query = query.filter('job_skills.skills.name', 'eq', params.skill)
    }
    
    // Pagination
    let from = 0
    let to = 19
    if (params.skip !== undefined && params.limit !== undefined) {
        from = params.skip
        to = from + params.limit - 1
    } else if (params.page && params.pageSize) {
        from = (params.page - 1) * params.pageSize
        to = from + params.pageSize - 1
    }
    
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      return { data: { items: [], total: 0 }, error }
    }

    return {
      data: {
        items: data.map(transformJob),
        total: count || 0
      },
      error: null
    }
  },

  // Get Job Detail
  async getJobDetail(id: number): Promise<{ data: JobDTO | null, error: any }> {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        cities(name),
        career_levels(name),
        degrees(name),
        industries(name),
        job_skills(
          is_required,
          skills(name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error }
    return { data: transformJob(data), error: null }
  },

  // Admin: Create Job
  async createJob(jobData: any): Promise<{ data: any, error: any }> {
      const { skill_ids, ...jobFields } = jobData
      
      const { data, error } = await supabase
        .from('jobs')
        .insert([jobFields])
        .select()
        .single()
        
      if (error) return { data: null, error }
      
      if (skill_ids && skill_ids.length > 0) {
          const skills = skill_ids.map((sid: number) => ({
              job_id: data.id,
              skill_id: sid,
              is_required: true
          }))
          await supabase.from('job_skills').insert(skills)
      }
      
      return { data, error: null }
  },

  // Admin: Update Job
  async updateJob(id: number, jobData: any): Promise<{ data: any, error: any }> {
      const { skill_ids, ...jobFields } = jobData
      
      const { data, error } = await supabase
        .from('jobs')
        .update(jobFields)
        .eq('id', id)
        .select()
        .single()
        
      if (error) return { data: null, error }
      
      if (skill_ids) {
          await supabase.from('job_skills').delete().eq('job_id', id)
          if (skill_ids.length > 0) {
              const skills = skill_ids.map((sid: number) => ({
                  job_id: id,
                  skill_id: sid,
                  is_required: true
              }))
              await supabase.from('job_skills').insert(skills)
          }
      }
      
      return { data, error: null }
  },

  // Admin: Delete Job
  async deleteJob(id: number): Promise<{ data: any, error: any }> {
      const { data, error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .select()
      return { data, error }
  },

  // --- RESUMES ---
  // Get Resumes List
  async getResumes(params: any = {}): Promise<{ data: { items: ResumeDTO[], total: number }, error: any }> {
    let query = supabase
      .from('resumes')
      .select(`
        *,
        cities(name),
        career_levels(name),
        resume_skills(skills(name)),
        educations(degrees(name)),
        experiences(industries(name))
      `, { count: 'exact' })

    // Basic Filters
    if (params.city) query = query.not('cities', 'is', null).filter('cities.name', 'eq', params.city)
    if (params.level) query = query.not('career_levels', 'is', null).filter('career_levels.name', 'eq', params.level)
    if (params.min_years !== undefined) query = query.gte('years_of_experience', params.min_years)

    // Complex Filters (Related Tables)
    // Note: To filter by related table, we need !inner join behavior.
    // However, Supabase JS client syntax for !inner is done in the select string usually, 
    // or by applying filter on the related table path.
    // If we use simple filter(), it filters the main table based on the related table condition if correctly structured.
    // But standard PostgREST way for "filter parents where child exists with condition" is often doing !inner in select.
    
    // For simplicity in this codebase, we will use the !inner syntax in select if filter is present.
    // But since we construct query dynamically, it's tricky to change select string.
    // A common workaround is to use separate queries or modifiers.
    
    // Actually, we can use the modifier syntax on the join:
    // .select('..., resume_skills!inner(skills!inner(name))')
    // But since we want optional filtering, we might need to branch logic or assume broad selection.
    
    // Let's try applying filters directly. If Supabase client sees a filter on a related table, 
    // it automatically does an inner join logic for that relation in terms of filtering rows.
    
    if (params.skill) {
       // Filter resumes where ANY skill matches
       // Syntax: resume_skills.skills.name.eq.params.skill
       // We need to ensure the relationship is queryable.
       // The standard way is using !inner in select, which we can't easily inject here without rebuilding select.
       // Let's rebuild select if needed or just append filters.
       
       // Alternative: Use .not('resume_skills', 'is', null) combined with filter on inner.
       // But JS client is tricky with deep filtering without !inner.
       
       // Let's try a different approach:
       // We'll modify the initial select to include !inner if specific filters are active.
       // This is cleaner.
    }
    
    // Re-constructing query to support optional !inner joins
    let selectStr = `
        *,
        cities(name),
        career_levels(name),
        resume_skills!left(skills(name)),
        educations!left(degrees(name)),
        experiences!left(industries(name))
    `
    
    // If filtering by skill, use !inner for resume_skills
    if (params.skill) {
        selectStr = selectStr.replace('resume_skills!left', 'resume_skills!inner')
    }
    // If filtering by degree, use !inner for educations
    if (params.degree) {
        selectStr = selectStr.replace('educations!left', 'educations!inner')
    }
    // If filtering by industry, use !inner for experiences
    if (params.industry) {
        selectStr = selectStr.replace('experiences!left', 'experiences!inner')
    }

    // Re-initialize query with dynamic select
    query = supabase.from('resumes').select(selectStr, { count: 'exact' })

    // Apply Filters
    if (params.city) query = query.not('cities', 'is', null).filter('cities.name', 'eq', params.city)
    if (params.level) query = query.not('career_levels', 'is', null).filter('career_levels.name', 'eq', params.level)
    if (params.min_years !== undefined) query = query.gte('years_of_experience', params.min_years)
    
    if (params.skill) {
        // We need to filter the nested resource. 
        // With !inner, we can filter on the joined table.
        // resume_skills.skills.name
        query = query.filter('resume_skills.skills.name', 'eq', params.skill)
    }
    
    if (params.degree) {
        query = query.filter('educations.degrees.name', 'eq', params.degree)
    }
    
    if (params.industry) {
        // Industry can be in experiences (usually) or educations (major_industry).
        // Let's assume experience industry for now as it's more relevant for job matching.
        query = query.filter('experiences.industries.name', 'eq', params.industry)
    }

    // Pagination
    let from = 0
    let to = 19
    if (params.skip !== undefined && params.limit !== undefined) {
        from = params.skip
        to = from + params.limit - 1
    } else if (params.page && params.pageSize) {
        from = (params.page - 1) * params.pageSize
        to = from + params.pageSize - 1
    }
    
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching resumes:', error)
      return { data: { items: [], total: 0 }, error }
    }

    return {
      data: {
        items: data.map(transformResume),
        total: count || 0
      },
      error: null
    }
  },

  // Get Resume Detail
  async getResumeDetail(id: number): Promise<{ data: ResumeDTO | null, error: any }> {
    const { data, error } = await supabase
      .from('resumes')
      .select(`
        *,
        cities(name),
        career_levels(name),
        resume_skills(skills(name)),
        educations(*, degrees(name)),
        experiences(*, industries(name))
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error }
    return { data: transformResume(data), error: null }
  },

  // User: Get My Resume
  async getMyResume(userId: string): Promise<{ data: ResumeDTO | null, error: any }> {
     const { data, error } = await supabase
       .from('resumes')
       .select(`
        *,
        cities(name),
        career_levels(name),
        resume_skills(skills(name)),
        educations(*, degrees(name)),
        experiences(*, industries(name))
       `)
       .eq('user_id', userId) 
       .single()
       
     if (error) return { data: null, error }
     return { data: transformResume(data), error: null }
  },

  // User: Update My Resume (Full Save)
  async saveMyResume(userId: string, resumeData: any): Promise<{ data: any, error: any }> {
      // 1. Upsert Resume Main Info
      const mainInfo = {
          user_id: userId,
          candidate_name: resumeData.candidate_name,
          gender: resumeData.gender,
          expected_city_id: resumeData.expected_city_id,
          years_of_experience: resumeData.years_of_experience,
          current_level_id: resumeData.current_level_id,
          expected_title: resumeData.expected_title,
          expected_salary_min: resumeData.expected_salary_min,
          expected_salary_max: resumeData.expected_salary_max,
          avatar_url: resumeData.avatar_url
      }

      // Check if exists to determine ID
      let resumeId = resumeData.id
      if (!resumeId) {
          const { data: existing } = await supabase.from('resumes').select('id').eq('user_id', userId).single()
          if (existing) resumeId = existing.id
      }

      let resultData = null

      if (resumeId) {
          const { data, error: upError } = await supabase.from('resumes').update(mainInfo).eq('id', resumeId).select().single()
          if (upError) return { data: null, error: upError }
          resultData = data
      } else {
          const { data, error: inError } = await supabase.from('resumes').insert([mainInfo]).select().single()
          if (inError) return { data: null, error: inError }
          resultData = data
          resumeId = data.id
      }

      // 2. Handle Skills (if provided)
      if (resumeData.skill_ids) {
          // Delete old
          await supabase.from('resume_skills').delete().eq('resume_id', resumeId)
          // Insert new
          if (resumeData.skill_ids.length > 0) {
              const skillsToInsert = resumeData.skill_ids.map((sid: number) => ({
                  resume_id: resumeId,
                  skill_id: sid
              }))
              await supabase.from('resume_skills').insert(skillsToInsert)
          }
      }

      // 3. Handle Educations (if provided)
      if (resumeData.educations) {
          // Delete old (simplest strategy)
          await supabase.from('educations').delete().eq('resume_id', resumeId)
          // Insert new
          if (resumeData.educations.length > 0) {
             const edus = resumeData.educations.map((e: any) => ({
                 resume_id: resumeId,
                 school: e.school,
                 major_industry_id: e.major_industry_id,
                 degree_id: e.degree_id
             }))
             await supabase.from('educations').insert(edus)
          }
      }

      // 4. Handle Experiences (if provided)
      if (resumeData.experiences) {
          await supabase.from('experiences').delete().eq('resume_id', resumeId)
          if (resumeData.experiences.length > 0) {
              const exps = resumeData.experiences.map((e: any) => ({
                  resume_id: resumeId,
                  company_name: e.company_name,
                  industry_id: e.industry_id,
                  description: e.description
              }))
              await supabase.from('experiences').insert(exps)
          }
      }

      return { data: resultData, error: null }
  },

  // User: Upload Avatar
  async uploadAvatar(userId: string, file: File): Promise<{ url: string | null, error: any }> {
      const fileName = `avatar-${Date.now()}-${file.name}`
      // 1. Upload file
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (error) return { url: null, error }
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
      
      // 2. Get the object ID from storage.objects
      // We use list() to find the file we just uploaded
      const { data: listData } = await supabase.storage
        .from('avatars')
        .list('', { limit: 1, search: fileName })
        
      const avatarId = listData?.[0]?.id || null

      // 3. Update profile (profiles table)
      // Note: profiles table is created via trigger on auth.users, so it should exist.
      if (avatarId) {
          await supabase.from('profiles').update({ avatar_id: avatarId }).eq('id', userId)
          // Also update resumes if exists
          await supabase.from('resumes').update({ avatar_url: publicUrl }).eq('user_id', userId)
      }
      
      return { url: publicUrl, error: null }
  },

  // --- MATCHING ---
  // Match: Get Matches for a Job
  async getJobMatches(jobId: number): Promise<{ data: any[], error: any }> {
     const { data, error } = await supabase
       .from('match_evaluations')
       .select(`
          score,
          llm_score,
          calculate_score,
          llm_reason,
          calculate_reason,
          resumes (
            id,
            candidate_name,
            years_of_experience,
            expected_salary_min,
            current_level_id,
            gender,
            career_levels(name),
            cities(name),
            educations(degrees(name))
          )
       `)
       .eq('job_id', jobId)
       .order('score', { ascending: false })

     if (error) return { data: [], error }
     
     const result = data.map((item: any) => {
        let reasons = []
        
        if (item.calculate_reason) {
             reasons.push(item.calculate_reason)
        }
        
        if (item.llm_reason) {
            reasons.push('LLM: ' + item.llm_reason)
        }

        return {
            resume: {
                id: item.resumes.id,
                candidate_name: item.resumes.candidate_name,
                gender: item.resumes.gender,
                years_of_experience: item.resumes.years_of_experience,
                expected_city: item.resumes.cities?.name,
                current_level: item.resumes.career_levels?.name,
                expected_salary_min: item.resumes.expected_salary_min,
                educations: item.resumes.educations 
            },
            score: item.score,
            calculate_score: item.calculate_score,
            llm_score: item.llm_score,
            calculate_reason: item.calculate_reason,
            llm_reason: item.llm_reason,
            reasons
        }
     })

     return { data: result, error: null }
  },

  // Match: Get Matches for a Resume
  async getResumeMatches(resumeId: number): Promise<{ data: any[], error: any }> {
      const { data, error } = await supabase
       .from('match_evaluations')
       .select(`
          score,
          llm_score,
          calculate_score,
          llm_reason,
          calculate_reason,
          jobs (
            id,
            title,
            salary_min,
            salary_max,
            cities(name),
            career_levels(name)
          )
       `)
       .eq('resume_id', resumeId)
       .order('score', { ascending: false })

     if (error) return { data: [], error }
     
     const result = data.map((item: any) => {
         let reasons = []
         
         if (item.calculate_reason) {
             reasons.push(item.calculate_reason)
         }
         
         if (item.llm_reason) {
            reasons.push('LLM: ' + item.llm_reason)
         }

         return {
            job: {
                id: item.jobs.id,
                title: item.jobs.title,
                city: item.jobs.cities?.name,
                level: item.jobs.career_levels?.name,
                salary_range: `${item.jobs.salary_min}-${item.jobs.salary_max}`
            },
            score: item.score,
            calculate_score: item.calculate_score,
            llm_score: item.llm_score,
            calculate_reason: item.calculate_reason,
            llm_reason: item.llm_reason,
            reasons
         }
     })

     return { data: result, error: null }
  },

  // --- LLM ---
  // Call the LLM Edge Function
  // Model is configured in Edge Function environment variables (LLM_MODEL)
  async callLLM(messages: { role: string, content: string }[]): Promise<{ data: any, error: any }> {
    const { data, error } = await supabase.functions.invoke('call-llm', {
      body: { messages }
    })
    return { data, error }
  },

  // --- MOCK DATA (Admin) ---
  // Generate Mock Data (Jobs or Resumes)
  async generateMockData(type: 'job' | 'resume', count: number = 3): Promise<{ data: any, error: any }> {
    const { data, error } = await supabase.functions.invoke('generate-mock-data', {
      body: { type, count }
    })
    return { data, error }
  },

  // --- DIMENSIONS (Admin) ---
  async createDimension(table: 'industries' | 'skills' | 'cities', name: string): Promise<{ data: any, error: any }> {
      const { data, error } = await supabase.from(table).insert([{ name }]).select().single()
      return { data, error }
  },
  
  async updateDimension(table: 'industries' | 'skills' | 'cities', id: number, name: string): Promise<{ data: any, error: any }> {
      const { data, error } = await supabase.from(table).update({ name }).eq('id', id).select().single()
      return { data, error }
  },
  
  async deleteDimension(table: 'industries' | 'skills' | 'cities', id: number): Promise<{ error: any }> {
      const { error } = await supabase.from(table).delete().eq('id', id)
      return { error }
  },

  // --- MATCH CALCULATION ---
  async runMatch(resumeId: number, jobId: number): Promise<{ data: any, error: any }> {
      // Call RPC
      const { data: scoreData, error: rpcError } = await supabase.rpc('calculate_match_score', {
          p_resume_id: resumeId,
          p_job_id: jobId
      })
      
      if (rpcError) return { data: null, error: rpcError }
      
      if (!scoreData || scoreData.length === 0) return { data: null, error: 'No score returned' }
      
      const result = scoreData[0]
      
      // Upsert to match_evaluations
      const { data, error } = await supabase.from('match_evaluations').upsert({
          resume_id: resumeId,
          job_id: jobId,
          calculate_score: result.calculate_score,
          calculate_reason: result.calculate_reason,
          score: result.calculate_score, // Initially set total score to calculate score
          is_valid: true
      }, { onConflict: 'resume_id,job_id' }).select().single()
      
      return { data, error }
  }
}
