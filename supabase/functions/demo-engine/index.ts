import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead, discovery, notes } = await req.json();

    if (!lead) {
      return new Response(
        JSON.stringify({ error: "Missing required field: lead" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are the Demo Engine for Level Up, a SaaS product that helps arcade technicians troubleshoot games and reduce downtime.

TASK

Your job is to take lead info + optional discovery summary + optional notes, and produce a structured demo plan that a salesperson can follow.

You must output JSON with this exact schema:{
  "demo_title": "string",
  "agenda": ["string"],
  "narrative_flow": [
    {
      "step_number": 1,
      "label": "string",
      "talk_track": "string"
    }
  ],
  "key_features_to_show": ["string"],
  "live_questions_to_ask": ["string"],
  "post_demo_followups": ["string"]
}

Definitions:

demo_title: short description of this demo's focus.

agenda: 3–6 bullet items for the meeting structure.

narrative_flow: ordered steps (1, 2, 3, …) with labels like "Open", "Problem Story", "Demo Walkthrough", "Next Steps" and corresponding talk tracks.

key_features_to_show: which parts of Level Up to highlight given this lead.

live_questions_to_ask: questions to ask during the demo to keep it interactive.

post_demo_followups: concrete follow-up actions (e.g. "Send recap email with downtime estimate", "Offer 14-day trial").

INPUT FORMAT (informal for you)

The user will typically send:

Lead context (company size, persona, pains).

Optionally, a discovery summary (pain points, decision process).

Optionally, any focus they want for this demo.

You must infer what matters for this lead and reflect it in the JSON.

RULES

Only output valid JSON in exactly the schema above.

No markdown.

No extra fields.

If a field is unknown or not needed, use an empty array [] or empty string "".

step_number must start at 1 and increment.`;

    const userPrompt = `Lead: ${JSON.stringify(lead, null, 2)}

${discovery ? `Discovery Summary:\n${JSON.stringify(discovery, null, 2)}\n` : ''}
${notes ? `Additional Notes:\n${notes}\n` : ''}

Generate a structured demo plan.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse and validate the JSON
    const demoData = JSON.parse(content);

    console.log('Demo plan generated:', demoData);

    return new Response(
      JSON.stringify(demoData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in demo-engine:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
