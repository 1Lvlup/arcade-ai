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

    console.log('🧹 Cleaning up duplicate failed chunks for manual:', manual_id)

    // Find all failed chunks
    const { data: failedChunks, error: fetchError } = await supabase
      .from('manual_chunk_queue')
      .select('id, chunk_id, content_hash')
      .eq('manual_id', manual_id)
      .eq('status', 'failed')

    if (fetchError) {
      console.error('❌ Error fetching failed chunks:', fetchError)
      throw fetchError
    }

    console.log(`Found ${failedChunks?.length || 0} failed chunks`)

    if (!failedChunks || failedChunks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No failed chunks to clean up',
        deleted_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check which failed chunks have corresponding done chunks
    const chunkIds = failedChunks.map(c => c.chunk_id).filter(Boolean)
    const contentHashes = failedChunks.map(c => c.content_hash).filter(Boolean)

    const { data: doneChunks, error: doneError } = await supabase
      .from('manual_chunk_queue')
      .select('chunk_id, content_hash')
      .eq('manual_id', manual_id)
      .eq('status', 'done')
      .or(`chunk_id.in.(${chunkIds.join(',')}),content_hash.in.(${contentHashes.join(',')})`)

    if (doneError) {
      console.error('❌ Error fetching done chunks:', doneError)
      throw doneError
    }

    console.log(`Found ${doneChunks?.length || 0} done chunks`)

    // Build set of done chunk identifiers
    const doneChunkIds = new Set(doneChunks?.map(c => c.chunk_id) || [])
    const doneContentHashes = new Set(doneChunks?.map(c => c.content_hash) || [])

    // Find failed chunks that are duplicates
    const duplicateIds = failedChunks
      .filter(fc => 
        (fc.chunk_id && doneChunkIds.has(fc.chunk_id)) ||
        (fc.content_hash && doneContentHashes.has(fc.content_hash))
      )
      .map(fc => fc.id)

    console.log(`Identified ${duplicateIds.length} duplicate failed chunks to delete`)

    if (duplicateIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No duplicate failed chunks found',
        deleted_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete the duplicates
    const { error: deleteError } = await supabase
      .from('manual_chunk_queue')
      .delete()
      .in('id', duplicateIds)

    if (deleteError) {
      console.error('❌ Error deleting duplicate chunks:', deleteError)
      throw deleteError
    }

    console.log(`✅ Deleted ${duplicateIds.length} duplicate failed chunks`)

    return new Response(JSON.stringify({ 
      success: true,
      message: `Cleaned up ${duplicateIds.length} duplicate failed chunks`,
      deleted_count: duplicateIds.length,
      manual_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in cleanup-duplicate-chunks:', error)
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
