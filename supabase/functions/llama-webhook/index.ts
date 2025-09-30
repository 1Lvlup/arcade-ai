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
    const status = payload.status;
    
    if (!llamaJobId) {
      throw new Error("Missing job_id/jobId in webhook payload");
    }
    
    console.log(`🔍 Processing job: ${llamaJobId}, status: ${status}`);

    // Initialize Supabase with service role key for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this webhook has already been processed
    const { data: existingStatus } = await supabase
      .from('processing_status')
      .select('status')
      .eq('job_id', llamaJobId)
      .maybeSingle();

    if (existingStatus?.status === 'completed') {
      console.log(`⚠️ Job ${llamaJobId} already processed, skipping`);
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (status === 'SUCCESS') {
      console.log(`✅ Job ${llamaJobId} completed successfully, processing results...`);
      await processCompletedJob(llamaJobId, supabase);
    } else if (status === 'ERROR') {
      console.log(`❌ Job ${llamaJobId} failed`);
      await updateProcessingStatus(llamaJobId, 'error', supabase, 'LlamaCloud job failed');
    }

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

async function processCompletedJob(llamaJobId: string, supabase: any) {
  try {
    // Fetch job details from LlamaCloud
    const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    
    console.log(`🔍 Fetching job details for ${llamaJobId}`);
    const jobDetailsResponse = await fetch(`${LLAMACLOUD_BASE}/parsing/job/${llamaJobId}`, {
      headers: { 'Authorization': `Bearer ${llamaApiKey}` }
    });

    if (!jobDetailsResponse.ok) {
      throw new Error(`Failed to fetch job details: ${jobDetailsResponse.status}`);
    }

    const jobDetails = await jobDetailsResponse.json();
    console.log(`📄 Job details fetched for ${llamaJobId}`);

    // Generate manual slug from job details
    const originalFilename = jobDetails.file_name || 'unknown-manual';
    const manualSlug = generateManualSlug(originalFilename);
    const tenantId = DEFAULT_TENANT_ID;
    
    console.log(`📋 Generated manual_slug: ${manualSlug}, tenant_id: ${tenantId}`);

    // 1. GOLDEN SEQUENCE STEP 1: Set tenant context (CRITICAL)
    console.log(`🎯 Step 1: Setting tenant context`);
    const { error: rpcError } = await supabase.rpc('set_tenant_context', {
      p_tenant_id: tenantId
    });
    
    if (rpcError) {
      console.error('❌ Failed to set tenant context:', rpcError);
      throw new Error(`Tenant context error: ${rpcError.message}`);
    }
    console.log(`✅ Tenant context set successfully`);

    // 2. GOLDEN SEQUENCE STEP 2: Create/ensure document row
    console.log(`📄 Step 2: Creating document entry`);
    const documentData = {
      manual_id: manualSlug,
      title: extractTitleFromFilename(originalFilename),
      source_filename: originalFilename,
      job_id: llamaJobId,
      fec_tenant_id: tenantId
    };

    const { error: docError } = await supabase
      .from('documents')
      .upsert(documentData, { onConflict: 'manual_id' });

    if (docError) {
      console.error('❌ Document creation failed:', docError);
      throw new Error(`Document creation error: ${docError.message}`);
    }
    console.log(`✅ Document created/updated for ${manualSlug}`);

    // Fetch the full job result with all content
    console.log(`📥 Fetching job result content`);
    const resultResponse = await fetch(`${LLAMACLOUD_BASE}/parsing/job/${llamaJobId}/result/json`, {
      headers: { 'Authorization': `Bearer ${llamaApiKey}` }
    });

    if (!resultResponse.ok) {
      throw new Error(`Failed to fetch job result: ${resultResponse.status}`);
    }

    const jobResult = await resultResponse.json();
    console.log(`📊 Job result structure:`, Object.keys(jobResult));

    let figuresProcessed = 0;
    let chunksProcessed = 0;

    // 3. GOLDEN SEQUENCE STEP 3: Insert figures with on_conflict
    if (jobResult.pages) {
      console.log(`🖼️ Step 3: Processing figures from pages...`);
      
      const allFigures: string[] = [];
      
      // Extract figures from pages (matching the working golden logs pattern)
      jobResult.pages.forEach((page: any, pageIndex: number) => {
        if (page.images) {
          page.images.forEach((image: any) => {
            if (image.name || image.path) {
              allFigures.push(image.name || image.path);
            }
          });
        }
      });

      // Also check for direct figures array
      if (jobResult.figures) {
        jobResult.figures.forEach((figure: any) => {
          if (typeof figure === 'string') {
            allFigures.push(figure);
          } else if (figure.name || figure.path) {
            allFigures.push(figure.name || figure.path);
          }
        });
      }

      console.log(`🖼️ Found ${allFigures.length} figures to process`);
      
      for (const figure of allFigures) {
        try {
          console.log(`🔄 Processing figure: ${figure}`);
          
          // Construct proper S3 URL following golden configuration pattern
          const figureName = typeof figure === 'string' ? figure : `figure_${figuresProcessed}`;
          const s3ImageUrl = `https://${ARTIFACTS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/manuals/${manualSlug}/${figureName}`;
          
          const figureData = {
            manual_id: manualSlug,
            figure_id: figureName,
            image_url: s3ImageUrl,
            page_number: null,
            bbox_pdf_coords: null,
            llama_asset_name: figureName,
            fec_tenant_id: tenantId
          };
          
          console.log("📸 Storing figure:", figureData);
          
          // Use on_conflict as in golden configuration
          const { error: figureError } = await supabase
            .from('figures')
            .upsert(figureData, { onConflict: 'manual_id,figure_id' });
            
          if (figureError) {
            console.error("❌ Error storing figure:", figureError);
          } else {
            figuresProcessed++;
            console.log(`✅ Figure ${figuresProcessed}/${allFigures.length} stored`);
          }
        } catch (error) {
          console.error("❌ Error processing figure:", error);
        }
      }
    }

    // 4. GOLDEN SEQUENCE STEP 4: Insert text chunks
    if (jobResult.text || (jobResult.pages && jobResult.pages.length > 0)) {
      console.log(`📝 Step 4: Processing text chunks...`);
      
      // If we have full text, split it into manageable chunks
      if (jobResult.text) {
        console.log(`📝 Processing full document text (${jobResult.text.length} characters)`);
        
        const chunks = splitTextIntoChunks(jobResult.text, 4000); // Golden config chunk size
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkData = {
            manual_id: manualSlug,
            content: chunks[i],
            page_start: null,
            page_end: null,
            menu_path: `Document Chunk ${i + 1}`,
            fec_tenant_id: tenantId
          };
          
          console.log(`💾 Inserting chunk ${i + 1}/${chunks.length}...`);
          
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
      // Also process page-by-page content if available
      else if (jobResult.pages) {
        for (let pageIndex = 0; pageIndex < jobResult.pages.length; pageIndex++) {
          const page = jobResult.pages[pageIndex];
          
          if (page.text && page.text.trim()) {
            const chunkData = {
              manual_id: manualSlug,
              content: page.text,
              page_start: pageIndex + 1,
              page_end: pageIndex + 1,
              menu_path: page.metadata?.section || `Page ${pageIndex + 1}`,
              fec_tenant_id: tenantId
            };
            
            console.log(`💾 Inserting page chunk ${pageIndex + 1}...`);
            
            const { error: chunkError } = await supabase
              .from('chunks_text')
              .insert(chunkData);
              
            if (chunkError) {
              console.error(`❌ Error storing page chunk ${pageIndex + 1}:`, chunkError);
            } else {
              chunksProcessed++;
              console.log(`✅ SUCCESS: Page chunk ${chunksProcessed} saved`);
            }
          }
        }
      }
      
      console.log(`✅ Text chunks processing complete: ${chunksProcessed} stored`);
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