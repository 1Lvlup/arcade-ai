import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

const QA_GENERATION_PROMPT = `You are a technical documentation expert. Generate realistic troubleshooting or setup questions that users might ask about this content, along with accurate answers grounded in the documentation.

Each Q&A pair should:
- Be a natural question a real user would ask
- Have a concise, factual answer based only on the provided content
- Include specific page references where the answer is found
- Avoid generic or obvious questions

Return a JSON array of objects with this structure:
[
  {
    "question": "How do I reset the device?",
    "answer": "Press and hold the reset button for 5 seconds until the LED flashes blue.",
    "page_refs": [12, 13],
    "category": "troubleshooting"
  }
]

Generate 3-5 high-quality Q&A pairs.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminKey = req.headers.get('x-admin-key');
    if (adminKey !== Deno.env.get('ADMIN_API_KEY')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { content, manual_id, page_start, page_end } = await req.json();

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call OpenAI to generate Q&A pairs
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: QA_GENERATION_PROMPT },
          { role: 'user', content: `Content from pages ${page_start}-${page_end}:\n\n${content}` }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    const qaText = aiResponse.choices[0].message.content;
    
    let qaPairs;
    try {
      qaPairs = JSON.parse(qaText);
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', qaText);
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generated', qaPairs.length, 'Q&A pairs for manual', manual_id);

    return new Response(JSON.stringify({ 
      qa_pairs: qaPairs,
      count: qaPairs.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in training-generate-qa:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
