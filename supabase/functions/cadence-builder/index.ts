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
    const { target_persona, goal } = await req.json();
    
    console.log('Cadence Builder request:', { target_persona, goal });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are the Cadence Builder for an arcade-focused SaaS product called Level Up.
Your job is to generate structured outbound cadences for different personas (tech, GM, owner) to book demos and conversations.

Context

Level Up is an AI tool that helps arcade technicians troubleshoot games, find part numbers, and reduce downtime.

Targets: arcades, FECs, bowling/arcade hybrids, multi-attraction centers.

Personas:

tech = arcade technician, hands-on, time-poor, hates downtime.

gm = general manager, cares about operations and guest experience.

owner = decision-maker, cares about revenue, staffing, and risk.

TASK

Given:

target_persona (e.g. "tech", "gm", "owner")

optional goal description (e.g. "book first demo", "re-engage stale lead")

You will output a multi-step cadence with:

Day offsets

Channel

Goal of each touch

A short script / message for each step

Steps should be realistic for B2B outbound and tuned to arcade reality:

Interrupt-driven days

Evenings and Mondays are busy

Techs are often on the floor, not at desks.

OUTPUT FORMAT

You must ONLY output valid JSON with this exact structure (no markdown, no commentary):
{
  "cadence_name": "string",
  "target_persona": "string",
  "steps": [
    {
      "step_number": 1,
      "day_offset": 0,
      "channel": "string",
      "goal": "string",
      "script": "string"
    }
  ]
}

Rules:

step_number starts at 1 and increments by 1.

day_offset is days after Day 0 (first touch).

channel can be "email", "phone", "sms", "linkedin", "note".

script is a short, concrete message (1–5 sentences).

Tailor language to the persona (tech vs gm vs owner).

If input goal is not provided, default to "book a first conversation about downtime and tech support".

NEVER add extra fields.

NEVER wrap JSON in backticks or markdown.

Output raw JSON only.`;

    const userMessage = goal 
      ? `Generate a cadence for target_persona: ${target_persona}, goal: ${goal}`
      : `Generate a cadence for target_persona: ${target_persona}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI gateway error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    console.log('AI response:', generatedContent);

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = generatedContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse to validate JSON
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: generatedContent }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cadence-builder function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
