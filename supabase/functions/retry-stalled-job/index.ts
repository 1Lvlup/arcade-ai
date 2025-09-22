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
    const { job_id, manual_id } = await req.json();
    console.log(`Retrying stalled job: ${job_id} for manual: ${manual_id}`);

    const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!llamaApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check LlamaCloud job status first
    console.log('Checking LlamaCloud job status...');
    const llamaResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}`, {
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!llamaResponse.ok) {
      throw new Error(`LlamaCloud API error: ${llamaResponse.status}`);
    }

    const llamaData = await llamaResponse.json();
    console.log('LlamaCloud job status:', llamaData.status);

    // 2. If job is SUCCESS, manually fetch the result and process it
    if (llamaData.status === 'SUCCESS') {
      console.log('Job is SUCCESS, fetching result...');
      
      const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}/result/markdown`, {
        headers: {
          'Authorization': `Bearer ${llamaApiKey}`,
        },
      });

      if (resultResponse.ok) {
        const resultData = await resultResponse.json();
        console.log('Got result data, processing manually...');

        // Manually trigger the webhook processing logic
        const { error: webhookError } = await supabase.functions.invoke('llama-webhook', {
          body: {
            jobId: job_id,
            status: 'SUCCESS',
            result: resultData,
            metadata: llamaData.metadata || { manual_id }
          }
        });

        if (webhookError) {
          throw new Error(`Webhook processing failed: ${webhookError.message}`);
        }

        console.log('Successfully processed stalled job');
        return new Response(JSON.stringify({
          success: true,
          message: 'Stalled job processing completed',
          job_id,
          manual_id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. If job is still processing or failed, report status
    return new Response(JSON.stringify({
      success: false,
      message: `Job status is ${llamaData.status}, cannot retry`,
      job_id,
      llamacloud_status: llamaData.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Retry stalled job error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});