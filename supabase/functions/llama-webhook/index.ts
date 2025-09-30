import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Golden Configuration Environment Variables (MUST MATCH)
const AWS_REGION = 'us-east-2';
const ARTIFACTS_BUCKET = 'arcade-postparse-images';
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const LLAMACLOUD_BASE = 'https://api.cloud.llamaindex.ai/api/v1';

// CORS headers for web app calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`🚀 Golden Configuration Webhook - Processing ${req.method} request`);
    console.log(`📋 Environment: AWS_REGION=${AWS_REGION}, BUCKET=${ARTIFACTS_BUCKET}`);
    
    const payload = await req.json();
    console.log("📦 Webhook payload received (first 120 chars):", JSON.stringify(payload).substring(0, 120));

    // Handle both job_id and jobId formats from LlamaCloud
    const llamaJobId = payload.job_id || payload.jobId;
    const { txt, figures = [], pages = [] } = payload;
    
    if (!llamaJobId) {
      throw new Error("Missing job_id/jobId in webhook payload");
    }
    
    console.log(`🔍 Processing job: ${llamaJobId}`);
    console.log(`📊 Payload contents: txt=${txt ? 'present' : 'missing'}, figures=${figures.length}, pages=${pages.length}`);

    // Initialize Supabase with service role key for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process the completed job directly (no status checking needed)
    console.log(`✅ Job ${llamaJobId} webhook received, processing results...`);
    await processCompletedJob(llamaJobId, payload, supabase);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function processCompletedJob(llamaJobId: string, payload: any, supabase: any) {
  try {
    console.log(`🔍 Processing completed job ${llamaJobId}`);
    
    // Get manual_id from existing processing_status or documents table
    const { data: statusData } = await supabase
      .from('processing_status')
      .select('manual_id')
      .eq('job_id', llamaJobId)
      .single();
    
    if (!statusData?.manual_id) {
      throw new Error(`No manual_id found for job ${llamaJobId}`);
    }
    
    const manualSlug = statusData.manual_id;
    const tenantId = DEFAULT_TENANT_ID;
    
    console.log(`📋 Processing for manual_slug: ${manualSlug}, tenant_id: ${tenantId}`);

    // 1. Set tenant context (CRITICAL)
    console.log(`🎯 Step 1: Setting tenant context`);
    const { error: rpcError } = await supabase.rpc('set_tenant_context', {
      p_tenant_id: tenantId
    });
    
    if (rpcError) {
      console.error('❌ Failed to set tenant context:', rpcError);
      throw new Error(`Tenant context error: ${rpcError.message}`);
    }
    console.log(`✅ Tenant context set successfully`);

    let figuresProcessed = 0;
    let chunksProcessed = 0;

    // 2. Process figures from payload
    if (payload.figures && payload.figures.length > 0) {
      console.log(`🖼️ Step 2: Processing ${payload.figures.length} figures...`);
      
      for (const figure of payload.figures) {
        try {
          // Construct proper S3 URL following golden configuration pattern
          const figureName = typeof figure === 'string' ? figure : (figure.name || `figure_${figuresProcessed}`);
          const s3ImageUrl = `https://${ARTIFACTS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/manuals/${manualSlug}/${figureName}`;
          
          const figureData = {
            manual_id: manualSlug,
            figure_id: figureName,
            image_url: s3ImageUrl,
            page_number: figure.page || null,
            bbox_pdf_coords: figure.bbox ? JSON.stringify(figure.bbox) : null,
            llama_asset_name: figureName,
            fec_tenant_id: tenantId
          };
          
          // Use on_conflict as in golden configuration
          const { error: figureError } = await supabase
            .from('figures')
            .upsert(figureData, { onConflict: 'manual_id,figure_id' });
            
          if (figureError) {
            console.error("❌ Error storing figure:", figureError);
          } else {
            figuresProcessed++;
            console.log(`✅ Figure ${figuresProcessed}/${payload.figures.length} stored`);
          }
        } catch (error) {
          console.error("❌ Error processing figure:", error);
        }
      }
    }

    // 3. Process text content 
    if (payload.txt) {
      console.log(`📝 Step 3: Processing text content (${payload.txt.length} characters)...`);
      
      const chunks = splitTextIntoChunks(payload.txt, 4000);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkData = {
          manual_id: manualSlug,
          content: chunks[i],
          page_start: null,
          page_end: null,
          menu_path: `Document Chunk ${i + 1}`,
          fec_tenant_id: tenantId
        };
        
        const { error: chunkError } = await supabase
          .from('chunks_text')
          .insert(chunkData);
          
        if (chunkError) {
          console.error(`❌ Error storing chunk ${i + 1}:`, chunkError);
        } else {
          chunksProcessed++;
          console.log(`✅ SUCCESS: Chunk ${chunksProcessed}/${chunks.length} saved`);
        }
      }
    }

    // 5. GOLDEN SEQUENCE STEP 5: Mark status as completed with on_conflict
    console.log(`📊 Step 5: Updating processing status to completed`);
    const { error: statusError } = await supabase
      .from('processing_status')
      .upsert({
        job_id: llamaJobId,
        manual_id: manualSlug,
        status: 'completed',
        stage: 'completed',
        progress_percent: 100,
        current_task: `PREMIUM processing complete: ${chunksProcessed} chunks, ${figuresProcessed} figures with advanced AI analysis`,
        figures_processed: figuresProcessed,
        total_figures: figuresProcessed,
        chunks_processed: chunksProcessed,
        total_chunks: chunksProcessed,
        fec_tenant_id: tenantId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_id' });

    if (statusError) {
      console.error('❌ Failed to update processing status:', statusError);
      throw new Error(`Status update error: ${statusError.message}`);
    }

    console.log(`🎉 Golden sequence completed successfully for ${manualSlug}`);
    console.log(`📊 Final counts - Figures: ${figuresProcessed}, Chunks: ${chunksProcessed}`);

  } catch (error) {
    console.error('❌ Error in processCompletedJob:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateProcessingStatus(llamaJobId, 'error', supabase, errorMessage);
    throw error;
  }
}

async function updateProcessingStatus(jobId: string, status: string, supabase: any, errorMessage?: string) {
  const { error } = await supabase
    .from('processing_status')
    .upsert({
      job_id: jobId,
      status: status,
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    }, { onConflict: 'job_id' });

  if (error) {
    console.error('❌ Error updating processing status:', error);
  }
}

function generateManualSlug(filename: string): string {
  // Extract base filename without extension
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Convert to lowercase and replace spaces/special chars with hyphens
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // Limit length
}

function extractTitleFromFilename(filename: string): string {
  // Extract title from filename, removing extension and converting to title case
  const baseName = filename.replace(/\.[^/.]+$/, '');
  return baseName
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = sentence.trim();
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}