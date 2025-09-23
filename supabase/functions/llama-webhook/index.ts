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

// Universal image resolver - handles all possible input formats
async function resolveImageData(imageInput: any): Promise<{buffer: Uint8Array, contentType: string, ext: string}> {
  let base64Data: string = '';
  let contentType: string = 'image/png';
  
  try {
    // Handle different input formats
    if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:')) {
        // Data URL format: data:image/png;base64,iVBORw0...
        const [header, data] = imageInput.split(',');
        if (!header || !data) throw new Error('Invalid data URL format');
        
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) contentType = mimeMatch[1];
        base64Data = data;
      } else if (imageInput.startsWith('http')) {
        // Remote URL - fetch and convert
        const response = await fetch(imageInput);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        
        contentType = response.headers.get('content-type') || 'image/png';
        const arrayBuffer = await response.arrayBuffer();
        base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      } else {
        // Raw base64 string
        base64Data = imageInput;
      }
    } else if (typeof imageInput === 'object' && imageInput !== null) {
      // Object format: {data, base64, url, image_data, b64_json, etc.}
      const possibleKeys = ['data', 'base64', 'b64_json', 'image_data', 'url', 'content'];
      let found = false;
      
      for (const key of possibleKeys) {
        if (imageInput[key]) {
          const result = await resolveImageData(imageInput[key]);
          return result;
        }
      }
      
      if (!found) throw new Error('No recognized image data key found in object');
    } else {
      throw new Error(`Unsupported image input type: ${typeof imageInput}`);
    }

    // Validate base64
    if (!base64Data || base64Data.length < 100) {
      throw new Error(`Base64 data too short: ${base64Data?.length || 0} chars`);
    }

    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      throw new Error('Invalid base64 format');
    }

    // Convert to buffer
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    if (buffer.length < 100) {
      throw new Error(`Decoded buffer too small: ${buffer.length} bytes`);
    }

    // Detect MIME type from magic bytes if not set
    if (contentType === 'image/png' && buffer.length >= 8) {
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) contentType = 'image/jpeg';
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) contentType = 'image/gif';
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) contentType = 'image/webp';
    }

    const ext = contentType.includes('jpeg') ? 'jpg' : 
                contentType.includes('gif') ? 'gif' :
                contentType.includes('webp') ? 'webp' : 'png';

    return { buffer, contentType, ext };
  } catch (error) {
    throw new Error(`Image resolution failed: ${error.message}`);
  }
}

// Comprehensive image source detection
function findAllImageSources(payload: any, imageName: string): any[] {
  const sources: any[] = [];
  
  if (!payload.images) return sources;

  try {
    // Strategy A: Array of strings with name matching
    if (Array.isArray(payload.images)) {
      const nameMatch = payload.images.find((item: any) => 
        typeof item === 'string' && item.includes(imageName)
      );
      if (nameMatch) sources.push(nameMatch);

      // Strategy B: Array of objects with various formats
      const objectMatches = payload.images.filter((item: any) => 
        typeof item === 'object' && item !== null && (
          item.name === imageName || 
          item.filename === imageName ||
          item.id === imageName
        )
      );
      sources.push(...objectMatches);

      // Strategy C: Index-based matching (if arrays align)
      if (payload.json && Array.isArray(payload.json)) {
        for (const page of payload.json) {
          if (page.images && Array.isArray(page.images)) {
            const imgIndex = page.images.findIndex((img: any) => img.name === imageName);
            if (imgIndex >= 0 && imgIndex < payload.images.length) {
              sources.push(payload.images[imgIndex]);
            }
          }
        }
      }
    }

    // Strategy D: Object keyed by filename
    if (typeof payload.images === 'object' && !Array.isArray(payload.images)) {
      const directMatch = payload.images[imageName];
      if (directMatch) sources.push(directMatch);

      // Try without extension
      const nameWithoutExt = imageName?.replace(/\.[^/.]+$/, "");
      const matchWithoutExt = payload.images[nameWithoutExt];
      if (matchWithoutExt) sources.push(matchWithoutExt);

      // Try common variations
      const variations = [
        imageName?.toLowerCase(),
        imageName?.toUpperCase(),
        `img_${imageName}`,
        `figure_${imageName}`
      ].filter(Boolean);
      
      for (const variation of variations) {
        if (payload.images[variation]) {
          sources.push(payload.images[variation]);
        }
      }
    }

    // Strategy E: Deep search in JSON structure
    if (payload.json && Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          for (const img of page.images) {
            if (img.name === imageName) {
              // Look for embedded data
              const embeddedKeys = ['data', 'base64', 'image_data', 'url', 'src'];
              for (const key of embeddedKeys) {
                if (img[key]) sources.push(img[key]);
              }
            }
          }
        }
      }
    }

    console.log(`🔍 Found ${sources.length} potential sources for image ${imageName}`);
    return sources;
  } catch (error) {
    console.warn(`⚠️ Error in image source detection for ${imageName}:`, error);
    return sources;
  }
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
        max_completion_tokens: 500
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

            // Bulletproof image source detection with fallback chain
            const imageName = img.name;
            const imageSources = findAllImageSources(payload, imageName);
            
            console.log(`🔍 Image source detection for ${imageName}:`, {
              sourcesFound: imageSources.length,
              sourceTypes: imageSources.map(s => typeof s),
              sourcePreview: imageSources.map(s => 
                typeof s === 'string' ? s.slice(0, 50) + '...' : 
                typeof s === 'object' ? Object.keys(s) : String(s)
              )
            });
            
            figures.push({
              figure_id: imageName?.replace(/\.[^/.]+$/, "") || crypto.randomUUID(),
              image_sources: imageSources, // Store all potential sources
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

    // Bulletproof figure processing with comprehensive error handling
    let processedFigures = 0;
    let skippedFigures = 0;
    const processingErrors: Array<{figure_id: string, error: string, sources_tried: number}> = [];
    
    console.log(`🔄 Processing ${figures.length} figures...`);
    
    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      console.log(`📷 Processing figure ${i + 1}/${figures.length}: ${fig.figure_id}`);
      
      try {
        if (!fig.image_sources || fig.image_sources.length === 0) {
          console.warn(`⚠️ Skipping figure ${fig.figure_id}: no image sources found`);
          skippedFigures++;
          processingErrors.push({
            figure_id: fig.figure_id,
            error: 'No image sources found',
            sources_tried: 0
          });
          continue;
        }
        
        // Try each image source until one works (fallback chain)
        let resolvedImage: {buffer: Uint8Array, contentType: string, ext: string} | null = null;
        let sourcesTried = 0;
        let lastError = '';
        
        for (const source of fig.image_sources) {
          sourcesTried++;
          console.log(`🔄 Trying source ${sourcesTried}/${fig.image_sources.length} for ${fig.figure_id}`);
          
          try {
            resolvedImage = await resolveImageData(source);
            console.log(`✅ Successfully resolved ${fig.figure_id} from source ${sourcesTried}: ${resolvedImage.buffer.length} bytes (${resolvedImage.contentType})`);
            break;
          } catch (sourceError) {
            lastError = sourceError.message;
            console.warn(`⚠️ Source ${sourcesTried} failed for ${fig.figure_id}: ${lastError}`);
            continue;
          }
        }
        
        if (!resolvedImage) {
          console.error(`❌ All ${sourcesTried} sources failed for ${fig.figure_id}. Last error: ${lastError}`);
          skippedFigures++;
          processingErrors.push({
            figure_id: fig.figure_id,
            error: `All sources failed. Last: ${lastError}`,
            sources_tried: sourcesTried
          });
          continue;
        }
        
        // Upload to S3 with retry
        const key = `manuals/${manual_id}/${fig.figure_id}.${resolvedImage.ext}`;
        
        let s3Uri: string;
        let uploadAttempts = 0;
        const maxRetries = 2;
        
        while (uploadAttempts <= maxRetries) {
          try {
            s3Uri = await uploadToS3(resolvedImage.buffer, key, resolvedImage.contentType);
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
          // Use the first valid source for vision analysis
          const firstValidSource = fig.image_sources[0];
          const analysisData = typeof firstValidSource === 'string' ? firstValidSource :
                               firstValidSource?.data || firstValidSource?.base64 || firstValidSource?.url;
          
          if (analysisData) {
            visionAnalysis = await analyzeFigureWithVision(
              analysisData, 
              `Manual: ${manual_id}, Page: ${fig.page_number}`
            );
            if (visionAnalysis) {
              console.log(`🔍 Vision analysis completed for ${fig.figure_id}`);
            } else {
              console.log(`🔍 Vision analysis returned null for ${fig.figure_id}`);
            }
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
    
    console.log(`📊 Figure processing summary: ${processedFigures} processed, ${skippedFigures} skipped`);
    
    // Log detailed error analysis
    if (processingErrors.length > 0) {
      console.log(`🔍 Figure processing errors analysis:`);
      const errorsByType = processingErrors.reduce((acc, err) => {
        acc[err.error] = (acc[err.error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      for (const [errorType, count] of Object.entries(errorsByType)) {
        console.log(`  - ${errorType}: ${count} figures`);
      }
      
      const avgSourcesTried = processingErrors.reduce((sum, err) => sum + err.sources_tried, 0) / processingErrors.length;
      console.log(`  - Average sources tried per failed figure: ${avgSourcesTried.toFixed(1)}`);
    }

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

    // Update processing status with final results and error details
    const errorSummary = processingErrors.length > 0 ? {
      total_errors: processingErrors.length,
      error_types: processingErrors.reduce((acc, err) => {
        acc[err.error] = (acc[err.error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avg_sources_tried: processingErrors.reduce((sum, err) => sum + err.sources_tried, 0) / processingErrors.length
    } : null;

    await supabase.from("processing_status").upsert({
      job_id: jobId,
      manual_id,
      status: 'completed',
      stage: 'finished',
      current_task: `Processing complete - ${processedFigures}/${figures.length} figures successful`,
      progress_percent: 100,
      total_chunks: chunks.length,
      chunks_processed: processedChunks,
      total_figures: figures.length,
      figures_processed: processedFigures,
      error_message: errorSummary ? `Figure errors: ${JSON.stringify(errorSummary)}` : null,
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