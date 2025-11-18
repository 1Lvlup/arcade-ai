import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    console.log('🧹 Starting cleanup of stale processing jobs...')

    // Mark jobs as stale if they've been processing for more than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data: staleJobs, error: fetchError } = await supabase
      .from('processing_status')
      .select('job_id, manual_id, status, updated_at')
      .in('status', ['processing', 'starting', 'pending'])
      .lt('updated_at', twoHoursAgo)

    if (fetchError) {
      console.error('Error fetching stale jobs:', fetchError)
      throw fetchError
    }

    console.log(`Found ${staleJobs?.length || 0} stale jobs`)

    if (staleJobs && staleJobs.length > 0) {
      // Update stale jobs to error status
      const { error: updateError } = await supabase
        .from('processing_status')
        .update({
          status: 'error',
          error_message: 'Job timed out - no updates for 2+ hours',
          updated_at: new Date().toISOString()
        })
        .in('job_id', staleJobs.map(j => j.job_id))

      if (updateError) {
        console.error('Error updating stale jobs:', updateError)
        throw updateError
      }

      console.log(`✅ Marked ${staleJobs.length} stale jobs as error`)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      cleaned_count: staleJobs?.length || 0,
      jobs: staleJobs 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in cleanup-stale-jobs:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})