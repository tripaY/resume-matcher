import { supabase } from '../supabase'
import type { JobDTO, ResumeDTO, MetaData } from '../types/supabase'

// Helper to transform Job DB response to Frontend DTO
const transformJob = (job: any): JobDTO => {
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
    description: '职位描述暂未从数据库读取...' 
  }
}

// Helper to transform Resume DB response to Frontend DTO
const transformResume = (resume: any): ResumeDTO => {
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
    educations: resume.educations // Keep raw for details view if needed
  }
}

export const supabaseService = {
  // Get Meta Data for filters
  async getMeta(): Promise<{ data: MetaData | null, error: any }> {
    try {
      const [cities, levels, skills, industries, degrees] = await Promise.all([
        supabase.from('cities').select('name'),
        supabase.from('career_levels').select('name'),
        supabase.from('skills').select('name'),
        supabase.from('industries').select('name'),
        supabase.from('degrees').select('name')
      ])

      return {
        data: {
          cities: cities.data?.map(c => c.name) || [],
          levels: levels.data?.map(l => l.name) || [],
          skills: skills.data?.map(s => s.name) || [],
          industries: industries.data?.map(i => i.name) || [],
          degrees: degrees.data?.map(d => d.name) || []
        },
        error: null
      }
    } catch (error) {
      console.error('Error fetching meta:', error)
      return { data: null, error }
    }
  },

  // Get Jobs List
  async getJobs(params: any = {}): Promise<{ data: { items: JobDTO[], total: number }, error: any }> {
    let query = supabase
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
      `, { count: 'exact' })

    // Apply filters
    if (params.city) query = query.not('cities', 'is', null).filter('cities.name', 'eq', params.city)
    if (params.level) query = query.not('career_levels', 'is', null).filter('career_levels.name', 'eq', params.level)
    if (params.industry) query = query.not('industries', 'is', null).filter('industries.name', 'eq', params.industry)
    
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

  // Get Resumes List
  async getResumes(params: any = {}): Promise<{ data: { items: ResumeDTO[], total: number }, error: any }> {
    let query = supabase
      .from('resumes')
      .select(`
        *,
        cities(name),
        career_levels(name),
        resume_skills(skills(name)),
        educations(degrees(name))
      `, { count: 'exact' })

    if (params.city) query = query.not('cities', 'is', null).filter('cities.name', 'eq', params.city)
    if (params.level) query = query.not('career_levels', 'is', null).filter('career_levels.name', 'eq', params.level)

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
        educations(degrees(name))
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error }
    return { data: transformResume(data), error: null }
  },

  // Match: Get Matches for a Job
  async getJobMatches(jobId: number): Promise<{ data: any[], error: any }> {
     const { data, error } = await supabase
       .from('match_evaluations')
       .select(`
          score,
          reason,
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
        let advantages = []
        let disadvantages = []
        try {
            if (item.reason && (item.reason.startsWith('{') || item.reason.startsWith('['))) {
                const parsed = JSON.parse(item.reason)
                reasons = parsed.reasons || []
                advantages = parsed.advantages || []
                disadvantages = parsed.disadvantages || []
            } else if (item.reason) {
                reasons = [item.reason]
            }
        } catch (e) {
            reasons = [item.reason]
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
            reasons,
            advantages,
            disadvantages
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
          reason,
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
         try {
             if (item.reason && (item.reason.startsWith('{') || item.reason.startsWith('['))) {
                 const parsed = JSON.parse(item.reason)
                 reasons = parsed.reasons || []
             } else if (item.reason) {
                 reasons = [item.reason]
             }
         } catch(e) { reasons = [item.reason] }

         return {
            job: {
                id: item.jobs.id,
                title: item.jobs.title,
                city: item.jobs.cities?.name,
                level: item.jobs.career_levels?.name,
                salary_range: `${item.jobs.salary_min}-${item.jobs.salary_max}`
            },
            score: item.score,
            reasons
         }
     })

     return { data: result, error: null }
  }
}
