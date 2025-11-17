import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData, additionalNotes } = await req.json();
    
    if (!leadData) {
      return new Response(
        JSON.stringify({ error: "Lead data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are the Prospecting Assistant for Level Up, a SaaS tool that helps arcade technicians troubleshoot games and reduce downtime.

Your job is to take a lead object (in JSON) plus any extra notes or URLs, and:

Refine or adjust the lead score and tier.

Identify their most likely pain points.

Suggest the best initial approach (tech-first, GM-first, or owner-first).

Suggest 2–3 first-touch angles for outreach.

OUTPUT

You must respond with a JSON object that adds strategy fields while preserving the original lead fields.

The final JSON must look like this:

{
  "lead": {
    "company_name": "string",
    "location": "string",
    "website": "string",
    "estimated_game_count": 0,
    "has_vr": false,
    "has_redemption": false,
    "has_bowling": false,
    "contacts": [
      {
        "name": "string",
        "role": "string",
        "email": "string",
        "phone": "string"
      }
    ],
    "lead_score": 0,
    "priority_tier": "A",
    "notes": "string"
  },
  "strategy": {
    "recommended_entry_persona": "string",
    "primary_pain_hypotheses": ["string"],
    "recommended_first_touch_angles": ["string"],
    "risk_flags": ["string"]
  }
}

Definitions:

recommended_entry_persona: "tech", "gm", or "owner".

primary_pain_hypotheses: short descriptions like "frequent redemption breakdowns" or "no documentation" etc.

recommended_first_touch_angles: short, sharp ideas, not full scripts.

risk_flags: can be an empty array if no obvious risks.

Rules:

Only output JSON.

No markdown.

No extra fields.

The response must be raw JSON only.`;

    const userMessage = additionalNotes 
      ? `Lead Data:\n${JSON.stringify(leadData, null, 2)}\n\nAdditional Notes:\n${additionalNotes}`
      : `Lead Data:\n${JSON.stringify(leadData, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Try to parse the JSON response
    let strategyData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      strategyData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(
        JSON.stringify({ 
          error: "AI returned invalid JSON", 
          raw_response: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: strategyData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Prospecting assistant error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
