import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id } = await req.json();
    console.log(`Diagnosing job: ${job_id}`);

    const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    if (!llamaApiKey) {
      throw new Error('LLAMACLOUD_API_KEY not found');
    }

    // Check LlamaCloud job status
    console.log('Checking LlamaCloud status...');
    const llamaResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}`, {
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!llamaResponse.ok) {
      console.error(`LlamaCloud API error: ${llamaResponse.status}`);
      const errorText = await llamaResponse.text();
      console.error(`Error details: ${errorText}`);
      return new Response(JSON.stringify({ 
        error: `LlamaCloud API error: ${llamaResponse.status}`,
        details: errorText,
        job_id
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const llamaData = await llamaResponse.json();
    console.log('LlamaCloud response:', JSON.stringify(llamaData, null, 2));

    // Check Supabase data
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    console.log('Checking Supabase chunks...');
    const manual_id = llamaData.metadata?.manual_id;
    
    let chunksCount = 0;
    let figuresCount = 0;

    if (manual_id) {
      const { count: chunks } = await supabase
        .from('chunks_text')
        .select('*', { count: 'exact', head: true })
        .eq('manual_id', manual_id);
      
      const { count: figures } = await supabase
        .from('figures')
        .select('*', { count: 'exact', head: true })
        .eq('manual_id', manual_id);

      chunksCount = chunks || 0;
      figuresCount = figures || 0;
    }

    console.log(`Chunks found: ${chunksCount}, Figures found: ${figuresCount}`);

    return new Response(JSON.stringify({
      job_id,
      llamacloud_status: llamaData.status,
      llamacloud_created_at: llamaData.created_at,
      llamacloud_metadata: llamaData.metadata,
      manual_id: manual_id,
      chunks_in_db: chunksCount,
      figures_in_db: figuresCount,
      webhook_url: llamaData.webhook_url,
      diagnosis: {
        job_exists_in_llamacloud: true,
        chunks_created: chunksCount > 0,
        figures_created: figuresCount > 0,
        likely_issue: chunksCount === 0 ? 'webhook_never_called_or_failed' : 'processing_successful'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Diagnosis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});