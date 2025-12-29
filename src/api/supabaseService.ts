import { supabase } from '../utils/supabaseClient'
import type { JobDTO, ResumeDTO } from '../types/supabase'
import type { User } from '@supabase/supabase-js'

// Helper to transform Job DB response to Frontend DTO
export const transformJob = (job: any): JobDTO => {
  return {
    id: job.id,
    title: job.title,
    city: job.cities?.name || 'Unknown',
    city_id: job.city_id,
    min_years: job.min_years,
    level: job.career_levels?.name || 'Unknown',
    level_id: job.level_id,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    degree: job.degrees?.name || 'Unknown',
    degree_required: job.degrees?.name || 'Unknown',
    degree_required_id: job.degree_required_id,
    industry: job.industries?.name || 'Unknown',
    industry_id: job.industry_id,
    required_skills: job.job_skills?.filter((js: any) => js.is_required).map((js: any) => js.skills?.name).filter(Boolean) || [],
    required_skill_ids: job.job_skills?.filter((js: any) => js.is_required).map((js: any) => js.skill_id).filter(Boolean) || [],
    nice_to_have_skills: job.job_skills?.filter((js: any) => !js.is_required).map((js: any) => js.skills?.name).filter(Boolean) || [],
    nice_skill_ids: job.job_skills?.filter((js: any) => !js.is_required).map((js: any) => js.skill_id).filter(Boolean) || [],
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
    expected_title: resume.expected_title,
    salary_min: resume.expected_salary_min,
    salary_max: resume.expected_salary_max,
    skills: resume.resume_skills?.map((rs: any) => rs.skills?.name).filter(Boolean) || [],
    degree: resume.educations?.[0]?.degrees?.name || 'Unknown',
    avatar_url: null, // Will be populated by caller if needed
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
      .from('profiles')
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
        supabase.from('career_levels').select('id, name, level'),
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
    // When filtering by a related table's column, we must use !inner join
    // otherwise PostgREST filters the related object (returning null if no match) 
    // but still returns the parent row.
    if (params.skill) selectStr = selectStr.replace('job_skills!left', 'job_skills!inner')
    if (params.city) selectStr = selectStr.replace('cities(name)', 'cities!inner(name)')
    if (params.level) selectStr = selectStr.replace('career_levels(name)', 'career_levels!inner(name)')
    if (params.industry) selectStr = selectStr.replace('industries(name)', 'industries!inner(name)')
    if (params.degree) selectStr = selectStr.replace('degrees(name)', 'degrees!inner(name)')
    
    let query = supabase.from('jobs').select(selectStr, { count: 'exact' })

    // Apply filters - only if values are present and not empty strings
    // Note: We use .eq() on the related column. Combined with !inner join above, this filters the jobs.
    if (params.city) query = query.filter('cities.name', 'eq', params.city)
    if (params.level) query = query.filter('career_levels.name', 'eq', params.level)
    if (params.industry) query = query.filter('industries.name', 'eq', params.industry)
    if (params.degree) query = query.filter('degrees.name', 'eq', params.degree)
    
    // Explicitly check for non-null/undefined for numeric values, allowing 0
    if (params.min_years !== undefined && params.min_years !== null && params.min_years !== '') {
        query = query.gte('min_years', params.min_years)
    }
    
    if (params.skill) {
        // Filter jobs that require this skill
        // job_skills.skills.name
        query = query.filter('job_skills.skills.name', 'eq', params.skill)
    }

    // Sort by updateTime desc
    query = query.order('updated_at', { ascending: false })
    
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
      const { required_skill_ids, nice_skill_ids, ...jobFields } = jobData
      
      const { data, error } = await supabase
        .from('jobs')
        .insert([jobFields])
        .select()
        .single()
        
      if (error) return { data: null, error }
      
      // Combine skills to insert
      let skillsToInsert: any[] = []

      // Explicit required skills
      if (required_skill_ids && required_skill_ids.length > 0) {
           skillsToInsert = [...skillsToInsert, ...required_skill_ids.map((sid: number) => ({
              job_id: data.id,
              skill_id: sid,
              is_required: true
          }))]
      }

      // Explicit nice-to-have skills
      if (nice_skill_ids && nice_skill_ids.length > 0) {
           skillsToInsert = [...skillsToInsert, ...nice_skill_ids.map((sid: number) => ({
              job_id: data.id,
              skill_id: sid,
              is_required: false
          }))]
      }
      
      if (skillsToInsert.length > 0) {
          // Deduplicate based on skill_id?
          // For now assuming caller handles overlap or DB constraint (PK is job_id, skill_id)
          // We should probably filter duplicates if mixed usage
          await supabase.from('job_skills').upsert(skillsToInsert)
      }
      
      return { data, error: null }
  },

  // Admin: Update Job
  async updateJob(id: number, jobData: any): Promise<{ data: any, error: any }> {
      const { required_skill_ids, nice_skill_ids, ...jobFields } = jobData
      
      const { data, error } = await supabase
        .from('jobs')
        .update(jobFields)
        .eq('id', id)
        .select()
        .single()
        
      if (error) return { data: null, error }
      
      if (required_skill_ids || nice_skill_ids) {
          await supabase.from('job_skills').delete().eq('job_id', id)
          
          let skillsToInsert: any[] = []

          if (required_skill_ids && required_skill_ids.length > 0) {
               skillsToInsert = [...skillsToInsert, ...required_skill_ids.map((sid: number) => ({
                  job_id: id,
                  skill_id: sid,
                  is_required: true
              }))]
          }

          if (nice_skill_ids && nice_skill_ids.length > 0) {
               skillsToInsert = [...skillsToInsert, ...nice_skill_ids.map((sid: number) => ({
                  job_id: id,
                  skill_id: sid,
                  is_required: false
              }))]
          }

          if (skillsToInsert.length > 0) {
              await supabase.from('job_skills').insert(skillsToInsert)
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
    // Re-constructing query to support optional !inner joins
    let selectStr = `
        *,
        cities(name),
        career_levels(name),
        resume_skills!left(skills(name)),
        educations!left(degrees(name)),
        experiences!left(industries(name))
    `
    
    // Dynamic Join Type for Filtering
    if (params.city) selectStr = selectStr.replace('cities(name)', 'cities!inner(name)')
    if (params.level) selectStr = selectStr.replace('career_levels(name)', 'career_levels!inner(name)')
    
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
    let query = supabase.from('resumes').select(selectStr, { count: 'exact' })

    // Apply Filters
    if (params.city) query = query.filter('cities.name', 'eq', params.city)
    if (params.level) query = query.filter('career_levels.name', 'eq', params.level)
    
    // Explicitly check for non-null/undefined for numeric values, allowing 0
    if (params.min_years !== undefined && params.min_years !== null && params.min_years !== '') {
        query = query.gte('years_of_experience', params.min_years)
    }
    
    if (params.skill) {
        query = query.filter('resume_skills.skills.name', 'eq', params.skill)
    }
    
    if (params.degree) {
        query = query.filter('educations.degrees.name', 'eq', params.degree)
    }
    
    if (params.industry) {
        query = query.filter('experiences.industries.name', 'eq', params.industry)
    }

    // Sort by updateTime desc
    query = query.order('updated_at', { ascending: false })

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
        educations(*, degrees(name), industries(name)),
        experiences(*, industries(name))
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error }
    
    console.log('Raw Resume Detail:', data)
    const dto = transformResume(data)
    console.log('Transformed Resume:', dto)
    
    if (data.avatar_id) {
        dto.avatar_id = data.avatar_id
        // Try to get file from storage list instead of querying objects table directly (permission safe)
        const { data: files } = await supabase.storage.from('avatars').list()
        if (files) {
            const fileObj = files.find(f => f.id === data.avatar_id)
            if (fileObj) {
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileObj.name)
                dto.avatar_url = publicUrl
            }
        }
    }
    
    return { data: dto, error: null }
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
        educations(*, degrees(name), industries(name)),
        experiences(*, industries(name))
       `)
       .eq('user_id', userId) 
       .single()
       
     if (error) return { data: null, error }
     
     console.log('Raw My Resume:', data)
     const dto = transformResume(data)
     console.log('Transformed My Resume:', dto)
     
     if (data.avatar_id) {
         dto.avatar_id = data.avatar_id
         // Try to get file from storage list instead of querying objects table directly
         const { data: files } = await supabase.storage.from('avatars').list()
         if (files) {
             const fileObj = files.find(f => f.id === data.avatar_id)
             if (fileObj) {
                 const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileObj.name)
                 dto.avatar_url = publicUrl
             }
         }
     }
     
     return { data: dto, error: null }
  },

  // User: Update My Resume (Full Save)
  async saveMyResume(userId: string, resumeData: any): Promise<{ data: any, error: any }> {
      // 1. Upsert Resume Main Info
      const mainInfo: any = {
          user_id: userId,
          candidate_name: resumeData.candidate_name,
          gender: resumeData.gender,
          expected_city_id: resumeData.expected_city_id,
          years_of_experience: resumeData.years_of_experience,
          current_level_id: resumeData.current_level_id,
          expected_title: resumeData.expected_title,
          expected_salary_min: resumeData.expected_salary_min,
          expected_salary_max: resumeData.expected_salary_max
      }

      // Add avatar_id if present
      if (resumeData.avatar_id) {
          mainInfo.avatar_id = resumeData.avatar_id
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
  async uploadAvatar(_userId: string, file: File): Promise<{ url: string | null, avatarId: string | null, error: any }> {
      const fileName = `avatar-${Date.now()}-${file.name}`
      // 1. Upload file
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (error) return { url: null, avatarId: null, error }
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
      
      // 2. Get the object ID from storage.objects
      // We use list() to find the file we just uploaded
      const { data: listData } = await supabase.storage
        .from('avatars')
        .list('', { limit: 1, search: fileName })
        
      const avatarId = listData?.[0]?.id || null

      // 3. Update resumes table - REMOVED to allow manual save
      // if (avatarId) {
      //    await supabase.from('resumes').update({ avatar_id: avatarId }).eq('user_id', userId)
      // }
      
      return { url: publicUrl, avatarId, error: null }
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
  async createDimension(table: string, name: string): Promise<{ data: any, error: any }> {
      const { data, error } = await supabase.from(table).insert([{ name }]).select().single()
      return { data, error }
  },
  
  async updateDimension(table: string, id: number, name: string): Promise<{ data: any, error: any }> {
      const { data, error } = await supabase.from(table).update({ name }).eq('id', id).select().single()
      return { data, error }
  },
  
  async deleteDimension(table: string, id: number): Promise<{ error: any }> {
      const { error } = await supabase.from(table).delete().eq('id', id)
      return { error }
  },

  // --- MATCH CALCULATION ---
  // Ensure Match Evaluations exist for all jobs
  async ensureMatchEvaluations(resumeId: number): Promise<{ error: any }> {
      // 1. Get all valid job IDs
      // Note: deleteJob performs hard delete, so selecting IDs only returns existing (non-deleted) jobs.
      const { data: allJobs, error: jobError } = await supabase.from('jobs').select('id')
      if (jobError) return { error: jobError }
      
      const allJobIds = allJobs.map(j => j.id)
      if (allJobIds.length === 0) return { error: null }

      // 2. Get existing matches
      const { data: existingMatches, error: matchError } = await supabase
        .from('match_evaluations')
        .select('job_id')
        .eq('resume_id', resumeId)
      
      if (matchError) return { error: matchError }
      
      const existingJobIds = new Set(existingMatches.map(m => m.job_id))
      
      // 3. Find missing
      const missingJobIds = allJobIds.filter(id => !existingJobIds.has(id))
      
      if (missingJobIds.length > 0) {
          // Calculate scores for missing matches
          const { data: calculatedMatches, error: calcError } = await supabase.rpc('batch_calculate_match_scores', {
              p_resume_ids: [resumeId],
              p_job_ids: missingJobIds
          })
          
          if (calcError) {
              console.error('Error calculating matches:', calcError)
              return { error: calcError }
          }
          
          if (calculatedMatches && calculatedMatches.length > 0) {
              const toInsert = calculatedMatches.map((m: any) => ({
                  resume_id: m.resume_id,
                  job_id: m.job_id,
                  calculate_score: m.calculate_score,
                  calculate_reason: m.calculate_reason,
                  score: m.calculate_score // Initialize total score with calculated score
              }))
              
              const { error: insertError } = await supabase.from('match_evaluations').insert(toInsert)
              if (insertError) return { error: insertError }
          }
      }
      
      return { error: null }
  },

  // Ensure Match Evaluations exist for all resumes (for a specific job)
  async ensureJobMatchEvaluations(jobId: number): Promise<{ error: any }> {
      // 1. Get all valid resume IDs
      const { data: allResumes, error: resumeError } = await supabase.from('resumes').select('id')
      if (resumeError) return { error: resumeError }
      
      const allResumeIds = allResumes.map(r => r.id)
      if (allResumeIds.length === 0) return { error: null }

      // 2. Get existing matches
      const { data: existingMatches, error: matchError } = await supabase
        .from('match_evaluations')
        .select('resume_id')
        .eq('job_id', jobId)
      
      if (matchError) return { error: matchError }
      
      const existingResumeIds = new Set(existingMatches.map(m => m.resume_id))
      
      // 3. Find missing
      const missingResumeIds = allResumeIds.filter(id => !existingResumeIds.has(id))
      
      if (missingResumeIds.length > 0) {
          // Calculate scores for missing matches
          // Note: batch_calculate_match_scores expects arrays
          const { data: calculatedMatches, error: calcError } = await supabase.rpc('batch_calculate_match_scores', {
              p_resume_ids: missingResumeIds,
              p_job_ids: [jobId]
          })
          
          if (calcError) {
              console.error('Error calculating matches:', calcError)
              return { error: calcError }
          }
          
          if (calculatedMatches && calculatedMatches.length > 0) {
              const toInsert = calculatedMatches.map((m: any) => ({
                  resume_id: m.resume_id,
                  job_id: m.job_id,
                  calculate_score: m.calculate_score,
                  calculate_reason: m.calculate_reason,
                  score: m.calculate_score
              }))
              
              const { error: insertError } = await supabase.from('match_evaluations').insert(toInsert)
              if (insertError) return { error: insertError }
          }
      }
      
      return { error: null }
  },

  // Get Resumes for Job (Paginated with Match Info)
   async getResumesForJob(jobId: number, params: any = {}): Promise<{ data: { items: any[], total: number }, error: any }> {
     let selectStr = `
         *,
         resumes!inner (
             *,
             cities(name),
             career_levels(name),
             educations(degrees(name), industries(name)),
             experiences(industries(name)),
             resume_skills(skills(name))
         )
     `
    
    let query = supabase
        .from('match_evaluations')
        .select(selectStr, { count: 'exact' })
        .eq('job_id', jobId)
        .order('score', { ascending: false })
        
    // Pagination
    let from = 0
    let to = 19
    if (params.page && params.pageSize) {
        from = (params.page - 1) * params.pageSize
        to = from + params.pageSize - 1
    }
    query = query.range(from, to)
    
    const { data, count, error } = await query
    
    if (error) {
        console.error('Error fetching resumes for job:', error)
        return { data: { items: [], total: 0 }, error }
    }
    
    const items = data.map((m: any) => {
        const resumeDto = transformResume(m.resumes)
        return {
            ...resumeDto,
            match_score: m.score,
            match_info: m
        }
    })
    
    return { data: { items, total: count || 0 }, error: null }
  },

  // Get Jobs for Resume (Paginated with Match Info)
  async getJobsForResume(resumeId: number, params: any = {}): Promise<{ data: { items: any[], total: number }, error: any }> {
    let selectStr = `
        *,
        jobs!inner (
            *,
            cities(name),
            career_levels(name),
            degrees(name),
            industries(name),
            job_skills(
                is_required,
                skills(name)
            )
        )
    `
    
    let query = supabase
        .from('match_evaluations')
        .select(selectStr, { count: 'exact' })
        .eq('resume_id', resumeId)
        .order('score', { ascending: false })
        
    // Pagination
    let from = 0
    let to = 19
    if (params.page && params.pageSize) {
        from = (params.page - 1) * params.pageSize
        to = from + params.pageSize - 1
    }
    query = query.range(from, to)
    
    const { data, count, error } = await query
    
    if (error) {
        console.error('Error fetching jobs for resume:', error)
        return { data: { items: [], total: 0 }, error }
    }
    
    const items = data.map((m: any) => {
        const jobDto = transformJob(m.jobs)
        return {
            ...jobDto,
            match_score: m.score,
            match_info: m
        }
    })
    
    return { data: { items, total: count || 0 }, error: null }
  },

  async evaluateMatch(resumeId: number, jobId: number): Promise<{ data: any, error: any }> {
      // Call Edge Function 'evaluate-match' for LLM scoring
      const { data, error } = await supabase.functions.invoke('evaluate-match', {
          body: { resume_id: resumeId, job_id: jobId }
      })
      return { data, error }
  },
}
