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
    const { objection, persona, stage, context } = await req.json();

    if (!objection) {
      return new Response(
        JSON.stringify({ error: "Missing required field: objection" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are the Objection Engine for Level Up, a SaaS product that helps arcade technicians troubleshoot games and reduce downtime.

TASK

Your job is to take:

A short description of an objection (what the prospect said).

The persona and stage.

Optional context about the lead.

And produce a structured objection handling pattern.

You must output JSON with this exact schema:
{
  "objection": "string",
  "root_cause_hypotheses": ["string"],
  "primary_response": "string",
  "alternative_frames": ["string"],
  "follow_up_questions": ["string"],
  "suggested_next_steps": ["string"]
}

Definitions:

objection: clean restatement of the objection.

root_cause_hypotheses: what might actually be behind this objection (budget fear, risk, no urgency, pride, etc.).

primary_response: your best, concise response.

alternative_frames: 2–4 different ways to reframe it (e.g. risk vs status quo, cost vs downtime).

follow_up_questions: questions to open the conversation instead of arguing.

suggested_next_steps: how to progress the deal (e.g. "propose pilot", "offer call with another FEC owner").

RULES

Only output valid JSON using the exact schema.

No markdown.

No extra fields.

If you don't know a section, use an empty array [] or empty string "".`;

    const userPrompt = `Persona: ${persona || 'unknown'}
Stage: ${stage || 'unknown'}
Objection: ${objection}
${context ? `Context: ${context}` : ''}

Generate a structured objection handling pattern.`;

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

    const objectionData = JSON.parse(content);

    console.log('Objection pattern generated:', objectionData);

    return new Response(
      JSON.stringify(objectionData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in objection-engine:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
