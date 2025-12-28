import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.info('call-llm function started');

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Auth Check (Optional but recommended)
    // The supabase-js client automatically sends the Authorization header.

    // 3. Parse Request Body
    const { messages, temperature = 0.7 } = await req.json()
    
    const model = Deno.env.get('LLM_MODEL')
    if (!model) {
      throw new Error('Missing LLM_MODEL secret')
    }

    // 4. Call OpenRouter
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) {
      throw new Error('Missing OPENROUTER_API_KEY')
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://resumematcher.com', // Optional: For OpenRouter rankings
        'X-Title': 'Resume Matcher', // Optional: For OpenRouter rankings
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false // Set to true if you want to handle streaming
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenRouter API Error')
    }

    const data = await response.json()

    // 5. Return Response
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
