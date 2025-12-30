import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, photoUrl } = await req.json()

    if (!name || !photoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing name or photoUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call OpenAI GPT-4 Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: photoUrl }
            },
            {
              type: 'text',
              text: `This person's name is "${name}". Create a memorable, friendly mnemonic to help remember their name based on their appearance.

Guidelines:
- Be respectful and kind - nothing that could be seen as mocking
- Connect a visual feature (hair style, glasses, smile, clothing style, etc.) to their name through wordplay, rhyme, or association
- Keep it short (1-2 sentences max)
- Make it vivid and easy to visualize

Just respond with the mnemonic, nothing else.`
            }
          ]
        }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('OpenAI error:', data)
      return new Response(
        JSON.stringify({ error: data.error?.message || 'OpenAI API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mnemonic = data.choices?.[0]?.message?.content || 'Could not generate mnemonic'

    return new Response(
      JSON.stringify({ mnemonic }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
