import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const BATCH_SIZE = parseInt(Deno.env.get("BATCH_SIZE") ?? "3"); // Keep small to avoid timeouts

console.log("🔑 Environment variables check:");
console.log(`SUPABASE_URL: ${supabaseUrl ? "✅ Present" : "❌ Missing"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "✅ Present" : "❌ Missing"}`);
console.log(`OPENAI_API_KEY: ${openaiApiKey ? "✅ Present" : "❌ Missing"}`);
console.log(`BATCH_SIZE: ${BATCH_SIZE}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Figure {
  id: string;
  image_url: string;
  manual_id: string;
  figure_id: string;
}

async function enhanceFigureWithAI(figure: Figure): Promise<{caption: string | null, ocrText: string | null}> {
  try {
    console.log(`🔍 Enhancing figure ${figure.figure_id} from ${figure.manual_id}...`);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${openaiApiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this arcade manual figure and extract information. Describe what the image shows functionally and extract any visible text (OCR). Respond as JSON with keys: caption, ocr_text." 
            },
            { 
              type: "image_url", 
              image_url: { url: figure.image_url } 
            }
          ]
        }],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    
    try {
      const parsed = JSON.parse(content);
      const caption = parsed.caption ?? null;
      const ocrText = parsed.ocr_text ?? null;
      
      console.log(`✅ Enhanced ${figure.figure_id}: caption=${caption ? 'yes' : 'no'}, ocr=${ocrText ? 'yes' : 'no'}`);
      return { caption, ocrText };
    } catch (parseError) {
      console.error(`❌ Failed to parse OpenAI response for ${figure.figure_id}:`, content);
      return { caption: null, ocrText: null };
    }
  } catch (error) {
    console.error(`❌ Enhancement failed for ${figure.figure_id}:`, error);
    return { caption: null, ocrText: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Starting figure enhancement batch...");
    
    // Get a small batch of unenhanced figures
    const { data: figures, error: fetchError } = await supabase
      .from("figures")
      .select("id, image_url, manual_id, figure_id")
      .is("caption_text", null)
      .is("ocr_text", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ Error fetching figures:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!figures || figures.length === 0) {
      console.log("✅ No figures to enhance - all done!");
      return new Response(
        JSON.stringify({ done: true, processed: 0, message: "No figures need enhancement" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📸 Processing ${figures.length} figures...`);
    
    // Process each figure sequentially to avoid overwhelming the API
    const results = [];
    for (const figure of figures as Figure[]) {
      try {
        const { caption, ocrText } = await enhanceFigureWithAI(figure);
        
        // Update the figure with enhancement results
        const { error: updateError } = await supabase
          .from("figures")
          .update({
            caption_text: caption,
            ocr_text: ocrText,
            // Add a timestamp to track when enhancement was done
            updated_at: new Date().toISOString()
          })
          .eq("id", figure.id);

        if (updateError) {
          console.error(`❌ Failed to update figure ${figure.figure_id}:`, updateError);
          results.push({ id: figure.id, figure_id: figure.figure_id, ok: false, error: updateError.message });
        } else {
          results.push({ id: figure.id, figure_id: figure.figure_id, ok: true, caption: !!caption, ocr: !!ocrText });
        }
      } catch (error) {
        console.error(`❌ Failed to process figure ${figure.figure_id}:`, error);
        results.push({ id: figure.id, figure_id: figure.figure_id, ok: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const errorCount = results.filter(r => !r.ok).length;
    
    console.log(`🎯 Batch complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        processed: results.length, 
        successful: successCount,
        errors: errorCount,
        results,
        done: false // There might be more to process
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Unexpected error in enhance-figures function:", error);
    return new Response(
      JSON.stringify({ error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});