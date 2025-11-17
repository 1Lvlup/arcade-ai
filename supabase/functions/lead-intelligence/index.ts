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
    const { input } = await req.json();
    
    if (!input) {
      return new Response(
        JSON.stringify({ error: "Input is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are the Lead Intelligence Engine for an arcade-focused SaaS product called Level Up.

Your role is to take messy input about an arcade or FEC (name, city, website URL, or pasted info) and return a single, clean JSON object describing the lead, including company info, contact info, and a basic lead score.

Context

The product (Level Up) is an AI tool that helps arcade technicians troubleshoot games, find part numbers, and reduce downtime.

Ideal customers are: arcades, FECs, bowling/arcade hybrids, and similar venues with 20+ games.

Higher value = more games, more complexity, more obvious downtime pain, more locations.

TASK

Given whatever the user provides (URL, name, notes, etc.), you will:

Infer basic company info (name, location, website).

Infer whether they likely have VR, redemption, and bowling.

Estimate estimated_game_count (rough guess is fine).

Suggest 1–2 likely contacts if visible (GM/owner/tech).

Produce a lead_score from 0–100.

Assign a priority_tier:

A = strong fit, worth manual deep dive

B = possible fit, medium value

C = weak fit or very small

Add any relevant notes.

OUTPUT FORMAT

{
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
}

You must only respond with valid JSON matching this schema (no markdown, no explanation):

Rules:

If you don't know a field, use an empty string "" or 0 or false as appropriate.

contacts can be an empty array if nothing is found.

NEVER add extra fields.

NEVER wrap the JSON in backticks or markdown.

The response must be raw JSON only.`;

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
          { role: "user", content: input }
        ],
        temperature: 0.3,
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
    let leadData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      leadData = JSON.parse(cleanContent);
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
      JSON.stringify({ success: true, data: leadData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lead intelligence error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
