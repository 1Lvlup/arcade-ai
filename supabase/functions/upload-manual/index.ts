import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const llamacloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const { title, storagePath } = await req.json()
    console.log('🚀 PREMIUM Processing upload for:', { title, storagePath })

    // Extract tenant from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(jwt)
    
    if (!user) {
      throw new Error('Invalid user')
    }

    // Get user's FEC tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      throw new Error('User profile not found')
    }

    // Set tenant context
    await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id })

    // Generate manual_id from title
    const manual_id = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40) + '-' + Date.now()

    console.log('Generated manual_id:', manual_id)

    // Create signed URL for the document
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('manuals')
      .createSignedUrl(storagePath, 86400) // 24 hours

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      throw signedUrlError
    }

    console.log('📡 Submitting to LlamaCloud with PREMIUM parsing options...')

    // PREMIUM PARSING CONFIGURATION
    const formData = new FormData()
    formData.append('input_url', signedUrlData.signedUrl)
    formData.append('result_type', 'markdown')
    
    // PREMIUM MODE: Agent-based parsing (highest quality)
    formData.append('parse_mode', 'parse_page_with_agent')
    formData.append('premium_mode', 'true')
    
    // Enhanced OCR and language detection
    formData.append('language', 'en,es,fr,de,it,pt,ja,ko,zh,ar,ru')
    formData.append('disable_ocr', 'false')
    
    // Advanced table and structure extraction
    formData.append('output_tables_as_HTML', 'true')
    formData.append('spreadsheet_extract_sub_tables', 'true')
    formData.append('preserve_layout_alignment_across_pages', 'true')
    
    // Image and figure processing
    formData.append('disable_image_extraction', 'false')
    formData.append('take_screenshot', 'true')
    
    // Enhanced chunking and structure
    formData.append('page_separator', '\\n\\n---\\n## Page {pageNumber}\\n\\n')
    formData.append('page_prefix', '<!-- Page {pageNumber} Start -->\\n')
    formData.append('page_suffix', '\\n<!-- Page {pageNumber} End -->')
    
    // Skip headers/footers (top 5%, bottom 5%)
    formData.append('bounding_box', '0.05,0,0.05,0')
    
    // Multi-modal vision model for complex documents
    formData.append('use_vendor_multimodal_model', 'true')
    formData.append('vendor_multimodal_model_name', 'anthropic-sonnet-3.7')
    
    // Quality options for arcade manuals
    formData.append('skip_diagonal_text', 'false') // Keep diagonal text
    
    // Webhook for processing results
    formData.append('webhook_url', `${supabaseUrl}/functions/v1/llama-webhook`)

    const llamaResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llamacloudApiKey}`,
      },
      body: formData,
    })

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text()
      console.error('❌ LlamaCloud PREMIUM parsing error:', errorText)
      throw new Error(`LlamaCloud API error: ${llamaResponse.status} - ${errorText}`)
    }

    const llamaData = await llamaResponse.json()
    console.log('✅ LlamaCloud PREMIUM response:', llamaData)

    // Store document info in database
    const { error: insertError } = await supabase
      .from('documents')
      .insert({
        manual_id,
        title,
        source_filename: storagePath.split('/').pop(),
        job_id: llamaData.id,
        fec_tenant_id: profile.fec_tenant_id
      })

    if (insertError) {
      console.error('Error inserting document:', insertError)
      throw insertError
    }

    // Create initial processing status
    const { error: statusError } = await supabase
      .from('processing_status')
      .insert({
        job_id: llamaData.id,
        manual_id,
        status: 'processing',
        stage: 'premium_parsing',
        current_task: 'Premium AI Agent parsing with Sonnet 3.7 vision model',
        fec_tenant_id: profile.fec_tenant_id,
        progress_percent: 0
      })

    if (statusError) {
      console.error('Error creating processing status:', statusError)
    }

    console.log('🎉 Document uploaded with PREMIUM parsing features')

    return new Response(JSON.stringify({ 
      success: true, 
      job_id: llamaData.id,
      manual_id,
      parsing_mode: 'premium_agent',
      features: [
        'AI Agent parsing (highest quality)',
        'Anthropic Sonnet 3.7 vision model',
        'Advanced table extraction as HTML',
        'Multi-language OCR support',
        'Structured figure extraction',
        'Layout preservation across pages',
        'Hierarchical chunking strategies'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in PREMIUM upload-manual:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})