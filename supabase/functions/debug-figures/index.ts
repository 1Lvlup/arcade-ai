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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { manual_id = 'extrerme-claw-cosmic' } = await req.json();
    
    console.log(`🔍 Starting figure debugging for manual: ${manual_id}`);
    
    // Create service client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get figures
    const { data: figures, error } = await supabase
      .from("figures")
      .select("*")
      .eq("manual_id", manual_id)
      .limit(3);
    
    if (error) {
      console.error("❌ Database error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📸 Found ${figures?.length || 0} figures to debug`);
    
    const results = [];
    
    for (const figure of figures || []) {
      console.log(`\n🔄 === Debugging Figure ${figure.figure_id} ===`);
      console.log(`📍 Database ID: ${figure.id}`);
      console.log(`🌐 Image URL: ${figure.image_url}`);
      console.log(`📝 Current Caption: ${figure.caption_text || 'NULL'}`);
      console.log(`📄 Current OCR: ${figure.ocr_text || 'NULL'}`);
      
      const debug = {
        figure_id: figure.figure_id,
        database_id: figure.id,
        image_url: figure.image_url,
        current_caption: figure.caption_text,
        current_ocr: figure.ocr_text,
        image_accessible: false,
        presign_test: null,
        openai_test: null
      };
      
      // Test 1: Check if image URL is accessible
      if (figure.image_url) {
        try {
          console.log(`🌐 Testing direct image access...`);
          const imageResponse = await fetch(figure.image_url);
          debug.image_accessible = imageResponse.ok;
          console.log(`${imageResponse.ok ? '✅' : '❌'} Direct image access: ${imageResponse.status}`);
        } catch (error) {
          console.log(`❌ Direct image access failed: ${error.message}`);
          debug.image_accessible = false;
        }
      }
      
      // Test 2: Test presign-image function
      try {
        console.log(`🔗 Testing presign-image function...`);
        const { data: presignData, error: presignError } = await supabase.functions.invoke('presign-image', {
          body: { 
            figure_id: figure.figure_id,
            manual_id: manual_id 
          }
        });
        
        if (presignError) {
          console.log(`❌ Presign error: ${JSON.stringify(presignError)}`);
          debug.presign_test = { error: presignError };
        } else {
          console.log(`✅ Presign success: ${presignData?.presigned_url ? 'URL generated' : 'No URL'}`);
          debug.presign_test = { 
            success: true, 
            has_url: !!presignData?.presigned_url,
            url_preview: presignData?.presigned_url?.slice(0, 100) + '...'
          };
          
          // Test presigned URL access
          if (presignData?.presigned_url) {
            try {
              const presignedResponse = await fetch(presignData.presigned_url);
              debug.presign_test.url_accessible = presignedResponse.ok;
              console.log(`${presignedResponse.ok ? '✅' : '❌'} Presigned URL access: ${presignedResponse.status}`);
            } catch (error) {
              debug.presign_test.url_accessible = false;
              console.log(`❌ Presigned URL access failed: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Presign function error: ${error.message}`);
        debug.presign_test = { error: error.message };
      }
      
      // Test 3: Test OpenAI enhancement (if we have OpenAI key and accessible image)
      if (openaiApiKey && debug.presign_test?.url_accessible) {
        try {
          console.log(`🤖 Testing OpenAI enhancement...`);
          
          // Get image data
          const imageResponse = await fetch(debug.presign_test.url_preview.replace('...', ''));
          const buffer = await imageResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          const imageDataUri = `data:image/png;base64,${base64}`;
          
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
                    text: "Describe this image briefly and extract any visible text. Respond in JSON: {\"caption\": \"...\", \"ocr_text\": \"...\"}"
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageDataUri }
                  }
                ]
              }],
              max_tokens: 200,
              temperature: 0.1,
            }),
          });
          
          if (openaiResponse.ok) {
            const openaiData = await openaiResponse.json();
            const content = openaiData.choices?.[0]?.message?.content;
            debug.openai_test = { 
              success: true, 
              response: content 
            };
            console.log(`✅ OpenAI enhancement successful: ${content?.slice(0, 100)}...`);
          } else {
            const errorText = await openaiResponse.text();
            debug.openai_test = { 
              error: `${openaiResponse.status}: ${errorText.slice(0, 200)}` 
            };
            console.log(`❌ OpenAI enhancement failed: ${openaiResponse.status}`);
          }
        } catch (error) {
          debug.openai_test = { error: error.message };
          console.log(`❌ OpenAI test error: ${error.message}`);
        }
      } else {
        const reason = !openaiApiKey ? 'No OpenAI API key' : 'Image not accessible';
        debug.openai_test = { skipped: reason };
        console.log(`⏭️ OpenAI test skipped: ${reason}`);
      }
      
      results.push(debug);
    }
    
    return new Response(JSON.stringify({ 
      manual_id,
      total_figures: figures?.length || 0,
      openai_configured: !!openaiApiKey,
      debug_results: results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Debug error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});