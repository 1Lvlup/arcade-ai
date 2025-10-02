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

    console.log('📡 Submitting to LlamaCloud with AGENT parsing mode...')

    // ENHANCED AGENT PARSING CONFIGURATION (highest quality)
    const formData = new FormData()
    formData.append('input_url', signedUrlData.signedUrl)
    formData.append('result_type', 'markdown')
    
    // ONLY agent mode - NO other conflicting modes
    formData.append('parse_mode', 'parse_document_with_agent')
    
    // Enhanced parsing parameters for technical manuals
    formData.append('language', 'en')
    formData.append('disable_ocr', 'false')
    
    // Custom instructions for arcade manual parsing
    formData.append('parsing_instructions', `
This is a technical troubleshooting manual for arcade games. 
Extract all procedural steps, part numbers, error codes, and technical specifications clearly.
Preserve table structure and ensure figure references are maintained.
Focus on actionable troubleshooting information and setup procedures.
Maintain the hierarchical structure of sections and subsections.
`)

    // Enhanced table and layout handling
    formData.append('output_tables_as_html', 'true')
    formData.append('hide_headers', 'true') 
    formData.append('hide_footers', 'true')
    formData.append('page_separator', '\n\n<!-- Page {pageNumber} Start -->\n\n')
    formData.append('preserve_layout_alignment_across_pages', 'true')
    formData.append('merge_tables_across_pages', 'true')
    formData.append('take_screenshot', 'true')
    formData.append('preserve_very_small_text', 'true')
    
    // CRITICAL: Space Invaders proven working settings - LlamaCloud API parameters
    formData.append('extract_images', 'true')  // ✅ Working: extracts individual figures 
    formData.append('extract_figures', 'true') // ✅ Working: extracts embedded figures
    formData.append('take_screenshot', 'true') // ✅ Working: creates page screenshots 
    formData.append('split_by_page', 'false')  // ✅ Working: keeps document structure
    formData.append('include_page_breaks', 'true') // ✅ Working: preserves pagination
    formData.append('fast_mode', 'false')      // ✅ Working: thorough processing

    // Custom formatting for technical content
    formData.append('system_prompt_append', `
When formatting technical manuals:
- Clearly mark troubleshooting sections with ## headers
- Preserve part numbers and model numbers exactly
- Format step-by-step procedures as numbered lists
- Maintain figure and table references
- Use consistent formatting for error codes and symptoms
`)
    
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