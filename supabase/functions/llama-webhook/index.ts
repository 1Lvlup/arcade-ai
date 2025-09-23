import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const awsRegion = Deno.env.get("AWS_REGION")!;
const s3Bucket = Deno.env.get("S3_BUCKET")!;

// Environment variable logging
console.log("🔑 Environment variables check:");
console.log(`SUPABASE_URL: ${supabaseUrl ? "✅ Present" : "❌ Missing"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "✅ Present" : "❌ Missing"}`);
console.log(`OPENAI_API_KEY: ${openaiApiKey ? "✅ Present" : "❌ Missing"}`);
console.log(`AWS_ACCESS_KEY_ID: ${awsAccessKeyId ? "✅ Present" : "❌ Missing"}`);
console.log(`AWS_SECRET_ACCESS_KEY: ${awsSecretAccessKey ? "✅ Present" : "❌ Missing"}`);
console.log(`AWS_REGION: ${awsRegion ? "✅ Present" : "❌ Missing"}`);
console.log(`S3_BUCKET: ${s3Bucket ? "✅ Present" : "❌ Missing"}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const aws = new AwsClient({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
  service: "s3",
});

async function uploadToS3(buffer: Uint8Array, key: string, contentType = "application/octet-stream") {
  const url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  const resp = await aws.fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: buffer });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`S3 upload failed: ${resp.status} ${resp.statusText} – ${body.slice(0, 1000)}`);
  return `s3://${s3Bucket}/${key}`;
}

async function createEmbedding(text: string) {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`OpenAI embedding failed: ${r.status} ${r.statusText} – ${t.slice(0, 1000)}`);
  const data = JSON.parse(t);
  return data.data[0].embedding as number[];
}

// Enhanced figure analysis using vision model
async function analyzeFigureWithVision(imageData: string, context: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${openaiApiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using vision-capable model
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this technical diagram from an arcade game manual. Context: ${context}. 
              Provide a detailed description focusing on: 
              1. Components and their labels
              2. Connections and wiring
              3. Part numbers or specifications visible
              4. Troubleshooting information
              5. Safety warnings or important notes
              Be specific about technical details that would help a technician.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
              }
            }
          ]
        }],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.warn("Vision analysis failed, falling back to basic processing");
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.warn("Vision analysis error:", error);
    return null;
  }
}

// Semantic chunking with hierarchical structure
function extractSemanticChunks(jsonData: any[]): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string; chunk_type?: string; parent_id?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string; chunk_type?: string; parent_id?: string}> = [];
  
  for (const page of jsonData) {
    if (!page.blocks || !Array.isArray(page.blocks)) continue;
    
    let currentSection = "";
    let currentSubsection = "";
    let currentContent = "";
    const pageNum = page.page || null;
    let sectionId = "";
    
    for (const block of page.blocks) {
      const blockText = block.content || block.text || "";
      if (!blockText.trim()) continue;
      
      // Enhanced junk filtering
      if (blockText.match(/^[A-Z0-9_]+\.(VSD|PDF|DOC|DWG)$/i) || 
          blockText.match(/^[#\d\s\-_]+$/) ||
          blockText.match(/^(FILENAME|ENGINEER|DRAWN BY|DATE|REVISED|PAGE \d+ OF \d+|VENDOR|COPYRIGHT|PROPRIETARY)[\s\d]*$/i) ||
          blockText.length < 15 ||
          blockText.match(/^(Figure|Fig|Diagram|Table|Chart)\s*\d*$/i)) {
        continue;
      }
      
      // Detect content hierarchy
      const isMainTitle = blockText.match(/^[A-Z\s&]{5,}$/) || block.block_type === "title";
      const isSubtitle = blockText.match(/^\d+\.\s/) || blockText.match(/^[A-Z][a-z\s]+:$/);
      const isTableOfContents = blockText.toLowerCase().includes("table of contents");
      
      if (isTableOfContents) continue;
      
      if (isMainTitle && !isSubtitle) {
        // Save previous section
        if (currentContent.trim() && currentContent.length > 100) {
          chunks.push({
            content: `${currentSection}\n\n${currentContent}`.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: currentSection,
            chunk_type: "section",
            parent_id: sectionId
          });
        }
        
        currentSection = blockText.trim();
        currentSubsection = "";
        currentContent = "";
        sectionId = crypto.randomUUID();
        
      } else if (isSubtitle) {
        // Save previous subsection
        if (currentContent.trim() && currentContent.length > 80) {
          chunks.push({
            content: `${currentSection}\n${currentSubsection}\n\n${currentContent}`.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: `${currentSection} > ${currentSubsection}`,
            chunk_type: "subsection",
            parent_id: sectionId
          });
        }
        
        currentSubsection = blockText.trim();
        currentContent = "";
        
      } else {
        // Regular content
        currentContent += blockText + "\n\n";
      }
    }
    
    // Save final content for this page
    if (currentContent.trim() && currentContent.length > 80) {
      chunks.push({
        content: `${currentSection}\n${currentSubsection}\n\n${currentContent}`.trim(),
        page_start: pageNum,
        page_end: pageNum,
        menu_path: currentSubsection ? `${currentSection} > ${currentSubsection}` : currentSection,
        chunk_type: currentSubsection ? "subsection" : "section",
        parent_id: sectionId
      });
    }
  }
  
  // Enhanced deduplication with semantic similarity
  const deduped: typeof chunks = [];
  const seen = new Map<string, typeof chunks[0]>();
  
  for (const chunk of chunks) {
    const normalized = chunk.content.toLowerCase().replace(/\s+/g, ' ').trim();
    const fingerprint = normalized.slice(0, 150); // Semantic fingerprint
    
    const existing = seen.get(fingerprint);
    if (!existing || chunk.content.length > existing.content.length) {
      seen.set(fingerprint, chunk);
    }
  }
  
  return Array.from(seen.values());
}

// This function is replaced by extractSemanticChunks above

function extractChunksFromMarkdown(text: string): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
  
  // Split on headings (## or ###)
  const sections = text.split(/^#{2,3}\s+(.+)$/m);
  
  for (let i = 1; i < sections.length; i += 2) {
    const heading = sections[i]?.trim();
    const content = sections[i + 1]?.trim();
    
    if (content && content.length > 120) {
      // Filter out junk
      if (!content.match(/^(FILENAME|ENGINEER|DRAWN BY|COPYRIGHT|PROPRIETARY)/i)) {
        chunks.push({
          content: heading ? `${heading}\n\n${content}` : content,
          menu_path: heading || undefined
        });
      }
    }
  }
  
  // If no headings, split on double newlines and take larger chunks
  if (chunks.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 150);
    for (const para of paragraphs) {
      if (!para.match(/^(FILENAME|ENGINEER|DRAWN BY|COPYRIGHT)/i)) {
        chunks.push({ content: para.trim() });
      }
    }
  }
  
  return chunks;
}

// Plain text chunking as final fallback
function chunkPlainText(text: string): Array<{content: string}> {
  const chunks: Array<{content: string}> = [];
  
  // Simple sentence-based chunking
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50);
  const chunkSize = 5; // 5 sentences per chunk
  
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join('. ').trim();
    if (chunk.length > 120 && !chunk.match(/^(FILENAME|ENGINEER|DRAWN BY)/i)) {
      chunks.push({ content: chunk });
    }
  }
  
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("LlamaCloud webhook received");
    const payload = await req.json();
    
    console.log("Webhook payload keys:", Object.keys(payload || {}));
    console.log("Webhook sample (trimmed):", JSON.stringify(payload).slice(0, 2000));

    // LlamaCloud sends jobId - look up manual_id from documents table
    const jobId = payload.jobId;
    if (!jobId) {
      throw new Error("No jobId found in payload");
    }

    // Look up manual_id and fec_tenant_id from documents table using job_id
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("manual_id, fec_tenant_id")
      .eq("job_id", jobId)
      .single();

    if (docError || !docData) {
      console.error("Failed to find document with job_id:", jobId, docError);
      throw new Error(`No document found for job_id: ${jobId}`);
    }

    // Set tenant context for this session to ensure data isolation
    await supabase.rpc('set_tenant_context', {
      tenant_id: docData.fec_tenant_id
    });
    console.log(`Set tenant context: ${docData.fec_tenant_id}`);

    const manual_id = docData.manual_id;
    console.log(`Processing manual: ${manual_id} (job: ${jobId})`);

    // Clear old data for safe re-ingestion
    console.log("🧹 Clearing old data for safe re-ingestion...");
    await supabase.from('chunks_text').delete().eq('manual_id', manual_id);
    await supabase.from('figures').delete().eq('manual_id', manual_id);
    console.log("✅ Old data cleared successfully");

    // Extract chunks using fallback approach (JSON → MD → TXT)
    let chunks: any[] = [];
    if (payload.json && Array.isArray(payload.json)) {
      chunks = extractSemanticChunks(payload.json);
      console.log(`Extracted ${chunks.length} semantic chunks with hierarchical structure`);
    }
    
    // FALLBACK 1: If no chunks from JSON, try markdown
    if (chunks.length === 0) {
      console.warn("No chunks from JSON, falling back to markdown");
      const text_markdown = payload.md || "";
      if (text_markdown) {
        chunks = extractChunksFromMarkdown(text_markdown);
        console.log(`Fallback: Extracted ${chunks.length} chunks from markdown`);
      }
    }
    
    // FALLBACK 2: If still no chunks, try plain text
    if (chunks.length === 0) {
      console.warn("No chunks from markdown, falling back to plain text");
      const text_plain = payload.txt || "";
      if (text_plain) {
        chunks = chunkPlainText(text_plain);
        console.log(`Fallback: Extracted ${chunks.length} chunks from plain text`);
      }
    }

    // Enhanced figure processing with better error handling and logging
    const figures: any[] = [];
    console.log("🖼️ Starting figure extraction...");
    console.log("Payload structure:", {
      hasJson: !!payload.json,
      hasImages: !!payload.images,
      jsonLength: Array.isArray(payload.json) ? payload.json.length : 0,
      imagesType: typeof payload.images,
      imagesLength: Array.isArray(payload.images) ? payload.images.length : (payload.images ? Object.keys(payload.images).length : 0)
    });

    if (payload.json && Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          console.log(`📄 Page ${page.page} has ${page.images.length} images`);
          for (const img of page.images) {
            console.log("Image metadata:", {
              name: img.name,
              hasName: !!img.name,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height
            });

            // Enhanced image data matching with multiple strategies
            let imageData = null;
            const imageName = img.name;
            
            if (payload.images) {
              if (Array.isArray(payload.images)) {
                // Strategy 1: Find by image name in array
                imageData = payload.images.find((imgData: string) => 
                  typeof imgData === 'string' && imgData.includes(imageName)
                );
                
                // Strategy 2: Use index if array matches page images
                if (!imageData && payload.images.length === page.images.length) {
                  const imgIndex = page.images.indexOf(img);
                  imageData = payload.images[imgIndex];
                }
              } else if (typeof payload.images === 'object') {
                // Strategy 3: Object lookup by image name
                imageData = payload.images[imageName] || payload.images[imageName?.replace(/\.[^/.]+$/, "")];
              }
            }

            console.log("Image data found:", {
              hasImageData: !!imageData,
              dataType: typeof imageData,
              dataLength: imageData ? imageData.length : 0,
              startsWithData: imageData ? imageData.startsWith('data:') : false,
              hasComma: imageData ? imageData.includes(',') : false
            });
            
            figures.push({
              figure_id: imageName?.replace(/\.[^/.]+$/, "") || crypto.randomUUID(),
              image_data: imageData,
              caption_text: img.caption || img.alt || null,
              ocr_text: img.text || null,
              page_number: page.page,
              callouts: img.callouts || null,
              bbox_pdf_coords: JSON.stringify({
                x: img.x || 0,
                y: img.y || 0,
                width: img.width || 0,
                height: img.height || 0
              })
            });
          }
        }
      }
    }

    console.log(`Found ${figures.length} figures to process`);

    // Enhanced figure processing with robust error handling
    let processedFigures = 0;
    let skippedFigures = 0;
    
    console.log(`🔄 Processing ${figures.length} figures...`);
    
    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      console.log(`📷 Processing figure ${i + 1}/${figures.length}: ${fig.figure_id}`);
      
      try {
        if (!fig.image_data) {
          console.warn(`⚠️ Skipping figure ${fig.figure_id}: no image data`);
          skippedFigures++;
          continue;
        }
        
        // Enhanced base64 processing with validation
        let base64Data = fig.image_data;
        let contentType = "image/png"; // Default
        
        // Handle different base64 formats
        if (base64Data.startsWith('data:')) {
          // Extract content type and base64 data from data URL
          const [header, data] = base64Data.split(',');
          if (header && data) {
            const mimeMatch = header.match(/data:([^;]+)/);
            if (mimeMatch) contentType = mimeMatch[1];
            base64Data = data;
          } else {
            console.warn(`⚠️ Invalid data URL format for ${fig.figure_id}`);
            skippedFigures++;
            continue;
          }
        }
        
        // Validate base64 data
        if (!base64Data || base64Data.length < 100) {
          console.warn(`⚠️ Base64 data too short for ${fig.figure_id}: ${base64Data?.length || 0} chars`);
          skippedFigures++;
          continue;
        }
        
        // Validate base64 format
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(base64Data)) {
          console.warn(`⚠️ Invalid base64 format for ${fig.figure_id}`);
          skippedFigures++;
          continue;
        }
        
        // Convert base64 to buffer with error handling
        let buffer: Uint8Array;
        try {
          const binaryString = atob(base64Data);
          buffer = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            buffer[j] = binaryString.charCodeAt(j);
          }
        } catch (decodeError) {
          console.error(`❌ Base64 decode failed for ${fig.figure_id}:`, decodeError);
          skippedFigures++;
          continue;
        }
        
        // Validate buffer size
        if (buffer.length < 100) {
          console.warn(`⚠️ Decoded buffer too small for ${fig.figure_id}: ${buffer.length} bytes`);
          skippedFigures++;
          continue;
        }
        
        console.log(`✅ Successfully decoded ${fig.figure_id}: ${buffer.length} bytes`);
        
        // Upload to S3 with retry
        const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
        const key = `manuals/${manual_id}/${fig.figure_id}.${ext}`;
        
        let s3Uri: string;
        let uploadAttempts = 0;
        const maxRetries = 2;
        
        while (uploadAttempts <= maxRetries) {
          try {
            s3Uri = await uploadToS3(buffer, key, contentType);
            console.log(`📤 Uploaded ${fig.figure_id} to S3: ${s3Uri}`);
            break;
          } catch (uploadError) {
            uploadAttempts++;
            console.warn(`⚠️ S3 upload attempt ${uploadAttempts} failed for ${fig.figure_id}:`, uploadError);
            if (uploadAttempts > maxRetries) {
              throw uploadError;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Enhanced figure analysis with graceful fallback
        let visionAnalysis: string | null = null;
        try {
          visionAnalysis = await analyzeFigureWithVision(
            fig.image_data, 
            `Manual: ${manual_id}, Page: ${fig.page_number}`
          );
          if (visionAnalysis) {
            console.log(`🔍 Vision analysis completed for ${fig.figure_id}`);
          } else {
            console.log(`🔍 Vision analysis returned null for ${fig.figure_id}`);
          }
        } catch (visionError) {
          console.warn(`⚠️ Vision analysis failed for ${fig.figure_id}:`, visionError);
          // Continue without vision analysis
        }

        // Create figure content for embedding
        const figureContent = [
          fig.caption_text || "",
          fig.ocr_text || "",
          visionAnalysis || ""
        ].filter(Boolean).join("\n");

        // Generate embedding if we have content
        let embedding: number[] | null = null;
        if (figureContent.length > 10) {
          try {
            embedding = await createEmbedding(figureContent);
            console.log(`🔗 Generated embedding for ${fig.figure_id}`);
          } catch (embeddingError) {
            console.warn(`⚠️ Embedding generation failed for ${fig.figure_id}:`, embeddingError);
          }
        }

        // Insert figure record with all available data
        const { error: figErr } = await supabase.from("figures").insert({
          manual_id,
          page_number: fig.page_number ?? null,
          figure_id: fig.figure_id,
          image_url: s3Uri!,
          caption_text: fig.caption_text ?? null,
          ocr_text: fig.ocr_text ?? null,
          callouts_json: fig.callouts ?? null,
          bbox_pdf_coords: fig.bbox_pdf_coords ?? null,
          embedding_text: embedding,
          fec_tenant_id: docData.fec_tenant_id,
        });
        
        if (figErr) {
          console.error(`❌ Database insert failed for ${fig.figure_id}:`, figErr);
        } else {
          processedFigures++;
          console.log(`✅ Successfully processed figure ${fig.figure_id}`);
        }
        
      } catch (e) {
        console.error(`❌ Critical error processing figure ${fig.figure_id}:`, e);
        skippedFigures++;
      }
    }
    
    console.log(`📊 Figure processing summary: ${processedFigures} processed, ${skippedFigures} skipped`)

    // Process chunks → embeddings → DB
    let processedChunks = 0;
    if (chunks && chunks.length > 0) {
      console.log(`Processing ${chunks.length} quality chunks`);
      for (const ch of chunks) {
        try {
          const embedding = await createEmbedding(ch.content);
          const { error: insErr } = await supabase.from("chunks_text").insert({
            manual_id,
            page_start: ch.page_start ?? null,
            page_end: ch.page_end ?? null,
            menu_path: ch.menu_path ?? null,
            content: ch.content,
            embedding,
            fec_tenant_id: docData.fec_tenant_id,
            // content_hash is auto-generated as md5(content) - don't set it manually
          });
          if (insErr) console.error("chunks_text insert error:", insErr);
          else processedChunks++;
        } catch (e) {
          console.error("Chunk embed/insert error:", e);
        }
      }
    }

    // Update document timestamp
    await supabase.from("documents").update({ updated_at: new Date().toISOString() }).eq("manual_id", manual_id);

    // Update processing status with final results
    await supabase.from("processing_status").upsert({
      job_id: jobId,
      manual_id,
      status: 'completed',
      stage: 'finished',
      current_task: 'Processing complete',
      progress_percent: 100,
      total_chunks: chunks.length,
      chunks_processed: processedChunks,
      total_figures: figures.length,
      figures_processed: processedFigures,
      fec_tenant_id: docData.fec_tenant_id,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'job_id'
    });

    console.log(`✅ Processing complete: ${processedChunks}/${chunks.length} chunks, ${processedFigures}/${figures.length} figures for manual ${manual_id}`);
    return new Response(JSON.stringify({
      success: true,
      manual_id,
      processed_chunks: processedChunks,
      total_chunks: chunks.length,
      processed_figures: processedFigures,
      total_figures: figures.length,
      skipped_figures: figures.length - processedFigures,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("llama-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message, details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});