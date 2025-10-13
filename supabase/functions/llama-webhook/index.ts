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

  // Drop obvious ornaments/backgrounds
  if (/(background|border|mask|frame|header|footer|shadow|separator|rule|page-\d+)/.test(name)) return false;
  if (name.endsWith(".svg")) return false;

  // Size heuristics
  const w = meta.width ?? meta.bbox?.width ?? 0;
  const h = meta.height ?? meta.bbox?.height ?? 0;

  // Too small
  if ((w && w < 100) || (h && h < 60)) return false;

  // Too tiny area
  if (w && h && (w * h) < 12000) return false;

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
    
    const body = await req.json();
    console.log("📋 Parsed body keys:", Object.keys(body));
    console.log("📋 Full body:", JSON.stringify(body, null, 2));
    
    // CRITICAL: Persist raw webhook immediately (before any processing/awaits)
    // This is a best-effort audit record; must not interrupt the webhook flow
    try {
      const jobIdFromBody = body.jobId || body.data?.job_id || body.job_id;
      
      if (jobIdFromBody) {
        console.log('💾 Persisting raw webhook payload and headers (best-effort)...');
        const webhookHeaders = Object.fromEntries(req.headers.entries());
        
        // UPDATE existing row (created by upload-manual) instead of INSERT
        await supabase
          .from('processing_status')
          .update({
            raw_payload: body,
            webhook_headers: webhookHeaders
          })
          .eq('job_id', jobIdFromBody);
        
        console.log('✅ Raw webhook saved to processing_status');
      }
    } catch (err) {
      console.warn('⚠️ Persist raw payload failed (non-fatal):', err);
      // Intentionally continue — persistence is useful for debug but must not stop ingestion
    }
    
    // Handle LlamaCloud event notifications (event_type structure)
    if (body.event_type === 'parse.success' && body.data?.job_id) {
      console.log("📬 Received parse.success event, fetching job result from API...");
      const jobId = body.data.job_id;
      
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
        console.log('✅ Raw payload and headers saved');
        
        // Replace body with the actual job result data
        Object.assign(body, {
          jobId: jobId,
          md: markdownResult.markdown,
          json: jsonResult,
          images: jsonResult.images || [],
          charts: jsonResult.charts || [],
          pages: jsonResult.pages || []
        });
      } catch (fetchError) {
        console.error("❌ Failed to fetch job result:", fetchError);
        return new Response(JSON.stringify({ error: "Failed to fetch job result from LlamaCloud" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    // Check if this is an ERROR event
    if (body.event === 'parse.error' || body.event_type === 'parse.error' || body.status === 'ERROR') {
      console.log("❌ LlamaCloud parsing failed");
      const jobId = body.jobId || body.data?.job_id;
      
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
    
    const { jobId, md: markdown, json: jsonData, images, charts, pages } = body;
    
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

    // Update processing status
    await supabase
      .from('processing_status')
      .upsert({
        job_id: jobId,
        manual_id: document.manual_id,
        status: 'processing',
        stage: 'chunking',
        current_task: 'Creating semantic chunks based on document structure',
        fec_tenant_id: document.fec_tenant_id,
        progress_percent: 25
      });

    console.log("📝 Processing markdown content with hierarchical chunking");
    
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

    // Update progress
    await supabase
      .from('processing_status')
      .update({
        status: 'processing',
        stage: 'embedding_generation',
        current_task: 'Generating high-quality embeddings with semantic understanding',
        total_chunks: allChunks.length,
        progress_percent: 50
      })
      .eq('job_id', jobId);

    // STEP 4: Process chunks with embeddings in batches
    let processedCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (chunk, batchIndex) => {
        try {
          console.log(`🔄 Processing chunk ${i + batchIndex + 1}/${allChunks.length}`);
          console.log(`- content preview: "${chunk.content.substring(0, 100)}..."`);
          
          // Generate embedding
          console.log("🔮 Generating embedding...");
          const embedding = await createEmbedding(chunk.content);
          console.log("✅ Embedding generated, length:", embedding?.length || 0);
          
          // Store in database
          console.log("💾 Inserting into database...");
          const insertData = {
            manual_id: chunk.manual_id,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            menu_path: chunk.menu_path,
            embedding: embedding,
            fec_tenant_id: document.fec_tenant_id
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
      
      // Update progress
      const progressPercent = Math.round(50 + (processedCount / allChunks.length) * 45);
      await supabase
        .from('processing_status')
        .update({
          chunks_processed: processedCount,
          progress_percent: progressPercent
        })
        .eq('job_id', jobId);
    }

    // STEP 4.4: Auto-repage the manual to fix any page number issues
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

    // STEP 4.5: Auto-create manual_metadata entry
    console.log('📝 Creating manual_metadata entry...');
    try {
      const { data: existingMetadata } = await supabase
        .from('manual_metadata')
        .select('manual_id')
        .eq('manual_id', manual_id)
        .maybeSingle();
      
      if (!existingMetadata) {
        // Extract basic info from title
        const cleanTitle = document.title.replace(/\.pdf$/i, '').trim();
        
        const { error: metadataError } = await supabase.rpc('upsert_manual_metadata', {
          p_metadata: {
            manual_id: manual_id,
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
            p_manual_id: manual_id
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
      console.log('⚠️ No images found in LlamaCloud response');
    } else {
      console.log(`🖼️ Processing ${images.length} images...`);
      
      await supabase
        .from('processing_status')
        .update({
          status: 'processing',
          stage: 'image_processing',
          current_task: 'Downloading and processing images',
          total_figures: images.length,
          progress_percent: 95
        })
        .eq('job_id', jobId);

      // Process images in parallel batches
      const batchSize = 10;
      const insertedFigureIds: { id: string, figureName: string }[] = [];
      
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        
      const batchResults = await Promise.all(batch.map(async (imageName: string, idx: number) => {
          try {
            console.log(`🔄 Processing image ${i + idx + 1}/${images.length}: ${imageName}`);
            
            // Extract page number from filename
            let pageNumber: number | null = null;
            const pageMatch = imageName.match(/(?:page|p)_?(\d+)/i);
            if (pageMatch) pageNumber = parseInt(pageMatch[1], 10);
            
            // Download image from LlamaCloud using the job ID
            const imageUrl = `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/image/${imageName}`;
            console.log(`📥 Downloading from: ${imageUrl}`);
            
            const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;
            const imageResponse = await fetch(imageUrl, {
              headers: { 'Authorization': `Bearer ${llamaApiKey}` }
            });
            
            if (!imageResponse.ok) {
              console.error(`❌ Failed to download image ${imageName}: ${imageResponse.status}`);
              return null;
            }
            
            const imageBlob = await imageResponse.blob();
            const imageBuffer = await imageBlob.arrayBuffer();
            
            // Upload to postparse bucket
            const storagePath = `${document.manual_id}/${imageName}`;
            // Determine content type from filename
            const contentType = imageName.endsWith('.png') ? 'image/png' : 'image/jpeg';
            
            const { error: uploadError } = await supabase.storage
              .from('postparse')
              .upload(storagePath, imageBuffer, {
                contentType,
                upsert: true
              });
            
            if (uploadError) {
              console.error(`❌ Failed to upload image ${imageName}:`, uploadError);
              return null;
            }
            
            console.log(`✅ Image uploaded to storage: postparse/${storagePath}`);
            
            // Store figure metadata in database
            const figureData = {
              manual_id: document.manual_id,
              figure_id: imageName,
              storage_path: storagePath,
              page_number: pageNumber,
              llama_asset_name: imageName,
              fec_tenant_id: document.fec_tenant_id,
              raw_image_metadata: { name: imageName }
            };
            
            console.log("📸 Storing figure metadata:", figureData);
            
            const { data: insertedFigure, error: figureError } = await supabase
              .from('figures')
              .insert(figureData)
              .select()
              .single();
              
            if (figureError) {
              console.error("❌ Error storing figure:", figureError);
              return null;
            } else {
              figuresProcessed++;
              console.log(`✅ Figure ${figuresProcessed}/${images.length} stored`);
              return { id: insertedFigure.id, figureName: imageName };
            }
          } catch (error) {
            console.error("❌ Error processing image:", error);
            return null;
          }
        }));
        
        // Collect successful inserts for caption generation
        insertedFigureIds.push(...batchResults.filter(r => r !== null));
      }
      
      console.log(`✅ All ${figuresProcessed} images stored, starting background caption generation...`);
      
      // Generate captions in background (fire-and-forget)
      EdgeRuntime.waitUntil((async () => {
        for (const figureInfo of insertedFigureIds) {
          try {
            console.log(`🤖 Generating AI caption for: ${figureInfo.figureName}`);
            
            // Get public URL for the image
            const { data: publicUrlData } = supabase.storage
              .from('postparse')
              .getPublicUrl(figureInfo.storagePath);
            
            const imagePublicUrl = publicUrlData.publicUrl;
            
            // Call GPT-4.1 Vision for caption generation
            const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');
            const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Project': openaiProjectId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                max_tokens: 1000,
                temperature: 0.7,
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
                max_completion_tokens: 500
              }),
            });
            
            if (visionResponse.ok) {
              const aiResponse = await visionResponse.json();
              const caption = aiResponse.choices[0].message.content;
              
              await supabase
                .from('figures')
                .update({ 
                  caption_text: caption,
                  vision_text: caption 
                })
                .eq('id', figureInfo.id);
              
              console.log(`✅ Caption saved for ${figureInfo.figureName}`);
            } else {
              console.error(`❌ Vision API error for ${figureInfo.figureName}:`, visionResponse.status);
            }
          } catch (captionError) {
            console.error(`❌ Error generating caption:`, captionError);
          }
        }
        console.log(`🎉 Background caption generation complete for ${insertedFigureIds.length} images`);
      })());
    }

    // STEP 6: Final status update
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
      total_figures: allFigures.length
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
