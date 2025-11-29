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

    const { manual_id } = await req.json()
    
    if (!manual_id) {
      throw new Error('manual_id is required')
    }

    console.log('🔄 Retrying text chunks for manual:', manual_id)

    // Count failed chunks before reset
    const { count: failedCount } = await supabase
      .from('manual_chunk_queue')
      .select('id', { count: 'exact', head: true })
      .eq('manual_id', manual_id)
      .eq('status', 'failed')

    console.log(`Found ${failedCount || 0} failed chunks`)

    // Reset failed chunks to pending
    const { error: resetError } = await supabase
      .from('manual_chunk_queue')
      .update({
        status: 'pending',
        retry_count: 0,
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id)
      .eq('status', 'failed')

    if (resetError) {
      console.error('❌ Error resetting chunks:', resetError)
      throw resetError
    }

    console.log(`✅ Reset ${failedCount || 0} chunks to pending`)

    // Ensure processing job exists
    const { data: existingJob } = await supabase
      .from('manual_processing_jobs')
      .select('manual_id')
      .eq('manual_id', manual_id)
      .single()

    if (!existingJob) {
      // Count total chunks
      const { count: totalCount } = await supabase
        .from('manual_chunk_queue')
        .select('id', { count: 'exact', head: true })
        .eq('manual_id', manual_id)

      // Create processing job
      await supabase
        .from('manual_processing_jobs')
        .insert({
          manual_id,
          total_chunks: totalCount || 0,
          processed_chunks: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      console.log('✅ Created processing job')
    }

    // Trigger processing
    console.log('🚀 Triggering process-chunk-batch...')
    const { error: processError } = await supabase.functions.invoke('process-chunk-batch', {
      body: { manualId: manual_id }
    })

    if (processError) {
      console.error('⚠️ Error triggering processing:', processError)
      // Don't throw - chunks are reset, processing will happen eventually
    } else {
      console.log('✅ Processing triggered successfully')
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Reset and triggered processing for ${failedCount || 0} failed chunks`,
      manual_id,
      failed_chunks_reset: failedCount || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in retry-text-chunks:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
