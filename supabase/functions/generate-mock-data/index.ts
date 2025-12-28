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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
        throw new Error('Missing Authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
    // We use Service Role Key here to ensure we can read all meta data even if RLS restricts it (though meta usually public)
    const adminSupabase = createClient(
        supabaseUrl, 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const [cities, levels, industries, degrees, skills] = await Promise.all([
      adminSupabase.from('cities').select('id, name'),
      adminSupabase.from('career_levels').select('id, name'),
      adminSupabase.from('industries').select('id, name'),
      adminSupabase.from('degrees').select('id, name'),
      adminSupabase.from('skills').select('id, name'),
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
            "description": "string (short job description, 2-3 sentences)",
            "required_skills": ["array of strings (must be from Allowed Skills)"]
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
            "degree": "string (must be one of Allowed Degrees)",
            "skills": ["array of strings (must be from Allowed Skills)"]
        }
        
        Return ONLY valid JSON array.`
    }

    // 5. Call LLM
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set')

    const model = Deno.env.get('LLM_MODEL')
    if (!model) throw new Error('LLM_MODEL secret not set')

    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    })

    if (!llmRes.ok) {
        throw new Error('LLM call failed')
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
                salary_max: item.salary_max,
                description: item.description
            }
            
            // Insert Job
            const { data: job, error } = await adminSupabase.from('jobs').insert([jobData]).select().single()
            if (error) { console.error('Job insert error:', error); continue; }
            
            // Insert Skills
            if (item.required_skills && Array.isArray(item.required_skills)) {
                const skillInserts = item.required_skills
                    .map((name: string) => skillMap.get(name))
                    .filter((id: number) => id)
                    .map((skill_id: number) => ({ job_id: job.id, skill_id, is_required: true }))
                
                if (skillInserts.length > 0) {
                    await adminSupabase.from('job_skills').insert(skillInserts)
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
            
            const { data: resume, error } = await adminSupabase.from('resumes').insert([resumeData]).select().single()
             if (error) { console.error('Resume insert error:', error); continue; }

            // Insert Skills
             if (item.skills && Array.isArray(item.skills)) {
                const skillInserts = item.skills
                    .map((name: string) => skillMap.get(name))
                    .filter((id: number) => id)
                    .map((skill_id: number) => ({ resume_id: resume.id, skill_id }))
                 
                 if (skillInserts.length > 0) {
                     await adminSupabase.from('resume_skills').insert(skillInserts)
                 }
            }
            
            // Mock Education (Degree)
             if (item.degree) {
                 const degreeId = degreeMap.get(item.degree)
                 if (degreeId) {
                     await adminSupabase.from('educations').insert([{
                         resume_id: resume.id,
                         degree_id: degreeId,
                         school: 'Mock University',
                         major: 'Computer Science',
                         start_date: '2015-09-01',
                         end_date: '2019-06-30'
                     }])
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
