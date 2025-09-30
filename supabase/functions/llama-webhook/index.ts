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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Advanced chunking strategies
const CHUNK_STRATEGIES = {
  SEMANTIC: 'semantic',
  HIERARCHICAL: 'hierarchical', 
  SLIDING_WINDOW: 'sliding_window',
  SENTENCE_BOUNDARY: 'sentence_boundary'
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
  let currentPage = null;
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
      currentChunk.length > 1200 || // Size-based chunking
      (currentChunk.length > 600 && line === '') || // Natural breaks
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
      
      // Keep some overlap for context continuity
      const lines = currentChunk.split('\n');
      currentChunk = lines.slice(-2).join('\n') + '\n';
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

// Create sliding window chunks for better context coverage
function createSlidingWindowChunks(chunks: any[], manual_id: string) {
  const slidingChunks = [];
  const windowSize = 2;
  const overlap = 1;
  
  for (let i = 0; i < chunks.length - windowSize + 1; i += overlap) {
    const windowChunks = chunks.slice(i, i + windowSize);
    const combinedContent = windowChunks.map(chunk => chunk.content).join('\n\n');
    
    if (combinedContent.trim().length > 200) { // Only create if substantial content
      slidingChunks.push({
        content: combinedContent,
        manual_id,
        menu_path: windowChunks[0].menu_path + ' (Extended Context)',
        page_start: windowChunks[0].page_start,
        page_end: windowChunks[windowChunks.length - 1].page_end,
        chunk_type: 'context_window',
        strategy: CHUNK_STRATEGIES.SLIDING_WINDOW,
        index: i
      });
    }
  }
  
  return slidingChunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Webhook called - Starting processing");
    
    const body = await req.json();
    console.log("📋 Parsed body keys:", Object.keys(body));
    console.log("📋 Full body:", JSON.stringify(body, null, 2));
    
    const { jobId, md: markdown, json: jsonData, images, charts, pages } = body;
    
    console.log("🔍 Job details:");
    console.log("- jobId:", jobId);
    console.log("- markdown length:", markdown?.length || 0);
    console.log("- has jsonData:", !!jsonData);
    console.log("- images count:", images?.length || 0);
    console.log("- charts count:", charts?.length || 0);
    console.log("- pages count:", pages?.length || 0);
    
    // Log structure of received data
    if (images && images.length > 0) {
      console.log("📸 Images structure:", images[0]);
    }
    if (charts && charts.length > 0) {
      console.log("📊 Charts structure:", charts[0]);
    }
    if (pages && pages.length > 0) {
      console.log("📄 Pages structure:", Object.keys(pages[0]));
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
        stage: 'advanced_chunking',
        current_task: 'Creating hierarchical and sliding window chunks with AI categorization',
        fec_tenant_id: document.fec_tenant_id,
        progress_percent: 25
      });

    console.log("📝 Processing PREMIUM markdown content with advanced AI parsing");
    
    // STEP 1: Create hierarchical chunks based on document structure
    console.log("🧩 Creating hierarchical chunks with AI categorization...");
    const hierarchicalChunks = createHierarchicalChunks(markdown, document.manual_id);
    console.log(`📚 Created ${hierarchicalChunks.length} hierarchical chunks`);
    
    // STEP 2: Create sliding window chunks for better context
    console.log("🪟 Creating sliding window chunks for enhanced context...");
    const slidingChunks = createSlidingWindowChunks(hierarchicalChunks, document.manual_id);
    console.log(`📖 Created ${slidingChunks.length} sliding window chunks`);
    
    // STEP 3: Combine all chunks
    const allChunks = [...hierarchicalChunks, ...slidingChunks];
    console.log(`🎯 Total chunks to process: ${allChunks.length}`);

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

    // STEP 5: Process images and figures
    let figuresProcessed = 0;
    const allFigures = [...(images || []), ...(charts || [])];
    
    if (allFigures.length > 0) {
      console.log(`🖼️ Processing ${allFigures.length} figures...`);
      
      await supabase
        .from('processing_status')
        .update({
          status: 'processing',
          stage: 'image_processing',
          current_task: 'Processing images with AI vision analysis',
          total_figures: allFigures.length,
          progress_percent: 95
        })
        .eq('job_id', jobId);

      for (const figure of allFigures) {
        try {
          console.log(`🔄 Processing figure: ${figure.name || figure.id || figure || 'unnamed'}`);
          
          // Construct proper S3 URL for the image
          const figureName = figure.name || figure.id || figure || `figure_${figuresProcessed}`;
          const s3ImageUrl = `https://arcade-postparse-images.s3.us-east-2.amazonaws.com/manuals/${document.manual_id}/${figureName}`;
          
          const figureData = {
            manual_id: document.manual_id,
            figure_id: figureName,
            image_url: s3ImageUrl,
            page_number: figure.page || null,
            bbox_pdf_coords: figure.bbox ? JSON.stringify(figure.bbox) : null,
            llama_asset_name: figureName,
            fec_tenant_id: document.fec_tenant_id
          };
          
          console.log("📸 Storing figure:", figureData);
          
          const { error: figureError } = await supabase
            .from('figures')
            .insert(figureData);
            
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
