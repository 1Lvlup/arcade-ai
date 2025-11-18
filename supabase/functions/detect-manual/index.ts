import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

if (!supabaseUrl || !supabaseServiceKey || !lovableApiKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, tenant_id } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ manual_id: null, manual_title: null, confidence: "none" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔍 Detecting manual from query:", query);

    // Set tenant context if provided
    if (tenant_id) {
      await supabase.rpc("set_tenant_context", { tenant_id });
    }

    // Fetch all available manuals with their aliases
    const { data: manuals, error } = await supabase
      .from("manual_metadata")
      .select("manual_id, canonical_title, aliases, manufacturer, platform, family, model_number");

    if (error) {
      console.error("Error fetching manuals:", error);
      return new Response(
        JSON.stringify({ manual_id: null, manual_title: null, confidence: "error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!manuals || manuals.length === 0) {
      console.log("No manuals found in database");
      return new Response(
        JSON.stringify({ manual_id: null, manual_title: null, confidence: "none" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a list of manuals for the AI to consider
    const manualsList = manuals.map((m) => {
      const aliases = m.aliases ? `(also known as: ${m.aliases.join(", ")})` : "";
      const details = [m.manufacturer, m.platform, m.family].filter(Boolean).join(" ");
      return `- "${m.canonical_title}" ${aliases} [${details}] -> ID: ${m.manual_id}`;
    }).join("\n");

    // Use Claude to intelligently detect which manual is being asked about
    const prompt = `You are a manual detection assistant. Given a user query about arcade machines, identify which manual they are asking about.

Available manuals:
${manualsList}

User query: "${query}"

Analyze the query and determine:
1. Is the user asking about a specific manual/machine? 
2. If yes, which manual best matches their question?
3. Consider variations in naming (abbreviations, partial names, common nicknames, misspellings)
4. Match natural language to manual IDs (e.g., "ice ball" -> "ice-ball-manual", "down the clown" -> "down-the-clown-combined-10-21-25-current")

Respond with a JSON object:
{
  "manual_id": "the-manual-id" or null if no specific manual detected,
  "confidence": "high" | "medium" | "low" | "none",
  "reasoning": "brief explanation of your decision"
}

Only set manual_id if you're confident the user is asking about a specific manual. If the query is general or could apply to multiple manuals, return null.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI detection failed:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ manual_id: null, manual_title: null, confidence: "error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    console.log("🤖 AI Detection Result:", result);

    // Validate the detected manual_id exists
    let finalManualId = null;
    let finalManualTitle = null;

    if (result.manual_id) {
      const detected = manuals.find((m) => m.manual_id === result.manual_id);
      if (detected) {
        finalManualId = detected.manual_id;
        finalManualTitle = detected.canonical_title;
        console.log(`✅ Detected manual: ${finalManualTitle} (${finalManualId})`);
      } else {
        console.warn(`⚠️ AI returned invalid manual_id: ${result.manual_id}`);
      }
    }

    return new Response(
      JSON.stringify({
        manual_id: finalManualId,
        manual_title: finalManualTitle,
        confidence: result.confidence || "none",
        reasoning: result.reasoning || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in detect-manual:", error);
    return new Response(
      JSON.stringify({ 
        manual_id: null, 
        manual_title: null, 
        confidence: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
