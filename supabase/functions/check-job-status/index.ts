import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id } = await req.json();
    
    if (!job_id) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llamacloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    if (!llamacloudApiKey) {
      throw new Error('LLAMACLOUD_API_KEY not configured');
    }

    // Check job status with LlamaCloud
    console.log(`Checking status for job: ${job_id}`);
    
    const response = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${job_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${llamacloudApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LlamaCloud API error: ${response.status} ${errorText}`);
      throw new Error(`LlamaCloud API error: ${response.status}`);
    }

    const jobStatus = await response.json();
    console.log(`Job status for ${job_id}:`, jobStatus);

    // Initialize Supabase client for checking database status
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if chunks have been created (indicating webhook processed)
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks_text')
      .select('id')
      .eq('manual_id', jobStatus.metadata?.manual_id || '')
      .limit(1);

    if (chunksError) {
      console.error('Error checking chunks:', chunksError);
    }

    const chunksCreated = chunks && chunks.length > 0;
    
    return new Response(
      JSON.stringify({
        job_id,
        status: jobStatus.status,
        created_at: jobStatus.created_at,
        updated_at: jobStatus.updated_at,
        metadata: jobStatus.metadata,
        chunks_created: chunksCreated,
        // Estimate completion percentage based on status
        progress: jobStatus.status === 'PENDING' ? 10 : 
                 jobStatus.status === 'PROCESSING' ? 50 : 
                 jobStatus.status === 'SUCCESS' ? (chunksCreated ? 100 : 90) : 
                 jobStatus.status === 'ERROR' ? 0 : 25
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error checking job status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});