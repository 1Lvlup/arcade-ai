import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`🧪 TEST WEBHOOK - ${req.method} ${req.url}`);
  console.log("📋 Headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log("📦 Raw body:", body);
    
    let parsed;
    try {
      parsed = JSON.parse(body);
      console.log("✅ Parsed JSON:", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("❌ Not valid JSON:", e instanceof Error ? e.message : String(e));
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Test webhook received successfully",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      bodyLength: body.length,
      parsedJson: parsed || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error("❌ Test webhook error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});