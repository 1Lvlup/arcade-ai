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
        presign_test: null as any,
        openai_test: null as any
      };
      
      // Test 1: Check if image URL is accessible
      if (figure.image_url) {
        try {
          console.log(`🌐 Testing direct image access...`);
          const imageResponse = await fetch(figure.image_url);
          debug.image_accessible = imageResponse.ok;
          console.log(`${imageResponse.ok ? '✅' : '❌'} Direct image access: ${imageResponse.status}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`❌ Direct image access failed: ${errorMessage}`);
          debug.image_accessible = false;
        }
      }
      
      // Test 2: Test presign-image function
      try {
        console.log(`🔗 Testing presign-image function...`);
        const { data: presignData, error: presignError } = await supabase.functions.invoke('presign-image', {
          body: { 
            figure_id: figure.figure_id,
            manual_id: figure.manual_id 
          },
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey
          }
        });
        
        if (presignError) {
          console.log(`❌ Presign error: ${JSON.stringify(presignError)}`);
          debug.presign_test = { error: presignError };
        } else {
          console.log(`✅ Presign success: ${presignData?.url ? 'URL available' : 'No URL'}`);
          debug.presign_test = { 
            success: true, 
            has_url: !!presignData?.url,
            url_preview: presignData?.url?.slice(0, 100) + '...',
            returned_url: presignData?.url
          };
          
          // Test returned URL access
          if (presignData?.url) {
            try {
              const urlResponse = await fetch(presignData.url);
              debug.presign_test.url_accessible = urlResponse.ok;
              console.log(`${urlResponse.ok ? '✅' : '❌'} Returned URL access: ${urlResponse.status}`);
            } catch (error) {
              if (debug.presign_test && typeof debug.presign_test === 'object') {
                debug.presign_test.url_accessible = false;
              }
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.log(`❌ Returned URL access failed: ${errorMessage}`);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Presign function error: ${errorMessage}`);
        debug.presign_test = { error: errorMessage };
      }
      
      // Test 3: Test OpenAI enhancement (if we have OpenAI key and accessible image)
      const hasAccessibleImage = debug.image_accessible || 
        (debug.presign_test && typeof debug.presign_test === 'object' && 'url_accessible' in debug.presign_test && debug.presign_test.url_accessible);
      
      if (openaiApiKey && hasAccessibleImage) {
        try {
          console.log(`🤖 Testing OpenAI enhancement...`);
          
          // Use the direct image URL or the presign URL
          let imageUrl = figure.image_url;
          if (debug.presign_test && typeof debug.presign_test === 'object' && 'returned_url' in debug.presign_test && debug.presign_test.returned_url) {
            imageUrl = debug.presign_test.returned_url;
          }
          
          // Get image data
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status}`);
          }
          
          const buffer = await imageResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          
          // Detect image type from URL or content-type
          const contentType = imageResponse.headers.get('content-type') || 'image/png';
          const imageDataUri = `data:${contentType};base64,${base64}`;
          
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
              response: content,
              used_url: imageUrl
            };
            console.log(`✅ OpenAI enhancement successful: ${content?.slice(0, 100)}...`);
          } else {
            const errorText = await openaiResponse.text();
            debug.openai_test = { 
              error: `${openaiResponse.status}: ${errorText.slice(0, 200)}`,
              used_url: imageUrl
            };
            console.log(`❌ OpenAI enhancement failed: ${openaiResponse.status} - ${errorText.slice(0, 100)}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          debug.openai_test = { error: errorMessage };
          console.log(`❌ OpenAI test error: ${errorMessage}`);
        }
      } else {
        const reasons = [];
        if (!openaiApiKey) reasons.push('No OpenAI API key');
        if (!hasAccessibleImage) reasons.push('Image not accessible');
        
        const reason = reasons.join(', ');
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});