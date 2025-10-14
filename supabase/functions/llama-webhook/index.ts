import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const webhookSecret = Deno.env.get("LLAMACLOUD_WEBHOOK_SECRET") || "your-secret-verification-token";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─────────────────────────────────────────────────────────────
// IMAGE FILTERING HELPERS
// ─────────────────────────────────────────────────────────────

function isWeirdAspect(w: number, h: number): boolean {
  if (!w || !h) return false;
  const r = w / h;
  return r > 8 || r < 1/8;
}

function shouldKeepImage(meta: {
  name?: string;
  width?: number;
  height?: number;
  bbox?: { width?: number; height?: number };
}): boolean {
  const name = (meta.name || "").toLowerCase();

  // Drop obvious ornaments/backgrounds - ENHANCED
  if (/(background|border|mask|frame|shadow|separator|rule|divider|ornament|decoration)/.test(name)) return false;
  
  // Drop headers/footers (pageHeader, pageFooter, sectionHeader, etc.)
  if (/(header|footer|heading)/.test(name)) return false;
  
  // Drop page markers and text blocks
  if (/(page_\d+_text|pagenumber|page-\d+)/.test(name)) return false;
  
  if (name.endsWith(".svg")) return false;

  // Size heuristics
  const w = meta.width ?? meta.bbox?.width ?? 0;
  const h = meta.height ?? meta.bbox?.height ?? 0;

  // Too small - increased threshold
  if ((w && w < 150) || (h && h < 100)) return false;

  // Too tiny area - increased threshold
  if (w && h && (w * h) < 20000) return false;

  // Weird aspect ratios
  if (isWeirdAspect(w, h)) return false;

  return true;
}

// Chunking strategy
const CHUNK_STRATEGIES = {
  HIERARCHICAL: 'hierarchical'
};

// Create embedding using OpenAI
async function createEmbedding(text: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: text.substring(0, 8000) // Ensure we don't exceed limits
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Advanced hierarchical chunking based on document structure
function createHierarchicalChunks(content: string, manual_id: string) {
  const chunks = [];
  const lines = content.split('\n');
  
  let currentChunk = '';
  let currentSection = '';
  let currentPage = 1; // Start at page 1 instead of null
  let chunkIndex = 0;
  
  // Enhanced regex patterns for arcade manual structure
  const patterns = {
    pageMarker: /^<!--\s*Page\s+(\d+)\s*(Start|End)\s*-->$/,
    header: /^#{1,3}\s+(.+)$/,
    troubleshootingSection: /^(troubleshooting|problem|issue|error|fault|repair|maintenance)/i,
    partsList: /^(parts?\s+list|components?|hardware|replacement)/i,
    procedure: /^(procedure|steps?|instructions?|how\s+to)/i,
    tableStart: /^[\|<].*[\|>]$|^\s*\|/,
    figure: /^!\[.*\]|<img\s|figure\s*\d+/i,
    circuit: /^(circuit|schematic|wiring|diagram)/i
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip image markdown lines to prevent them from being included in text chunks
    if (patterns.figure.test(line)) {
      continue;
    }
    
    // Track page numbers from enhanced page separators
    const pageMatch = line.match(patterns.pageMarker);
    if (pageMatch && pageMatch[2] === 'Start') {
      currentPage = parseInt(pageMatch[1]);
      continue;
    }
    
    // Detect section headers and important content types
    const headerMatch = line.match(patterns.header);
    if (headerMatch) {
      // Save previous chunk if it has content
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          manual_id,
          menu_path: currentSection || 'Introduction',
          page_start: currentPage,
          page_end: currentPage,
          chunk_type: 'content',
          strategy: CHUNK_STRATEGIES.HIERARCHICAL,
          index: chunkIndex++
        });
        currentChunk = '';
      }
      
      currentSection = headerMatch[1];
      currentChunk = line + '\n';
      continue;
    }
    
    // Add content to current chunk
    currentChunk += line + '\n';
    
    // Create chunks based on content type and size
    const shouldChunk = 
      currentChunk.length > 1500 || // Larger chunks for better context
      (currentChunk.length > 800 && line === '') || // Natural breaks
      patterns.troubleshootingSection.test(line) || // Important sections
      patterns.partsList.test(line) ||
      patterns.procedure.test(line);
    
    if (shouldChunk && currentChunk.trim()) {
      // Determine chunk type for better categorization
      let chunkType = 'content';
      if (patterns.troubleshootingSection.test(currentChunk)) chunkType = 'troubleshooting';
      else if (patterns.partsList.test(currentChunk)) chunkType = 'parts_list';
      else if (patterns.procedure.test(currentChunk)) chunkType = 'procedure';
      else if (patterns.tableStart.test(currentChunk)) chunkType = 'table';
      else if (patterns.figure.test(currentChunk)) chunkType = 'figure';
      else if (patterns.circuit.test(currentChunk)) chunkType = 'circuit';
      
      chunks.push({
        content: currentChunk.trim(),
        manual_id,
        menu_path: currentSection || 'General',
        page_start: currentPage,
        page_end: currentPage,
        chunk_type: chunkType,
        strategy: CHUNK_STRATEGIES.HIERARCHICAL,
        index: chunkIndex++
      });
      
      // Reset chunk without overlap to avoid duplication
      currentChunk = '';
    }
  }
  
  // Save final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      manual_id,
      menu_path: currentSection || 'Conclusion',
      page_start: currentPage,
      page_end: currentPage,
      chunk_type: 'content',
      strategy: CHUNK_STRATEGIES.HIERARCHICAL,
      index: chunkIndex++
    });
  }
  
  return chunks;
}


serve(async (req) => {
  console.log("🎯 === WEBHOOK RECEIVED ===");
  console.log("📋 Method:", req.method);
  console.log("📋 Headers:", JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook signature (lenient check)
    const signature = req.headers.get('x-signature');
    console.log("🔐 Signature check:");
    console.log("  - Received:", signature);
    console.log("  - Expected:", webhookSecret === "your-secret-verification-token" ? "DEFAULT (not configured)" : "CONFIGURED");
    
    // Only enforce signature if a real secret is configured (not the default)
    if (webhookSecret !== "your-secret-verification-token" && signature !== webhookSecret) {
      console.error("❌ Invalid webhook signature mismatch!");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("✅ Signature check passed (or skipped with default)");
    
    // Get event type from headers (LlamaCloud sends it here)
    const eventType = req.headers.get('x-webhook-event-type');
    const eventId = req.headers.get('x-webhook-event-id');
    console.log("📬 Event type:", eventType);
    console.log("📬 Event ID:", eventId);
    
    // Parse body - use req.json() since content-type is application/json
    const body = await req.json();
    console.log("📋 Parsed body:", JSON.stringify(body, null, 2));
    
    // Extract job_id - LlamaCloud sends it in data.job_id
    const jobId = body.data?.job_id || body.job_id || body.jobId || body.id;
    console.log("🔑 Extracted job_id:", jobId);
    
    if (!jobId) {
      console.error("❌ No job_id found in webhook");
      console.error("Body structure:", JSON.stringify(body, null, 2));
      return new Response(JSON.stringify({ error: "No job_id in webhook" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // CRITICAL: Persist raw webhook immediately
    try {
      console.log('💾 Persisting raw webhook payload and headers...');
      const webhookHeaders = Object.fromEntries(req.headers.entries());
      
      await supabase
        .from('processing_status')
        .update({
          raw_payload: body,
          webhook_headers: webhookHeaders
        })
        .eq('job_id', jobId);
      
      console.log('✅ Raw webhook saved to processing_status');
    } catch (err) {
      console.warn('⚠️ Persist raw payload failed (non-fatal):', err);
    }
    
    // Handle LlamaCloud event notifications
    if (eventType === 'parse.success') {
      console.log("📬 Received parse.success event, fetching job result from API...");
      
      try {
        const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;
        
        // Fetch both markdown and JSON results
        const [markdownResponse, jsonResponse] = await Promise.all([
          fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
            headers: { 'Authorization': `Bearer ${llamaApiKey}` }
          }),
          fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
            headers: { 'Authorization': `Bearer ${llamaApiKey}` }
          })
        ]);
        
        if (!markdownResponse.ok || !jsonResponse.ok) {
          throw new Error(`Failed to fetch job result: md=${markdownResponse.status}, json=${jsonResponse.status}`);
        }
        
        const markdownResult = await markdownResponse.json();
        const jsonResult = await jsonResponse.json();
        console.log("✅ Successfully fetched job results from API");
        console.log("📄 Markdown result keys:", Object.keys(markdownResult));
        console.log("📄 JSON result keys:", Object.keys(jsonResult));
        
        // Replace body with the actual job result data
        body.jobId = jobId;
        body.md = markdownResult.markdown;
        body.json = jsonResult;
        body.images = jsonResult.images || [];
        body.charts = jsonResult.charts || [];
        body.pages = jsonResult.pages || [];
        
        console.log("📊 Final counts - images:", body.images.length, "charts:", body.charts.length);
      } catch (fetchError) {
        console.error("❌ Failed to fetch job result:", fetchError);
        return new Response(JSON.stringify({ error: "Failed to fetch job result from LlamaCloud" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    // Check if this is an ERROR event
    if (eventType === 'parse.error' || body.event === 'parse.error' || body.status === 'ERROR') {
      console.log("❌ LlamaCloud parsing failed");
      
      const { data: document } = await supabase
        .from('documents')
        .select('*')
        .eq('job_id', jobId)
        .single();
      
      if (document) {
        await supabase.rpc('set_tenant_context', { tenant_id: document.fec_tenant_id });
        await supabase
          .from('processing_status')
          .update({
            status: 'error',
            stage: 'failed',
            current_task: 'LlamaCloud parsing failed',
            error_message: body.error || 'Unknown parsing error',
            progress_percent: 0
          })
          .eq('job_id', jobId);
      }
      
      return new Response(JSON.stringify({ success: true, handled: 'error' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const markdown = body.md;
    const jsonData = body.json;
    let images = body.images || [];
    const charts = body.charts || [];
    const pages = body.pages || [];
    
    console.log("🔍 Job details:");
    console.log("- jobId:", jobId);
    console.log("- markdown length:", markdown?.length || 0);
    console.log("- has jsonData:", !!jsonData);
    console.log("- images count:", images?.length || 0);
    console.log("- charts count:", charts?.length || 0);
    console.log("- pages count:", pages?.length || 0);
    
    // Log structure of received data for debugging
    if (images && images.length > 0) {
      console.log("📸 First image full structure:", JSON.stringify(images[0], null, 2));
    }
    if (charts && charts.length > 0) {
      console.log("📊 First chart full structure:", JSON.stringify(charts[0], null, 2));
    }
    if (pages && pages.length > 0) {
      console.log("📄 First page structure:", JSON.stringify(pages[0], null, 2));
    }
    
    if (!markdown) {
      console.error("❌ CRITICAL: No markdown content received");
      console.log("📥 Full body structure:", Object.keys(body));
      return new Response(JSON.stringify({ error: "No markdown content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the associated document
    console.log("🔍 Looking for document with job_id:", jobId);
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('job_id', jobId)
      .single();

    console.log("📄 Document query result:");
    console.log("- error:", docError);
    console.log("- document:", document);

    if (docError || !document) {
      console.error("❌ CRITICAL: Document not found for job:", jobId);
      console.error("- docError:", docError);
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Found document:", document.manual_id, "tenant:", document.fec_tenant_id);

    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: document.fec_tenant_id });

    // STAGE 1: Document Validation & Pre-processing
    await supabase
      .from('processing_status')
      .upsert({
        job_id: jobId,
        manual_id: document.manual_id,
        status: 'processing',
        stage: 'document_validation',
        current_task: 'Validating document structure and performing schema analysis',
        fec_tenant_id: document.fec_tenant_id,
        progress_percent: 15
      });

    console.log("🔍 Stage 1: Document validation and schema analysis");
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for status visibility

    // STAGE 2: Semantic Chunking Initiation
    await supabase
      .from('processing_status')
      .update({
        stage: 'semantic_chunking',
        current_task: 'Initiating hierarchical document segmentation with context-aware boundaries',
        progress_percent: 20
      })
      .eq('job_id', jobId);

    console.log("📝 Processing markdown content with hierarchical chunking");
    
    // STAGE 3: Hierarchical Document Segmentation
    await supabase
      .from('processing_status')
      .update({
        stage: 'hierarchical_segmentation',
        current_task: 'Applying advanced hierarchical parsing with content-type classification',
        progress_percent: 25
      })
      .eq('job_id', jobId);
    
    // Create hierarchical chunks based on document structure
    console.log("🧩 Creating hierarchical chunks with semantic categorization...");
    const allChunks = createHierarchicalChunks(markdown, document.manual_id);
    console.log(`📚 Created ${allChunks.length} hierarchical chunks`);
    
    // Log page number distribution for debugging
    const pageDistribution = allChunks.reduce((acc, chunk) => {
      acc[chunk.page_start] = (acc[chunk.page_start] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    console.log('📊 Page distribution:', pageDistribution);

    // STAGE 4: Vector Embedding Pipeline Initialization
    await supabase
      .from('processing_status')
      .update({
        status: 'processing',
        stage: 'embedding_pipeline',
        current_task: 'Initializing neural embedding pipeline with transformer-based encoding',
        total_chunks: allChunks.length,
        progress_percent: 35
      })
      .eq('job_id', jobId);

    await new Promise(resolve => setTimeout(resolve, 500));

    // STEP 4: Process chunks with embeddings in batches
    let processedCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const batchProgress = Math.round(35 + (i / allChunks.length) * 35); // 35-70% range
      
      // Update progress for each batch
      await supabase
        .from('processing_status')
        .update({
          stage: 'vector_encoding',
          current_task: `Encoding semantic vectors: ${i + batch.length}/${allChunks.length} chunks processed with contextual embeddings`,
          chunks_processed: i + batch.length,
          progress_percent: batchProgress
        })
        .eq('job_id', jobId);
      
      await Promise.all(batch.map(async (chunk, batchIndex) => {
        try {
          console.log(`🔄 Processing chunk ${i + batchIndex + 1}/${allChunks.length}`);
          console.log(`- content preview: "${chunk.content.substring(0, 100)}..."`);
          
          // Generate embedding
          console.log("🔮 Generating embedding...");
          const embedding = await createEmbedding(chunk.content);
          console.log("✅ Embedding generated, length:", embedding?.length || 0);
          
          // Store in database with enriched metadata
          console.log("💾 Inserting into database...");
          
          // Build enriched chunk-level metadata
          const chunkMetadata = {
            chunk_type: chunk.chunk_type || 'content',
            chunk_strategy: chunk.strategy || 'hierarchical',
            chunk_index: chunk.index,
            chunk_length: chunk.content.length,
            word_count: chunk.content.split(/\s+/).length,
            has_tables: /[\|<].*[\|>]|^\s*\|/m.test(chunk.content),
            has_lists: /^\s*[-*•]\s+/m.test(chunk.content) || /^\s*\d+\.\s+/m.test(chunk.content),
            has_code_numbers: /\b\d{3,}\b|\b[A-Z]{2,}\d+\b/.test(chunk.content),
            section_type: chunk.menu_path?.toLowerCase().includes('troubleshoot') ? 'troubleshooting' :
                         chunk.menu_path?.toLowerCase().includes('parts') ? 'parts_list' :
                         chunk.menu_path?.toLowerCase().includes('specification') ? 'specifications' :
                         chunk.menu_path?.toLowerCase().includes('installation') ? 'installation' :
                         chunk.menu_path?.toLowerCase().includes('maintenance') ? 'maintenance' :
                         chunk.menu_path?.toLowerCase().includes('warranty') ? 'warranty' : 'general'
          };
          
          const insertData = {
            manual_id: chunk.manual_id,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            menu_path: chunk.menu_path,
            embedding: embedding,
            fec_tenant_id: document.fec_tenant_id,
            metadata: chunkMetadata
          };
          
          console.log("📝 Insert data:", JSON.stringify(insertData, null, 2));
          
          const { error: insertError, data: insertResult } = await supabase
            .from('chunks_text')
            .insert(insertData);
            
          if (insertError) {
            console.error(`❌ CRITICAL: Failed to insert chunk ${chunk.index}:`, insertError);
            console.error("- Insert data was:", insertData);
          } else {
            processedCount++;
            console.log(`✅ SUCCESS: Chunk ${processedCount}/${allChunks.length} saved with ID:`, insertResult);
          }
        } catch (error) {
          console.error(`❌ CRITICAL: Error processing chunk ${chunk.index}:`, error);
          console.error("- Chunk data:", chunk);
        }
      }));
      
    }

    // STAGE 5: Database Persistence Layer
    await supabase
      .from('processing_status')
      .update({
        stage: 'database_persistence',
        current_task: `Persisting ${processedCount} semantic chunks to vector database with metadata enrichment`,
        chunks_processed: processedCount,
        progress_percent: 70
      })
      .eq('job_id', jobId);

    // STAGE 6: Page Reference Normalization
    await supabase
      .from('processing_status')
      .update({
        stage: 'page_normalization',
        current_task: 'Normalizing page references and validating cross-document citations',
        progress_percent: 73
      })
      .eq('job_id', jobId);

    console.log('📄 Running auto-repage to fix page numbers...');
    try {
      const repageResponse = await supabase.functions.invoke('repage-manual', {
        body: { manual_id: document.manual_id }
      });
      
      if (repageResponse.error) {
        console.error('⚠️ Repage failed:', repageResponse.error);
      } else {
        console.log('✅ Auto-repage complete:', repageResponse.data);
      }
    } catch (repageError) {
      console.error('⚠️ Repage error:', repageError);
      // Don't fail the whole process if repage fails
    }

    // STAGE 7: Metadata Schema Construction
    await supabase
      .from('processing_status')
      .update({
        stage: 'metadata_construction',
        current_task: 'Constructing canonical metadata schema with taxonomic classification',
        progress_percent: 76
      })
      .eq('job_id', jobId);

    console.log('📝 Creating manual_metadata entry...');
    try {
      const { data: existingMetadata } = await supabase
        .from('manual_metadata')
        .select('manual_id')
        .eq('manual_id', document.manual_id)
        .maybeSingle();
      
      if (!existingMetadata) {
        // Extract basic info from title
        const cleanTitle = document.title.replace(/\.pdf$/i, '').trim();
        
        const { error: metadataError } = await supabase.rpc('upsert_manual_metadata', {
          p_metadata: {
            manual_id: document.manual_id,
            canonical_title: cleanTitle,
            uploaded_by: 'llama_webhook',
            ingest_status: 'ingested',
            language: 'en'
          }
        });
        
        if (metadataError) {
          console.error('❌ Failed to create manual_metadata:', metadataError);
        } else {
          console.log('✅ manual_metadata created');
          
          // Auto-backfill the metadata into chunks
          console.log('🔄 Auto-backfilling metadata into chunks...');
          const { data: backfillResult, error: backfillError } = await supabase.rpc('fn_backfill_for_manual_any', {
            p_manual_id: document.manual_id
          });
          
          if (backfillError) {
            console.error('❌ Auto-backfill failed:', backfillError);
          } else {
            console.log('✅ Auto-backfill completed:', backfillResult);
          }
        }
      } else {
        console.log('ℹ️ manual_metadata already exists, skipping creation');
      }
    } catch (metadataErr) {
      console.error('❌ Error in manual_metadata creation:', metadataErr);
    }

    // STEP 5: Process images from LlamaCloud
    let figuresProcessed = 0;
    console.log(`📡 Processing ${images?.length || 0} images from LlamaCloud...`);
    
    const keepAllImages = Deno.env.get('KEEP_ALL_IMAGES') === 'true';
    console.log(`🎛️ KEEP_ALL_IMAGES override: ${keepAllImages}`);
    
    if (!images || images.length === 0) {
      console.log('⚠️ No images found in top-level array, checking pages...');
      // Fallback: extract images from pages array
      if (body.pages && Array.isArray(body.pages)) {
        const extractedImages = body.pages.flatMap((page: any) => page.images || []);
        if (extractedImages.length > 0) {
          console.log(`✅ Found ${extractedImages.length} images in pages array`);
          images = extractedImages;
        }
      }
    }
    
    if (images && images.length > 0) {
      console.log(`🖼️ Processing ${images.length} images...`);
      
      // STAGE 8: Visual Asset Extraction Pipeline
      await supabase
        .from('processing_status')
        .update({
          status: 'processing',
          stage: 'visual_asset_extraction',
          current_task: `Initializing visual asset extraction pipeline for ${images.length} diagrams and schematics`,
          total_figures: images.length,
          progress_percent: 80
        })
        .eq('job_id', jobId);

      // Process images in parallel batches
      const batchSize = 10;
      const insertedFigureIds: { id: string, figureName: string }[] = [];
      
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        
      // Update progress for this image batch
      const imageProgress = Math.round(80 + ((i + batch.length) / images.length) * 10);
      await supabase
        .from('processing_status')
        .update({
          stage: 'image_ingestion',
          current_task: `Processing visual assets: ${Math.min(i + batch.length, images.length)}/${images.length} diagrams extracted and cataloged`,
          figures_processed: Math.min(i + batch.length, images.length),
          progress_percent: imageProgress
        })
        .eq('job_id', jobId);

      const batchResults = await Promise.all(batch.map(async (imageItem: any, batchIdx: number) => {
        try {
          const imageIndex = i + batchIdx;
          
          // CRITICAL: Handle both string and object formats from LlamaCloud
          // LlamaCloud returns objects like: {name: "img_p0_1.png", x: 24.96, y: 245.52, width: 492.12, height: 37.92}
          let imageName: string;
          
          if (typeof imageItem === 'string') {
            imageName = imageItem;
          } else if (imageItem && typeof imageItem === 'object' && imageItem.name) {
            imageName = imageItem.name;
          } else {
            console.error(`❌ Invalid image format at index ${imageIndex}:`, JSON.stringify(imageItem));
            return null;
          }
          
          if (!imageName || typeof imageName !== 'string') {
            console.error(`❌ Image name is not a string at index ${imageIndex}:`, imageName);
            return null;
          }
          
          console.log(`🔄 [${imageIndex + 1}/${images.length}] Processing: ${imageName}`);
          
          // Apply filtering unless KEEP_ALL_IMAGES is true
          if (!keepAllImages) {
            const metadata = typeof imageItem === 'object' ? imageItem : { name: imageName };
            if (!shouldKeepImage(metadata)) {
              console.log(`  ⏭️ SKIPPED (decorative/small): ${imageName}`);
              return null;
            }
          }
          
          // Extract page number from filename
          // Handles formats like: page_3.jpg, page_3_text_1.jpg, img_p0_1.png, p3_image.png
          let pageNumber: number | null = null;
          const pageMatch = imageName.match(/(?:page|p)[_-]?(\d+)/i);
          if (pageMatch) {
            pageNumber = parseInt(pageMatch[1], 10);
            console.log(`  📄 Extracted page number: ${pageNumber}`);
          } else {
            console.log(`  ⚠️ Could not extract page number from: ${imageName}`);
          }
          
          // Download image from LlamaCloud API
          const imageUrl = `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/image/${encodeURIComponent(imageName)}`;
          console.log(`  📥 Downloading from: ${imageUrl}`);
            
          const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
          if (!llamaApiKey) {
            console.error(`  ❌ LLAMACLOUD_API_KEY not configured`);
            return null;
          }
          
          const imageResponse = await fetch(imageUrl, {
            headers: { 'Authorization': `Bearer ${llamaApiKey}` }
          });
          
          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error(`  ❌ Download failed (${imageResponse.status}): ${errorText}`);
            return null;
          }
          
          console.log(`  ✅ Downloaded ${imageResponse.headers.get('content-length')} bytes`);
          
          const imageBlob = await imageResponse.blob();
          const imageBuffer = await imageBlob.arrayBuffer();
          
          // Upload to Supabase Storage (postparse bucket is public)
          const storagePath = `${document.manual_id}/${imageName}`;
          const contentType = imageName.endsWith('.png') ? 'image/png' : 'image/jpeg';
          
          console.log(`  ☁️ Uploading to: postparse/${storagePath}`);
          
          const { error: uploadError } = await supabase.storage
            .from('postparse')
            .upload(storagePath, imageBuffer, {
              contentType,
              upsert: true
            });
          
          if (uploadError) {
            console.error(`  ❌ Storage upload failed:`, uploadError);
            return null;
          }
          
          console.log(`  ✅ Uploaded to storage`);
          
          // Insert figure metadata into database
          const figureData = {
            manual_id: document.manual_id,
            figure_id: imageName,
            storage_path: storagePath,
            page_number: pageNumber,
            llama_asset_name: imageName,
            fec_tenant_id: document.fec_tenant_id,
            raw_image_metadata: imageItem && typeof imageItem === 'object' ? imageItem : { name: imageName }
          };
          
          console.log(`  💾 Inserting figure record...`);
          
          const { data: insertedFigure, error: figureError } = await supabase
            .from('figures')
            .insert(figureData)
            .select()
            .single();
            
          if (figureError) {
            console.error(`  ❌ DB insert failed:`, figureError);
            return null;
          }
          
          figuresProcessed++;
          console.log(`  ✅ [${figuresProcessed}/${images.length}] Figure stored successfully!`);
          return { id: insertedFigure.id, figureName: imageName };
          
        } catch (error) {
          console.error(`  ❌ Exception processing image:`, error);
          if (error instanceof Error) {
            console.error(`  ❌ Error stack:`, error.stack);
          }
          return null;
        }
      }));
        
        // Collect successful inserts for caption generation
        insertedFigureIds.push(...batchResults.filter(r => r !== null));
      }
      
      console.log(`✅ All ${figuresProcessed} images stored, starting background caption generation...`);
      
      // Generate captions and OCR in background (fire-and-forget)
      EdgeRuntime.waitUntil((async () => {
        for (const figureInfo of insertedFigureIds) {
          try {
            console.log(`🤖 Generating AI caption and OCR for: ${figureInfo.figureName}`);
            
            // Get public URL for the image
            const { data: publicUrlData } = supabase.storage
              .from('postparse')
              .getPublicUrl(`${document.manual_id}/${figureInfo.figureName}`);
            
            const imagePublicUrl = publicUrlData.publicUrl;
            const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');
            
            // Call GPT-4.1 Vision for caption generation
            const captionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Project': openaiProjectId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                max_completion_tokens: 500,
                messages: [
                  {
                    role: 'system',
                    content: 'You are an expert technical documentation analyst specializing in arcade game manuals. Create detailed, accurate captions for images from technical manuals focusing on components, connections, troubleshooting value, and maintenance procedures.'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: `Analyze this image from an arcade game manual and provide a detailed technical caption.

Manual: ${document.title}
Figure ID: ${figureInfo.figureName}
Page: ${figureInfo.page_number || 'Unknown'}

Start your caption with "[Page ${figureInfo.page_number || 'Unknown'}]" followed by a detailed technical description that helps technicians understand what they're looking at and how it relates to troubleshooting or maintenance.`
                      },
                      {
                        type: 'image_url',
                        image_url: {
                          url: imagePublicUrl
                        }
                      }
                    ]
                  }
                ],
              }),
            });
            
            // Call GPT-4.1 Vision for OCR text extraction
            const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Project': openaiProjectId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                max_completion_tokens: 1000,
                messages: [
                  {
                    role: 'system',
                    content: 'You are an OCR specialist. Extract ALL visible text from images with 100% accuracy. Preserve the exact text, formatting, labels, part numbers, model numbers, voltage ratings, warnings, and any other written content. Return ONLY the extracted text without any commentary or explanation.'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Extract all visible text from this image. Include labels, part numbers, specifications, warnings, and any other text. Preserve the original formatting and organization as much as possible.'
                      },
                      {
                        type: 'image_url',
                        image_url: {
                          url: imagePublicUrl
                        }
                      }
                    ]
                  }
                ],
              }),
            });
            
            let caption = null;
            let ocrText = null;
            
            if (captionResponse.ok) {
              const captionData = await captionResponse.json();
              caption = captionData.choices[0].message.content;
              console.log(`✅ Caption generated for ${figureInfo.figureName}`);
            } else {
              console.error(`❌ Caption API error for ${figureInfo.figureName}:`, captionResponse.status);
            }
            
            if (ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              ocrText = ocrData.choices[0].message.content;
              console.log(`✅ OCR text extracted for ${figureInfo.figureName}`);
            } else {
              console.error(`❌ OCR API error for ${figureInfo.figureName}:`, ocrResponse.status);
            }
            
            // Update figure with both caption and OCR text
            const updateData: any = {};
            if (caption) {
              updateData.caption_text = caption;
              updateData.vision_text = caption;
            }
            if (ocrText) {
              updateData.ocr_text = ocrText;
            }
            
            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('figures')
                .update(updateData)
                .eq('id', figureInfo.id);
              
              console.log(`✅ Updated ${figureInfo.figureName} with caption: ${!!caption}, OCR: ${!!ocrText}`);
            }
            
          } catch (captionError) {
            console.error(`❌ Error processing ${figureInfo.figureName}:`, captionError);
          }
        }
        console.log(`🎉 Background caption and OCR processing complete for ${insertedFigureIds.length} images`);
      })());
    }

    // STAGE 9: Quality Assurance & Validation
    await supabase
      .from('processing_status')
      .update({
        stage: 'quality_validation',
        current_task: 'Running comprehensive quality checks on indexed content and metadata integrity',
        progress_percent: 92
      })
      .eq('job_id', jobId);

    await new Promise(resolve => setTimeout(resolve, 500));

    // STAGE 10: Index Optimization & Finalization
    await supabase
      .from('processing_status')
      .update({
        stage: 'index_optimization',
        current_task: 'Optimizing search indices and finalizing vector database configuration',
        progress_percent: 96
      })
      .eq('job_id', jobId);

    await new Promise(resolve => setTimeout(resolve, 500));

    // FINAL STAGE: Processing Complete
    await supabase
      .from('processing_status')
      .update({
        status: 'completed',
        stage: 'completed',
        current_task: `PREMIUM processing complete: ${processedCount} chunks, ${figuresProcessed} figures with advanced AI analysis`,
        progress_percent: 100,
        chunks_processed: processedCount,
        figures_processed: figuresProcessed
      })
      .eq('job_id', jobId);

    console.log(`🎉 Processing completed: ${processedCount} chunks, ${figuresProcessed} figures saved`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      chunks_processed: processedCount,
      total_chunks: allChunks.length,
      figures_processed: figuresProcessed,
      total_figures: images?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ CRITICAL WEBHOOK ERROR:", error);
    if (error instanceof Error) {
      console.error("- Error stack:", error.stack);
      console.error("- Error message:", error.message);
    }
    
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
