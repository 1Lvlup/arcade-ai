import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const llamacloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!
const webhookSecret = Deno.env.get('LLAMACLOUD_WEBHOOK_SECRET') || 'your-secret-verification-token'

// NOTE: Removed pollJobCompletion function - we rely solely on LlamaCloud webhook
// The webhook is configured during upload and fires when parsing completes.
// Background polling was unreliable due to Edge Function timeouts (~120-150s max).


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

    // Generate clean manual_id from title
    const baseSlug = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
    
    // Check if this manual_id already exists and find a unique one
    let manual_id = baseSlug
    let suffix = 1
    
    while (true) {
      const { data: existing } = await supabase
        .from('documents')
        .select('manual_id')
        .eq('manual_id', manual_id)
        .maybeSingle()
      
      if (!existing) {
        break // Found a unique ID
      }
      
      suffix++
      manual_id = `${baseSlug}-${suffix}`
    }

    console.log('Generated manual_id:', manual_id)

    // Create signed URL for the document
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('manuals')
      .createSignedUrl(storagePath, 86400) // 24 hours

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      throw signedUrlError
    }

    console.log('📡 Submitting to LlamaCloud with LLM parsing...')

    // LLM PARSING
    const formData = new FormData()
    formData.append('input_url', signedUrlData.signedUrl)
    const displayName = title.endsWith('.pdf') ? title : `${title}.pdf`
    formData.append('file_name', displayName)
    formData.append('result_type', 'markdown')
    
    // Parse with Agent mode and GPT-5
    formData.append('parse_mode', 'parse_page_with_agent')
    formData.append('model', 'openai-gpt-5')
    
    // Pages & Markers
    formData.append('page_prefix', '<!-- Page {pageNumber} Start -->')
    formData.append('page_suffix', '<!-- Page {pageNumber} End -->')
    formData.append('page_separator', '______________________________')
    
    // OCR / Layout - OCR disabled, we handle it in captioning phase
    formData.append('disable_ocr', 'true')  // Disable OCR - we do it ourselves
    formData.append('extract_layout', 'true')
    formData.append('preserve_layout_alignment_across_pages', 'true')
    formData.append('hide_headers', 'false')  // KEEP headers - they have page numbers!
    formData.append('hide_footers', 'false')  // KEEP footers - they have page numbers!
    formData.append('ignore_document_elements_for_layout_detection', 'true')
    
    // Tables
    formData.append('adaptive_long_table', 'true')
    formData.append('outlined_table_extraction', 'true')
    formData.append('output_tables_as_HTML', 'true')
    formData.append('compact_markdown_table', 'true')
    formData.append('return_table_structures', 'true')
    
    // Images - CRITICAL: save_images tells LlamaCloud to make images available via API
    formData.append('save_images', 'true')
    formData.append('extract_charts', 'true')
    formData.append('specialized_image_parsing', 'true')
    formData.append('precise_bounding_box', 'true')
    formData.append('inline_images_in_markdown', 'true')
    formData.append('return_image_ocr', 'false')  // Don't get OCR from LlamaCloud
    formData.append('return_images', 'true')
    
    // Caching/behavior
    formData.append('invalidate_cache', 'true')
    formData.append('do_not_cache', 'true')
    formData.append('replace_failed_page_mode', 'raw_text')
    
    // Enhanced system prompt
    const systemPromptAppend = `Label EVERY picture as "Figure {N}" in chronological order PER PAGE. Output clean per-page markdown for downstream retrieval. Convert tables to markdown. Preserve units/codes/part numbers exactly. Clearly label each page with page number`
    formData.append('system_prompt_append', systemPromptAppend)
    
    // Webhook configuration - CRITICAL: Must be array format
    console.log('📡 Configuring webhook:', `${supabaseUrl}/functions/v1/llama-webhook`)
    const webhookConfig = [{
      webhook_url: `${supabaseUrl}/functions/v1/llama-webhook`,
      webhook_events: ['parse.success', 'parse.error'],
      webhook_headers: {
        'x-signature': webhookSecret
      }
    }]
    console.log('🔧 Webhook config:', JSON.stringify(webhookConfig, null, 2))
    formData.append('webhook_configurations', JSON.stringify(webhookConfig))

    const llamaResponse = await fetch('https://api.cloud.llamaindex.ai/api/v1/parsing/upload', {
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

    // Store document info in database with full storage path
    const { error: insertError } = await supabase
      .from('documents')
      .insert({
        manual_id,
        title,
        source_filename: storagePath.split('/').pop(),
        storage_path: storagePath, // Store full path for later deletion/signed URL generation
        job_id: llamaData.id,
        fec_tenant_id: profile.fec_tenant_id
      })

    if (insertError) {
      console.error('Error inserting document:', insertError)
      throw insertError
    }

    // Grant tenant access to this manual
    const { error: accessError } = await supabase
      .from('tenant_manual_access')
      .insert({
        fec_tenant_id: profile.fec_tenant_id,
        manual_id: manual_id,
        granted_by: user.id
      })

    if (accessError) {
      console.error('Error granting tenant access:', accessError)
      // Don't throw - this is not critical, just log it
    }

    // Create initial processing status
    const { error: statusError } = await supabase
      .from('processing_status')
      .insert({
        job_id: llamaData.id,
        manual_id,
        status: 'processing',
        stage: 'agent_parsing',
        current_task: 'LlamaCloud parsing with GPT-5 Agent - polling for completion',
        fec_tenant_id: profile.fec_tenant_id,
        progress_percent: 5
      })

    if (statusError) {
      console.error('Error creating processing status:', statusError)
    }
    
    // Webhook will handle processing completion - no polling needed
    console.log('✅ Document uploaded, webhook configured for completion notification')

    return new Response(JSON.stringify({ 
      success: true, 
      job_id: llamaData.id,
      manual_id,
      parsing_mode: 'parse_page_with_agent',
      features: [
        'GPT-5 Agent per-page parsing',
        'Precise bounding box extraction',
        'Specialized image parsing',
        'Inline image descriptions',
        'Layout-aware processing'
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