import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.info('generate-mock-data function started');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Supabase Client
    // We use the Authorization header from the request to act as the logged-in user
    // This ensures we have a valid user_id for insertion
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // Get the API key from the request header (injected by the client)
    const supabaseKey = req.headers.get('apikey') ?? ''
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
        throw new Error('Missing Authorization header')
    }

    if (!supabaseKey) {
        throw new Error('Missing apikey header')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')
    
    const userId = user.id

    // 2. Parse Request
    const { type, count = 3 } = await req.json() // type: 'job' | 'resume'
    
    if (!['job', 'resume'].includes(type)) {
        throw new Error('Invalid type. Must be "job" or "resume"')
    }

    // 3. Fetch Dictionary Data for Prompt Context
    // Using the authenticated client to read dictionary tables
    const [cities, levels, industries, degrees, skills] = await Promise.all([
      supabase.from('cities').select('id, name'),
      supabase.from('career_levels').select('id, name'),
      supabase.from('industries').select('id, name'),
      supabase.from('degrees').select('id, name'),
      supabase.from('skills').select('id, name'),
    ])

    // Create Maps for Name -> ID lookup
    const cityMap = new Map(cities.data?.map((i: any) => [i.name, i.id]))
    const levelMap = new Map(levels.data?.map((i: any) => [i.name, i.id]))
    const industryMap = new Map(industries.data?.map((i: any) => [i.name, i.id]))
    const degreeMap = new Map(degrees.data?.map((i: any) => [i.name, i.id]))
    const skillMap = new Map(skills.data?.map((i: any) => [i.name, i.id]))

    // Create Lists for Prompt
    const cityNames = cities.data?.map((c: any) => c.name).join(', ')
    const levelNames = levels.data?.map((l: any) => l.name).join(', ')
    const industryNames = industries.data?.map((i: any) => i.name).join(', ')
    const degreeNames = degrees.data?.map((d: any) => d.name).join(', ')
    const skillNames = skills.data?.map((s: any) => s.name).join(', ')

    // 4. Construct Prompt
    let prompt = ''
    if (type === 'job') {
        prompt = `Generate ${count} realistic Job Postings in JSON array format.
        Use ONLY the provided allowed values for Enums.
        
        Allowed Cities: [${cityNames}]
        Allowed Levels: [${levelNames}]
        Allowed Industries: [${industryNames}]
        Allowed Degrees: [${degreeNames}]
        Allowed Skills: [${skillNames}]

        Schema per object:
        {
            "title": "string (e.g. Senior Frontend Engineer)",
            "city": "string (must be one of Allowed Cities)",
            "min_years": number (0-10),
            "level": "string (must be one of Allowed Levels)",
            "degree_required": "string (must be one of Allowed Degrees)",
            "industry": "string (must be one of Allowed Industries)",
            "salary_min": number (monthly salary),
            "salary_max": number (monthly salary, > min),
            "skills": [
              { "name": "string (must be one of Allowed Skills)", "is_required": boolean }
            ]
        }
        
        Return ONLY valid JSON array.`
    } else {
        prompt = `Generate ${count} realistic Resumes in JSON array format.
        Use ONLY the provided allowed values for Enums.
        
        Allowed Cities: [${cityNames}]
        Allowed Levels: [${levelNames}]
        Allowed Degrees: [${degreeNames}]
        Allowed Skills: [${skillNames}]

        Schema per object:
        {
            "candidate_name": "string",
            "gender": "M" or "F",
            "expected_city": "string (must be one of Allowed Cities)",
            "years_of_experience": number (0-20),
            "current_level": "string (must be one of Allowed Levels)",
            "expected_title": "string",
            "expected_salary_min": number,
            "expected_salary_max": number,
            "educations": [
              {
                 "school": "string",
                 "major_industry": "string (must be one of Allowed Industries, acts as major category)",
                 "degree": "string (must be one of Allowed Degrees)"
              }
            ],
            "experiences": [
              {
                 "company_name": "string",
                 "industry": "string (must be one of Allowed Industries)",
                 "description": "string (include title, duration, and responsibilities)"
              }
            ],
            "skills": ["array of strings (must be from Allowed Skills)"]
        }
        
        Return ONLY valid JSON array.`
    }

    // 5. Call LLM via call-llm function
    // We reuse the central LLM function to handle model selection and keys
    const functionsUrl = `${supabaseUrl}/functions/v1/call-llm`
    
    const llmRes = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
            'Authorization': authHeader, // Propagate the auth header
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    })

    if (!llmRes.ok) {
        const errorText = await llmRes.text()
        throw new Error(`Call-LLM failed: ${llmRes.status} ${errorText}`)
    }
    
    const llmData = await llmRes.json()
    let content = llmData.choices[0].message.content

    // Cleanup JSON
    if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0]
    } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0]
    }
    
    let items = []
    try {
        items = JSON.parse(content)
    } catch (e) {
        throw new Error('Failed to parse LLM response: ' + content)
    }

    if (!Array.isArray(items)) items = [items]

    // 6. Insert Data
    const results = []
    
    for (const item of items) {
        if (type === 'job') {
            const jobData = {
                user_id: userId,
                title: item.title,
                city_id: cityMap.get(item.city) || null,
                min_years: item.min_years,
                level_id: levelMap.get(item.level) || null,
                degree_required_id: degreeMap.get(item.degree_required) || null,
                industry_id: industryMap.get(item.industry) || null,
                salary_min: item.salary_min,
                salary_max: item.salary_max
            }
            
            // Insert Job
            const { data: job, error } = await supabase.from('jobs').insert([jobData]).select().single()
            if (error) { console.error('Job insert error:', error); continue; }
            
            // Insert Skills
            if (item.skills && Array.isArray(item.skills)) {
                const skillInserts = item.skills
                    .map((s: any) => ({
                        id: skillMap.get(s.name),
                        is_required: s.is_required
                    }))
                    .filter((s: any) => s.id)
                    .map((s: any) => ({ job_id: job.id, skill_id: s.id, is_required: s.is_required }))
                
                if (skillInserts.length > 0) {
                    await supabase.from('job_skills').insert(skillInserts)
                }
            }
            results.push(job)

        } else if (type === 'resume') {
             const resumeData = {
                user_id: userId,
                candidate_name: item.candidate_name,
                gender: item.gender,
                expected_city_id: cityMap.get(item.expected_city) || null,
                years_of_experience: item.years_of_experience,
                current_level_id: levelMap.get(item.current_level) || null,
                expected_title: item.expected_title,
                expected_salary_min: item.expected_salary_min,
                expected_salary_max: item.expected_salary_max
            }
            
            const { data: resume, error } = await supabase.from('resumes').insert([resumeData]).select().single()
             if (error) { console.error('Resume insert error:', error); continue; }

            // Insert Skills
            if (item.skills && Array.isArray(item.skills)) {
                const skillInserts = item.skills
                    .map((name: string) => skillMap.get(name))
                    .filter((id: number) => id)
                    .map((skill_id: number) => ({ resume_id: resume.id, skill_id }))
                 
                 if (skillInserts.length > 0) {
                     await supabase.from('resume_skills').insert(skillInserts)
                 }
            }
            
            // Insert Educations
             if (item.educations && Array.isArray(item.educations)) {
                 const eduInserts = item.educations.map((edu: any) => {
                     const degreeId = degreeMap.get(edu.degree)
                     const industryId = industryMap.get(edu.major_industry)
                     if (!degreeId) return null
                     return {
                         resume_id: resume.id,
                         degree_id: degreeId,
                         major_industry_id: industryId || null,
                         school: edu.school
                     }
                 }).filter(Boolean)

                 if (eduInserts.length > 0) {
                     await supabase.from('educations').insert(eduInserts)
                 }
             }

            // Insert Experiences
             if (item.experiences && Array.isArray(item.experiences)) {
                 const expInserts = item.experiences.map((exp: any) => ({
                     resume_id: resume.id,
                     company_name: exp.company_name,
                     industry_id: industryMap.get(exp.industry) || null,
                     description: exp.description
                 }))

                 if (expInserts.length > 0) {
                     await supabase.from('experiences').insert(expInserts)
                 }
             }
             results.push(resume)
        }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, data: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
