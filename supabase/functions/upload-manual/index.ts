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
const webhookSecret = Deno.env.get('LLAMACLOUD_WEBHOOK_SECRET') || 'your-secret-verification-token'

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
    formData.append('file_name', displayName) // Use the user's entered title
    formData.append('result_type', 'markdown')
    
    // Parse Document with LLM mode (cleaner output, fewer junk images)
    formData.append('parse_mode', 'parse_document_with_llm')
    
    // Pages & Markers (HTML comments for webhook regex)
    formData.append('page_prefix', '<!-- Page {page} Start -->')
    formData.append('page_suffix', '<!-- Page {page} End -->')
    formData.append('page_separator', '')
    
    // OCR / Layout
    formData.append('language', 'en')
    formData.append('disable_ocr', 'false')
    formData.append('high_res_ocr', 'true')
    formData.append('extract_layout', 'true')
    formData.append('preserve_very_small_text', 'true')
    formData.append('remove_hidden_text', 'false')
    formData.append('hide_headers', 'true')
    formData.append('hide_footers', 'true')
    formData.append('html_remove_fixed_elements', 'true')
    formData.append('html_remove_navigation_elements', 'true')
    
    // Tables
    formData.append('adaptive_long_table', 'true')
    formData.append('outlined_table_extraction', 'true')
    formData.append('compact_markdown_table', 'true')
    formData.append('merge_tables_across_pages_in_markdown', 'true')
    formData.append('output_tables_as_html', 'false')
    
    // Images (keep useful figures, avoid full-page screenshots)
    formData.append('save_images', 'true')
    formData.append('inline_images_in_markdown', 'false')
    formData.append('disable_image_extraction', 'false')
    formData.append('take_screenshot', 'false')
    formData.append('extract_charts', 'false')
    
    // Caching/behavior
    formData.append('invalidate_cache', 'true')
    formData.append('do_not_cache', 'true')
    formData.append('fast_mode', 'false')
    formData.append('replace_failed_page_mode', 'raw_text')
    
    // Enhanced system prompt
    const systemPromptAppend = `You are parsing a technical arcade game manual for downstream retrieval. Output clean per-page markdown only. Skip decorative noise. Remove repeated headers/footers and watermarks. Keep headings/labels/units/codes/part numbers EXACTLY. Merge hyphenated line breaks. Keep numbered steps intact. Convert tables to readable markdown. Do not inline images. Deduplicate exact repeats. Do not invent content.`
    formData.append('system_prompt_append', systemPromptAppend)
    formData.append('user_prompt', '')
    
    // Webhook with verification headers
    const webhookConfig = JSON.stringify([{
      webhook_url: `${supabaseUrl}/functions/v1/llama-webhook`,
      webhook_headers: {
        'x-signature': webhookSecret,
        'content-type': 'application/json'
      },
      webhook_events: ['parse.success', 'parse.error']
    }])
    formData.append('webhook_configurations', webhookConfig)

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
        stage: 'document_llm_parsing',
        current_task: 'LlamaCloud parsing document with LLM',
        fec_tenant_id: profile.fec_tenant_id,
        progress_percent: 0
      })

    if (statusError) {
      console.error('Error creating processing status:', statusError)
    }

    console.log('🎉 Document uploaded with LLM parsing')

    return new Response(JSON.stringify({ 
      success: true, 
      job_id: llamaData.id,
      manual_id,
      parsing_mode: 'parse_document_with_llm',
      features: [
        'Document-level LLM parsing',
        'High-resolution OCR',
        'Image extraction with filtering',
        'Layout-aware parsing',
        'Table merging across pages'
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