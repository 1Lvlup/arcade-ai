import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.error('No authorization header')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { manual_id } = await req.json()
    
    if (!manual_id) {
      return new Response(
        JSON.stringify({ error: 'manual_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Deleting manual: ${manual_id} for user: ${user.id}`)

    // Get user's tenant ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id })

    // Verify the document exists (use service role to bypass RLS for check)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, manual_id')
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
      .maybeSingle()

    if (docError) {
      console.error('Error checking document:', docError)
      return new Response(
        JSON.stringify({ error: 'Database error checking manual' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!document) {
      console.error('Document not found for manual_id:', manual_id)
      return new Response(
        JSON.stringify({ error: 'Manual not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete related data in order (due to potential dependencies)
    console.log('Deleting all related data for manual:', manual_id)
    
    // Delete chunks_text
    console.log('Deleting chunks_text...')
    const { error: chunksError } = await supabase
      .from('chunks_text')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (chunksError) console.error('Error deleting chunks_text:', chunksError)

    // Delete rag_chunks
    console.log('Deleting rag_chunks...')
    const { error: ragChunksError } = await supabase
      .from('rag_chunks')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (ragChunksError) console.error('Error deleting rag_chunks:', ragChunksError)

    // Delete figures
    console.log('Deleting figures...')
    const { error: figuresError } = await supabase
      .from('figures')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (figuresError) console.error('Error deleting figures:', figuresError)

    // Delete golden_questions
    console.log('Deleting golden_questions...')
    const { error: questionsError } = await supabase
      .from('golden_questions')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (questionsError) console.error('Error deleting golden_questions:', questionsError)

    // Delete question_evaluations
    console.log('Deleting question_evaluations...')
    const { error: evaluationsError } = await supabase
      .from('question_evaluations')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (evaluationsError) console.error('Error deleting question_evaluations:', evaluationsError)

    // Delete manual_pages
    console.log('Deleting manual_pages...')
    const { error: pagesError } = await supabase
      .from('manual_pages')
      .delete()
      .eq('manual_id', manual_id)
    if (pagesError) console.error('Error deleting manual_pages:', pagesError)

    // Delete processing_status
    console.log('Deleting processing_status...')
    const { error: statusError } = await supabase
      .from('processing_status')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (statusError) console.error('Error deleting processing_status:', statusError)

    // Delete manual_metadata
    console.log('Deleting manual_metadata...')
    const { error: metadataError } = await supabase
      .from('manual_metadata')
      .delete()
      .eq('manual_id', manual_id)
    if (metadataError) console.error('Error deleting manual_metadata:', metadataError)

    // Delete tenant_manual_access
    console.log('Deleting tenant_manual_access...')
    const { error: accessError } = await supabase
      .from('tenant_manual_access')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
    if (accessError) console.error('Error deleting tenant_manual_access:', accessError)

    // Delete storage files from postparse bucket
    console.log('Deleting files from postparse bucket...')
    const { data: postparseFiles, error: listPostparseError } = await supabase.storage
      .from('postparse')
      .list(manual_id)
    
    if (listPostparseError) {
      console.error('Error listing postparse files:', listPostparseError)
    } else if (postparseFiles && postparseFiles.length > 0) {
      const filePaths = postparseFiles.map(file => `${manual_id}/${file.name}`)
      const { error: removePostparseError } = await supabase.storage
        .from('postparse')
        .remove(filePaths)
      if (removePostparseError) console.error('Error removing postparse files:', removePostparseError)
    }

    // Delete storage files from manuals bucket
    console.log('Deleting files from manuals bucket...')
    const { data: manualsFiles, error: listManualsError } = await supabase.storage
      .from('manuals')
      .list(manual_id)
    
    if (listManualsError) {
      console.error('Error listing manuals files:', listManualsError)
    } else if (manualsFiles && manualsFiles.length > 0) {
      const filePaths = manualsFiles.map(file => `${manual_id}/${file.name}`)
      const { error: removeManualsError } = await supabase.storage
        .from('manuals')
        .remove(filePaths)
      if (removeManualsError) console.error('Error removing manuals files:', removeManualsError)
    }

    // Finally delete the document record
    console.log('Deleting document...')
    const { error: documentError } = await supabase
      .from('documents')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)

    if (documentError) {
      console.error('Error deleting document:', documentError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete manual' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully deleted manual: ${manual_id}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Manual deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})