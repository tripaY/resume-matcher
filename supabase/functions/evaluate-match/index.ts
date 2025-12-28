import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.info('evaluate-match function started');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = req.headers.get('apikey') ?? ''
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) throw new Error('Missing Authorization header')
    if (!supabaseKey) throw new Error('Missing apikey header')

    // Client for fetching data (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Admin Client for updating scores (bypasses RLS)
    const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { resume_id, job_id } = await req.json()
    if (!resume_id || !job_id) throw new Error('Missing resume_id or job_id')

    // 1. Fetch Job
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
            title,
            min_years,
            salary_min,
            salary_max,
            career_levels(name),
            degrees(name),
            job_skills(
                is_required,
                skills(name)
            )
        `)
        .eq('id', job_id)
        .single()
    
    if (jobError || !job) throw new Error('Job not found or access denied: ' + (jobError?.message || ''))

    // 2. Fetch Resume
    const { data: resume, error: resumeError } = await supabase
        .from('resumes')
        .select(`
            candidate_name,
            years_of_experience,
            career_levels(name),
            resume_skills(skills(name)),
            educations(
                school,
                degrees(name),
                major_industry:industries(name)
            ),
            experiences(
                company_name,
                description,
                industry:industries(name)
            )
        `)
        .eq('id', resume_id)
        .single()

    if (resumeError || !resume) throw new Error('Resume not found or access denied: ' + (resumeError?.message || ''))

    // 3. Construct Prompt
    const reqSkills = job.job_skills?.filter((js:any) => js.is_required).map((js:any) => js.skills?.name).join(', ') || 'None'
    const niceSkills = job.job_skills?.filter((js:any) => !js.is_required).map((js:any) => js.skills?.name).join(', ') || 'None'

    const resumeSkills = resume.resume_skills?.map((rs: any) => rs.skills?.name).join(', ') || 'None'
    const educations = resume.educations?.map((e: any) => `${e.degrees?.name || 'Unknown Degree'} in ${e.major_industry?.name || 'Unknown Major'}`).join('; ') || 'None'
    const experiences = resume.experiences?.map((e: any) => `${e.description || 'No description'} in ${e.industry?.name || 'Unknown Industry'}`).join('; ') || 'None'

    const prompt = `You are an expert HR recruiter. Please evaluate the match between the following Resume and Job Description.

Job Description:
Title: ${job.title}
Level: ${job.career_levels?.name || 'N/A'}
Skills: ${reqSkills}
Nice-to-have: ${niceSkills}
Min Experience: ${job.min_years} years
Degree: ${job.degrees?.name || 'N/A'}

Resume:
Name: ${resume.candidate_name}
Level: ${resume.career_levels?.name || 'N/A'}
Experience: ${resume.years_of_experience} years
Skills: ${resumeSkills}
Education: ${educations}
Past Experience: ${experiences}

Task:
1. Analyze the semantic match between the candidate's profile and the job requirements.
2. Provide a score from 0 to 100, where 0 is no match and 100 is perfect match.
3. Provide a brief reason (max 1 sentence) for the score.

Output Format (JSON only):
{
  "score": <number>,
  "reason": "<string>"
}
`

    // 4. Call LLM
    const functionsUrl = `${supabaseUrl}/functions/v1/call-llm`
    
    const llmRes = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
            'Authorization': authHeader, // Use user's auth to respect quotas/logging if applicable
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
        })
    })

    if (!llmRes.ok) {
        const txt = await llmRes.text()
        throw new Error(`LLM Call failed: ${txt}`)
    }

    const llmData = await llmRes.json()
    let content = llmData.choices[0].message.content

    // Clean JSON
    if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0]
    } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0]
    }

    let result;
    try {
        result = JSON.parse(content)
    } catch (e) {
        // Fallback if JSON is malformed
         console.error('JSON Parse Error:', content)
         result = { score: 0, reason: 'Failed to parse AI response' }
    }
    
    const score = result.score || 0
    const reason = result.reason || 'No reason provided'

    // 5. Update match_evaluations
    const { error: updateError } = await supabaseAdmin
        .from('match_evaluations')
        .upsert({
            resume_id,
            job_id,
            llm_score: score,
            llm_reason: reason,
            updated_at: new Date().toISOString()
        }, { onConflict: 'resume_id,job_id' })

    if (updateError) throw new Error('Failed to update match score: ' + updateError.message)

    return new Response(JSON.stringify({ success: true, score, reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
