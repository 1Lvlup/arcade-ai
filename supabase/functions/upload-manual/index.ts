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
    formData.append('result_type', 'markdown')
    
    // Use Agent-based parsing with GPT-5
    formData.append('parse_mode', 'parse_page_with_agent')
    formData.append('model', 'openai-gpt-5')
    
    // Enhanced parsing parameters for technical manuals
    formData.append('language', 'en')
    formData.append('disable_ocr', 'false')
    
    // === CORE LAYOUT & OCR ===
    formData.append('high_res_ocr', 'true') // High resolution OCR
    formData.append('layout_aware', 'true') // Preserves section structure and callouts
    formData.append('extract_layout', 'true') // Preserves step numbers and alignment
    formData.append('precise_bounding_box', 'false') // Keep content as text
    formData.append('preserve_very_small_text', 'true') // Keeps tiny pin labels
    formData.append('preserve_layout_alignment_across_pages', 'true') // Maintains alignment
    formData.append('ignore_document_elements_for_layout_detection', 'true') // Use visual model for layout
    
    // === FIGURES & IMAGES ===
    formData.append('save_images', 'true') // Save extracted images
    formData.append('extract_images', 'true') // Extract images from document
    formData.append('extract_figures', 'true') // Extract diagrams and schematics
    formData.append('extract_charts', 'true') // Extract charts
    formData.append('inline_images_in_markdown', 'true') // Include image references in markdown
    formData.append('disable_image_extraction', 'false') // Allow extraction
    
    // === TABLES ===
    formData.append('extract_tables', 'true') // Extract all tables
    formData.append('adaptive_long_table', 'true') // Handle long tables spanning pages
    formData.append('merge_tables_across_pages', 'true') // Merge split tables
    formData.append('merge_tables_across_pages_in_markdown', 'true') // Merge in markdown output
    formData.append('outlined_table_extraction', 'true') // Good for pinouts/BOMs
    formData.append('output_tables_as_html', 'true') // Render tables as HTML
    
    // === JOB BEHAVIOR / CACHING ===
    formData.append('invalidate_cache', 'true') // Ensure fresh parsing
    formData.append('do_not_cache', 'true') // Don't cache
    formData.append('take_screenshot', 'true') // Force page screenshots
    formData.append('split_by_page', 'false') // Keep document structure intact
    formData.append('include_page_breaks', 'true') // Preserve pagination
    formData.append('fast_mode', 'false') // Thorough processing
    formData.append('replace_failed_page_mode', 'raw_text') // Fallback to raw text if page fails
    
    // === PAGE SEPARATORS ===
    formData.append('hide_headers', 'true') 
    formData.append('hide_footers', 'true')
    formData.append('page_separator', '\r\n\r\n<!-- Page {pageNumber} Start -->\r\n\r\n')
    
    // === PROMPTS ===
    // System prompt append for formatting rules
    formData.append('system_prompt_append', `You are parsing a technical arcade game manual for downstream retrieval. Output clean, human-readable markdown per page — no decorative noise.
Rules:
- Skip purely decorative cover/title pages unless they contain unique technical info.
- Remove repeated headers/footers, page numbers, watermarks.
- Keep headings, menu labels, units, codes (E01, SW5, AA6166), wire colors, and part numbers EXACTLY.
- Merge hyphenated line breaks; keep numbered steps intact; render tables as readable markdown.
- Preserve page order and start each page with "### Page {n}".
- Do not invent content or captions; omit unreadable text.`)
    
    // User prompt for per-document hints
    formData.append('user_prompt', `Goal: produce clean per-page markdown for arcade manuals, easy to chunk later.
Output:
- One continuous markdown doc split by "### Page {n}" (1-based pages).
- Headings merged with first body (no title-only blocks).
- Tables converted to markdown; parameter names/values verbatim.
- Leave images out; if the page names a figure, keep the text name only.`)
    
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
        stage: 'ai_agent_parsing',
        current_task: 'GPT-5 agent parsing with vision analysis',
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
      parsing_mode: 'agent_gpt5',
      features: [
        'Agent-based parsing with GPT-5',
        'High-resolution OCR',
        'Advanced chart & figure extraction',
        'Layout-aware parsing',
        'Table merging across pages',
        'Screenshot capture per page'
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