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

    const { job_id } = await req.json()
    
    if (!job_id) {
      throw new Error('job_id is required')
    }

    console.log('Cleaning up failed job:', job_id)

    // Delete the processing status
    const { error: statusError } = await supabase
      .from('processing_status')
      .delete()
      .eq('job_id', job_id)

    if (statusError) {
      console.error('Error deleting processing status:', statusError)
    }

    // Get the document to find manual_id
    const { data: doc } = await supabase
      .from('documents')
      .select('manual_id, storage_path')
      .eq('job_id', job_id)
      .single()

    if (doc) {
      // Delete any chunks that may have been created
      const { error: chunksError } = await supabase
        .from('chunks_text')
        .delete()
        .eq('manual_id', doc.manual_id)

      if (chunksError) {
        console.error('Error deleting chunks:', chunksError)
      }

      // Delete any figures
      const { error: figuresError } = await supabase
        .from('figures')
        .delete()
        .eq('manual_id', doc.manual_id)

      if (figuresError) {
        console.error('Error deleting figures:', figuresError)
      }

      // Delete the document
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('job_id', job_id)

      if (docError) {
        console.error('Error deleting document:', docError)
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Job cleaned up successfully. You can now retry the upload.',
      job_id,
      manual_id: doc?.manual_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error retrying upload:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
