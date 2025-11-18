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
    const { lead, company, discovery, stage } = await req.json();

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

    const systemPrompt = `You are the Predictive Objection Engine for Level Up, a SaaS product that helps arcade technicians troubleshoot games and reduce downtime.

TASK

Given:

Full lead object

Full company object

Most recent discovery summary (if present)

Stage of the deal

You will return the top predicted objections this lead is likely to raise, along with severity and likelihood scores.

OUTPUT FORMAT

Only output valid JSON:
{
  "predicted_objections": [
    {
      "objection": "string",
      "root_cause_hypotheses": ["string"],
      "severity_score": 1,
      "probability_score": 1,
      "cluster": "string",
      "stage_pattern": "string",
      "persona_pattern": "string",
      "primary_response": "string",
      "alternative_frames": ["string"],
      "follow_up_questions": ["string"],
      "suggested_next_steps": ["string"]
    }
  ]
}

RULES

Severity: 1–10

Probability: 1–100 (%)

Clusters: one of "budget", "priority", "status_quo", "credibility", "timing", "technical", "staffing"

Always estimate at least 3 objections.

If discovery summary indicates pains, bias predictions based on those.

Tailor to persona:

Tech objections ≠ Owner objections

GM objections ≠ Operator objections

Only return valid JSON (no markdown).`;

    const userPrompt = `Lead: ${JSON.stringify(lead, null, 2)}
${company ? `Company: ${JSON.stringify(company, null, 2)}` : ''}
${discovery ? `Discovery: ${JSON.stringify(discovery, null, 2)}` : ''}
Stage: ${stage || 'unknown'}

Predict the top objections this lead is likely to raise.`;

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

    const predictionData = JSON.parse(content);

    console.log('Predicted objections generated:', predictionData);

    return new Response(
      JSON.stringify(predictionData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in predictive-objection-engine:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
