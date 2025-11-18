import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { persona, phase, script_type, context } = await req.json();

    if (!persona || !phase || !script_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: persona, phase, script_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are the Script Library Engine for Level Up, a SaaS product that helps arcade technicians troubleshoot games and reduce downtime.

Your job is to generate individual sales scripts (cold calls, emails, SMS, objection responses) and return them as simple JSON objects that can be stored in a scripts table.

Context

Personas:

tech = arcade technician

gm = general manager

owner = decision-maker

Phases:

prospecting

outreach

discovery

demo

close

Channels:

"cold_call_opening"

"follow_up_email"

"sms_check_in"

"objection_response"

etc.

TASK

Given:

persona (e.g. "tech", "gm", "owner")

phase (e.g. "outreach")

script_type (e.g. "cold_call_opening", "follow_up_email")

optional context/goal (e.g. "lead mentioned frequent downtime on redemption games")

You will create ONE script and return it as JSON.

OUTPUT FORMAT

Only output valid JSON, with this structure:

{
  "title": "string",
  "persona": "string",
  "phase": "string",
  "content": "string"
}

title: short label for this script (e.g. "Tech – Cold Call Opener – Downtime Angle")

persona: copy of the input persona

phase: copy of the input phase

content: the actual script (plain text).

Rules:

Make content directly usable: no brackets, no meta-explanations.

Tailor length and tone to the channel indicated by script_type (short for calls/SMS, longer for email).

Always assume the product is new to them; don't write like they already know Level Up.

NEVER add extra fields.

NEVER wrap JSON in markdown.

Output raw JSON only.`;

    const userMessage = context 
      ? `Generate a ${script_type} script for ${persona} in the ${phase} phase. Additional context: ${context}`
      : `Generate a ${script_type} script for ${persona} in the ${phase} phase.`;

    console.log("Calling Lovable AI Gateway for script generation...");

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log("Raw AI response:", generatedContent);

    // Clean up potential markdown wrapping
    let cleanedJson = generatedContent.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let scriptData;
    try {
      scriptData = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedJson);
      throw new Error("AI did not return valid JSON");
    }

    // Validate structure
    if (!scriptData.title || !scriptData.persona || !scriptData.phase || !scriptData.content) {
      throw new Error("AI response missing required fields");
    }

    return new Response(
      JSON.stringify(scriptData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in script-library-engine:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
