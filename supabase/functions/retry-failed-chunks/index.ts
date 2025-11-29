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

    console.log('Resetting failed chunks for manual:', manual_id)

    // Reset failed chunks to pending
    const { error: resetError, count } = await supabase
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
      console.error('Error resetting chunks:', resetError)
      throw resetError
    }

    console.log(`Reset ${count || 0} chunks to pending`)

    // Trigger processing by invoking process-chunk-batch
    const { error: processError } = await supabase.functions.invoke('process-chunk-batch', {
      body: { manual_id }
    })

    if (processError) {
      console.error('Error triggering processing:', processError)
      // Don't throw - chunks are reset, processing will happen eventually
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Reset and triggered processing for ${count || 0} chunks`,
      manual_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in retry-failed-chunks:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
