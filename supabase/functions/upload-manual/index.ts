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

// Poll LlamaCloud job status until complete, then trigger webhook processing
async function pollJobCompletion(jobId: string, manualId: string, tenantId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
  
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId })
  
  console.log(`📊 Starting polling for job: ${jobId}`)
  const maxAttempts = 240 // 20 minutes max (5 second intervals)
  let attempt = 0
  
  while (attempt < maxAttempts) {
    attempt++
    
    try {
      // Check job status
      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${llamacloudApiKey}` }
      })
      
      if (!statusResponse.ok) {
        console.error(`❌ Failed to check job status: ${statusResponse.status}`)
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      const statusData = await statusResponse.json()
      console.log(`📊 Job ${jobId} status: ${statusData.status} (attempt ${attempt}/${maxAttempts})`)
      
      // Update progress
      const progressPercent = Math.min(5 + (attempt * 1.5), 95)
      await supabase
        .from('processing_status')
        .update({ 
          progress_percent: Math.round(progressPercent),
          current_task: `LlamaCloud parsing: ${statusData.status}`
        })
        .eq('job_id', jobId)
      
      if (statusData.status === 'SUCCESS') {
        console.log(`✅ Job ${jobId} completed successfully, triggering webhook processing`)
        
        // Fetch the results
        const [markdownResponse, jsonResponse] = await Promise.all([
          fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
            headers: { 'Authorization': `Bearer ${llamacloudApiKey}` }
          }),
          fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
            headers: { 'Authorization': `Bearer ${llamacloudApiKey}` }
          })
        ])
        
        if (!markdownResponse.ok || !jsonResponse.ok) {
          throw new Error(`Failed to fetch results: md=${markdownResponse.status}, json=${jsonResponse.status}`)
        }
        
        const markdownResult = await markdownResponse.json()
        const jsonResult = await jsonResponse.json()
        
        // Call our webhook function directly with the data
        const webhookPayload = {
          data: { job_id: jobId },
          jobId: jobId,
          md: markdownResult.markdown,
          json: jsonResult,
          images: jsonResult.images || [],
          charts: jsonResult.charts || [],
          pages: jsonResult.pages || []
        }
        
        console.log(`🎯 Calling llama-webhook with ${webhookPayload.images.length} images, ${webhookPayload.pages.length} pages`)
        console.log(`📦 Webhook payload keys:`, Object.keys(webhookPayload))
        
        try {
          const webhookResponse = await supabase.functions.invoke('llama-webhook', {
            body: webhookPayload,
            headers: {
              'x-webhook-event-type': 'parse.success',
              'x-webhook-event-id': `poll-${jobId}`,
              'x-signature': webhookSecret
            }
          })
          
          console.log(`📨 Webhook response:`, JSON.stringify(webhookResponse, null, 2))
          
          if (webhookResponse.error) {
            console.error(`❌ Webhook call failed:`, webhookResponse.error)
            await supabase
              .from('processing_status')
              .update({
                status: 'error',
                error_message: `Webhook processing failed: ${JSON.stringify(webhookResponse.error)}`
              })
              .eq('job_id', jobId)
          } else {
            console.log(`✅ Webhook processing completed successfully`)
          }
        } catch (webhookError) {
          console.error(`❌ Exception calling webhook:`, webhookError)
          await supabase
            .from('processing_status')
            .update({
              status: 'error',
              error_message: `Webhook exception: ${webhookError instanceof Error ? webhookError.message : String(webhookError)}`
            })
            .eq('job_id', jobId)
        }
        
        return
      }
      
      if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
        console.error(`❌ Job ${jobId} failed with status: ${statusData.status}`)
        await supabase
          .from('processing_status')
          .update({
            status: 'error',
            stage: 'failed',
            error_message: `LlamaCloud parsing failed: ${statusData.status}`,
            progress_percent: 0
          })
          .eq('job_id', jobId)
        return
      }
      
    } catch (error) {
      console.error(`❌ Error polling job ${jobId}:`, error)
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  // Timeout
  console.error(`❌ Job ${jobId} timed out after ${maxAttempts} attempts`)
  await supabase
    .from('processing_status')
    .update({
      status: 'error',
      error_message: 'Processing timed out after 20 minutes',
      progress_percent: 0
    })
    .eq('job_id', jobId)
}


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
    
    // OCR / Layout - CRITICAL: Enable LlamaCloud OCR for baseline text extraction
    formData.append('disable_ocr', 'false')  // Enable OCR - baseline text extraction
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
    formData.append('return_image_ocr', 'true')  // Get OCR from LlamaCloud as baseline
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
    
    // Start background polling for job completion (don't wait for it)
    console.log('🔄 Starting background job polling...')
    EdgeRuntime.waitUntil(pollJobCompletion(llamaData.id, manual_id, profile.fec_tenant_id))

    console.log('🎉 Document uploaded with LLM parsing, polling started')

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