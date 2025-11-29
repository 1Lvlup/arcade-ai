import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIMEOUT_MINUTES = 20; // Consider jobs stuck after 20 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Find jobs that are still "processing" but haven't been updated in TIMEOUT_MINUTES
    const timeoutThreshold = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString()
    
    const { data: stuckJobs, error: queryError } = await supabase
      .from('processing_status')
      .select('*')
      .eq('status', 'processing')
      .lt('updated_at', timeoutThreshold)

    if (queryError) {
      throw queryError
    }

    console.log(`Found ${stuckJobs?.length || 0} potentially stuck jobs`)

    const results = []
    
    for (const job of stuckJobs || []) {
      console.log(`Marking job ${job.job_id} as timed out`)
      
      // Update the job status to error
      const { error: updateError } = await supabase
        .from('processing_status')
        .update({
          status: 'error',
          stage: 'timeout',
          current_task: 'Job timed out - no response from LlamaCloud',
          error_message: `No webhook received after ${TIMEOUT_MINUTES} minutes. LlamaCloud may be experiencing delays or the job may have failed silently.`,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)

      if (updateError) {
        console.error(`Failed to update job ${job.job_id}:`, updateError)
        results.push({ job_id: job.job_id, success: false, error: updateError.message })
      } else {
        results.push({ job_id: job.job_id, success: true, manual_id: job.manual_id })
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      checked: stuckJobs?.length || 0,
      updated: results.filter(r => r.success).length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error checking stuck uploads:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
