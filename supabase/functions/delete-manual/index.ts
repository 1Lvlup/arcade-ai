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

    // Verify the document exists and belongs to the user's tenant
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, manual_id')
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)
      .single()

    if (docError || !document) {
      console.error('Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Manual not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete related data in order (due to potential dependencies)
    console.log('Deleting chunks...')
    const { error: chunksError } = await supabase
      .from('chunks_text')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)

    if (chunksError) {
      console.error('Error deleting chunks:', chunksError)
    }

    console.log('Deleting figures...')
    const { error: figuresError } = await supabase
      .from('figures')
      .delete()
      .eq('manual_id', manual_id)
      .eq('fec_tenant_id', profile.fec_tenant_id)

    if (figuresError) {
      console.error('Error deleting figures:', figuresError)
    }

    console.log('Deleting manual_metadata...')
    const { error: metadataError } = await supabase
      .from('manual_metadata')
      .delete()
      .eq('manual_id', manual_id)

    if (metadataError) {
      console.error('Error deleting manual_metadata:', metadataError)
    }

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