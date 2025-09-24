import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test function to enhance existing figures
async function enhanceFigureWithAI(imageData: string, context: string): Promise<{caption: string | null, ocrText: string | null}> {
  if (!openaiApiKey) {
    console.error("❌ OPENAI_API_KEY not found");
    return {caption: null, ocrText: null};
  }

  try {
    console.log(`🔍 Enhancing figure with OpenAI... Context: ${context.slice(0, 100)}...`);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${openaiApiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `You are an expert at analyzing technical diagrams and images from arcade game manuals. Your job is to:
1. Generate a descriptive caption for the image (focus on what it shows functionally)
2. Extract any visible text from the image (OCR)

Respond in JSON format:
{
  "caption": "Brief descriptive caption of what the image shows",
  "ocr_text": "All visible text extracted from the image, or null if no text"
}`
        }, {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image from an arcade game manual. Context: ${context}. Provide a caption and extract any text.`
            },
            {
              type: "image_url",
              image_url: { url: imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}` }
            }
          ]
        }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 300)}`);
      return {caption: null, ocrText: null};
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn("⚠️ No content returned from OpenAI");
      return {caption: null, ocrText: null};
    }

    console.log(`✅ OpenAI response received: ${content.slice(0, 150)}...`);

    try {
      const parsed = JSON.parse(content);
      return {
        caption: parsed.caption || null,
        ocrText: parsed.ocr_text || null
      };
    } catch (parseError) {
      console.warn(`⚠️ JSON parse failed, using fallback:`, parseError);
      // Fallback: treat the response as a caption
      return {caption: content.slice(0, 200), ocrText: null};
    }
  } catch (error) {
    console.error(`❌ Figure enhancement failed:`, error);
    return {caption: null, ocrText: null};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { figure_id, manual_id } = await req.json();
    
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🧪 Testing enhancement for figure: ${figure_id || 'all'}, manual: ${manual_id || 'all'}`);

    // Get figures to enhance
    let query = supabase.from("figures").select("*");
    
    if (figure_id) {
      query = query.eq("id", figure_id);
    } else if (manual_id) {
      query = query.eq("manual_id", manual_id);
    }

    query = query.limit(5); // Limit for testing

    const { data: figures, error } = await query;
    
    if (error) {
      console.error("❌ Database error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!figures || figures.length === 0) {
      return new Response(JSON.stringify({ error: "No figures found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📸 Found ${figures.length} figures to enhance`);

    const results = [];

    for (const figure of figures) {
      console.log(`🔄 Processing figure ${figure.id}...`);
      
      if (!figure.image_url) {
        console.warn(`⚠️ Figure ${figure.id} has no image_url`);
        continue;
      }

      try {
        // Use presign-image function to get image data
        let imageData;
        if (figure.image_url.startsWith('data:')) {
          imageData = figure.image_url;
        } else {
          console.log(`🔗 Getting presigned URL for figure ${figure.id}...`);
          const { data: presignData, error: presignError } = await supabase.functions.invoke('presign-image', {
            body: { figure_id: figure.id }
          });
          
          if (presignError || !presignData?.presigned_url) {
            console.error(`❌ Failed to get presigned URL for ${figure.id}:`, presignError);
            continue;
          }
          
          console.log(`📥 Fetching image from presigned URL...`);
          const imageResponse = await fetch(presignData.presigned_url);
          if (!imageResponse.ok) {
            console.error(`❌ Failed to fetch image: ${imageResponse.status}`);
            continue;
          }
          const buffer = await imageResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          imageData = `data:image/png;base64,${base64}`;
        }

        // Enhance the figure
        const context = `Manual: ${figure.manual_id}, Page: ${figure.page_number}`;
        const enhancement = await enhanceFigureWithAI(imageData, context);

        if (enhancement.caption || enhancement.ocrText) {
          // Update the figure in database
          const { error: updateError } = await supabase
            .from("figures")
            .update({
              caption_text: enhancement.caption,
              ocr_text: enhancement.ocrText,
              updated_at: new Date().toISOString()
            })
            .eq("id", figure.id);

          if (updateError) {
            console.error(`❌ Failed to update figure ${figure.id}:`, updateError);
          } else {
            console.log(`✅ Enhanced figure ${figure.id}`);
          }
        }

        results.push({
          figure_id: figure.id,
          original_caption: figure.caption_text,
          original_ocr: figure.ocr_text,
          new_caption: enhancement.caption,
          new_ocr: enhancement.ocrText,
          status: "enhanced"
        });

      } catch (error) {
        console.error(`❌ Error processing figure ${figure.id}:`, error);
        results.push({
          figure_id: figure.id,
          status: "error",
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Test enhancement error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});