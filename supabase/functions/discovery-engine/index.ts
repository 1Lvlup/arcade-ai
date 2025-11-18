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
    const { lead, notes } = await req.json();

    if (!lead || !notes) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: lead and notes" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are the Discovery Engine for Level Up, a SaaS product that helps arcade technicians troubleshoot games and reduce downtime.

TASK

Your job is to take messy, unstructured meeting notes and generate a structured discovery summary that fits the sales cycle.

Given:

a lead JSON

raw discovery call notes (typed or pasted)

You must output structured JSON with this exact schema:
{
  "company": "string",
  "contact": "string",
  "pain_points": ["string"],
  "game_issues": ["string"],
  "decision_process": "string",
  "budget_signals": "string",
  "risk_factors": ["string"],
  "next_steps": ["string"]
}

Definitions:

pain_points: operational, staffing, downtime, training, etc.

game_issues: specific games that break or cause recurring pain.

decision_process: who decides, timeline, blockers.

budget_signals: urgency, hesitation, fiscal year timing.

risk_factors: deal-killers or red flags.

next_steps: clear actionable items to move the deal forward.

RULES

Only return valid JSON in the exact schema.

No markdown.

No commentary.

If something is unknown, use empty strings or empty arrays.`;

    const userPrompt = `Lead: ${JSON.stringify(lead, null, 2)}

Discovery Call Notes:
${notes}

Generate a structured discovery summary.`;

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
    const discoveryData = JSON.parse(content);

    console.log('Discovery summary generated:', discoveryData);

    return new Response(
      JSON.stringify(discoveryData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in discovery-engine:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
