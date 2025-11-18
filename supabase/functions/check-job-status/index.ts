import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const llamacloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id } = await req.json()
    console.log('Checking job status for:', job_id)

    if (!job_id) {
      return new Response(JSON.stringify({ 
        error: 'job_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch job status from LlamaCloud
    const llamaResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${llamacloudApiKey}`,
      },
    })

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text()
      console.error('LlamaCloud API error:', errorText)
      throw new Error(`LlamaCloud API error: ${llamaResponse.status}`)
    }

    const jobData = await llamaResponse.json()
    console.log('LlamaCloud job status:', jobData.status)

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Check if chunks have been created in Supabase
    let chunksCreated = false
    let chunksCount = 0

    if (jobData.metadata && jobData.metadata.manual_id) {
      const { count, error: countError } = await supabase
        .from('chunks_text')
        .select('*', { count: 'exact', head: true })
        .eq('manual_id', jobData.metadata.manual_id)

      if (!countError && count !== null) {
        chunksCount = count
        chunksCreated = count > 0
        console.log(`Found ${count} chunks for manual_id: ${jobData.metadata.manual_id}`)
      } else {
        console.error('Error counting chunks:', countError)
      }
    }

    // Calculate estimated progress
    let progress = 0
    if (jobData.status === 'PENDING') {
      progress = 10
    } else if (jobData.status === 'RUNNING') {
      progress = chunksCreated ? 80 : 50
    } else if (jobData.status === 'SUCCESS') {
      progress = chunksCreated ? 100 : 90
    } else if (jobData.status === 'ERROR') {
      progress = 0
    }

    return new Response(JSON.stringify({
      status: jobData.status,
      created_at: jobData.created_at,
      updated_at: jobData.updated_at,
      metadata: jobData.metadata,
      chunks_created: chunksCreated,
      chunks_count: chunksCount,
      progress
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in check-job-status:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})