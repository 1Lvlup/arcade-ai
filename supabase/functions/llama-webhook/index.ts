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

    // STEP 5: Fetch images from LlamaCloud API if not in webhook
    let figuresProcessed = 0;
    let allFigures = [...(images || []), ...(charts || [])];
    
    // If no images in webhook, fetch from API
    if (allFigures.length === 0) {
      console.log('📡 No images in webhook, fetching from LlamaCloud API...');
      try {
        const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;
        const jobResultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
          headers: {
            'Authorization': `Bearer ${llamaApiKey}`
          }
        });
        
        if (jobResultResponse.ok) {
          const jobResult = await jobResultResponse.json();
          console.log('✅ Got job result from API');
          console.log('📋 Job result keys:', Object.keys(jobResult));
          console.log('📋 Full job result structure:', JSON.stringify(jobResult, null, 2).substring(0, 2000));
          
          // Extract image objects from pages
          if (jobResult.pages && Array.isArray(jobResult.pages)) {
            console.log(`📄 Found ${jobResult.pages.length} pages`);
            const imageObjects: any[] = [];
            for (const page of jobResult.pages) {
              console.log('📄 Page keys:', Object.keys(page));
              console.log('📄 Page images:', page.images);
              console.log('📄 Page charts:', page.charts);
              
              // Images are objects with {name, height, width, x, y, etc.}
              if (page.images && Array.isArray(page.images)) {
                for (const img of page.images) {
                  imageObjects.push({
                    name: img.name,
                    page: page.page,
                    type: 'image'
                  });
                }
              }
              if (page.charts && Array.isArray(page.charts)) {
                for (const chart of page.charts) {
                  imageObjects.push({
                    name: chart.name,
                    page: page.page,
                    type: 'chart'
                  });
                }
              }
            }
            allFigures = imageObjects;
            console.log(`📸 Found ${allFigures.length} images from API`);
          } else {
            console.log('⚠️ No pages array found in job result');
          }
        } else {
          console.error('❌ Failed to fetch job result from API:', jobResultResponse.status);
        }
      } catch (fetchError) {
        console.error('❌ Error fetching images from API:', fetchError);
      }
    }
    
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
          console.log(`🔄 Processing figure:`, JSON.stringify(figure, null, 2));
          
          let figureName: string;
          let pageNumber: number | null = null;
          let llamaCloudUrl: string;
          
          // Figure is now an object with {name, page, type}
          if (typeof figure === 'object' && figure.name) {
            figureName = figure.name;
            pageNumber = figure.page || null;
            
            // Skip if filename suggests it's a background or decorative element
            if (figureName.includes('background') || figureName.includes('page-') || figureName.includes('border')) {
              console.log(`⏭️ Skipping likely decorative image: ${figureName}`);
              continue;
            }
            
            // Construct proper LlamaCloud image URL using the API key
            llamaCloudUrl = `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/image/${figureName}`;
          } else if (typeof figure === 'string') {
            // Fallback for string format
            figureName = figure;
            if (figureName.includes('background') || figureName.includes('page-') || figureName.includes('border')) {
              console.log(`⏭️ Skipping likely decorative image: ${figureName}`);
              continue;
            }
            llamaCloudUrl = `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/image/${figure}`;
          } else {
            console.error("❌ Unknown figure format:", figure);
            continue;
          }
          
          console.log(`📥 Downloading image from LlamaCloud: ${llamaCloudUrl}`);
          
          // Download image from LlamaCloud with auth
          const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;
          const imageResponse = await fetch(llamaCloudUrl, {
            headers: {
              'Authorization': `Bearer ${llamaApiKey}`
            }
          });
          
          if (!imageResponse.ok) {
            console.error(`❌ Failed to download image from LlamaCloud: ${imageResponse.status}`, await imageResponse.text());
            continue;
          }
          
          const imageBlob = await imageResponse.blob();
          const imageArrayBuffer = await imageBlob.arrayBuffer();
          
          // Determine content type
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          
          // Create storage path: {manual_id}/figures/{figure_name}
          const storagePath = `${document.manual_id}/figures/${figureName}`;
          
          console.log(`📤 Uploading to Supabase storage: ${storagePath}`);
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabaseClient.storage
            .from('postparse')
            .upload(storagePath, imageArrayBuffer, {
              contentType,
              upsert: true
            });
          
          if (uploadError) {
            console.error(`❌ Failed to upload to storage:`, uploadError);
            continue;
          }
          
          console.log(`✅ Image stored successfully: ${storagePath}`);
          
          const figureData = {
            manual_id: document.manual_id,
            figure_id: figureName,
            storage_path: storagePath,
            page_number: pageNumber,
            bbox_pdf_coords: figure.bbox ? JSON.stringify(figure.bbox) : null,
            llama_asset_name: figureName,
            fec_tenant_id: document.fec_tenant_id
          };
          
          console.log("📸 Storing figure:", figureData);
          
          const { data: insertedFigure, error: figureError } = await supabase
            .from('figures')
            .insert(figureData)
            .select()
            .single();
            
          if (figureError) {
            console.error("❌ Error storing figure:", figureError);
          } else {
            figuresProcessed++;
            console.log(`✅ Figure ${figuresProcessed}/${allFigures.length} stored`);
            
            // Automatically generate AI caption
            try {
              console.log(`🤖 Generating AI caption for figure: ${figureName}`);
              
              // Get public URL for the image
              const { data: publicUrlData } = supabase.storage
                .from('postparse')
                .getPublicUrl(storagePath);
              
              const imagePublicUrl = publicUrlData.publicUrl;
              
              // Call GPT-5 Vision for caption generation
              const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-5-2025-08-07',
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
Figure ID: ${figureName}
Page: ${pageNumber || 'Unknown'}

Provide a caption that helps technicians understand what they're looking at and how it relates to troubleshooting or maintenance.`
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
                
                // Update figure with AI-generated caption
                await supabase
                  .from('figures')
                  .update({ 
                    caption_text: caption,
                    vision_text: caption 
                  })
                  .eq('id', insertedFigure.id);
                
                console.log(`✅ AI caption generated for ${figureName}`);
              } else {
                console.error(`❌ Vision API error for ${figureName}:`, visionResponse.status);
              }
            } catch (captionError) {
              console.error(`❌ Error generating caption for ${figureName}:`, captionError);
              // Continue processing even if caption generation fails
            }
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
