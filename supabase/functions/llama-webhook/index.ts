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

    // Process images from LlamaCloud json structure for better metadata
    const figures: any[] = [];
    if (payload.json && Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          for (const img of page.images) {
            // Create a data URL for the image (LlamaCloud provides base64 in images array)
            const imageName = img.name;
            const imageData = payload.images ? payload.images.find((imgData: string) => imgData.includes(imageName)) : null;
            
            figures.push({
              figure_id: imageName?.replace(/\.[^/.]+$/, "") || crypto.randomUUID(),
              image_data: imageData, // Store base64 data temporarily
              caption_text: null,
              ocr_text: null,
              page_number: page.page,
              callouts: null,
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

    // Process figures - convert base64 to actual files and upload to S3
    let processedFigures = 0;
    for (const fig of figures) {
      try {
        if (!fig.image_data) continue;
        
        // Extract base64 data (assuming it's in format "data:image/png;base64,...")
        let base64Data = fig.image_data;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        // Convert base64 to buffer
        const buffer = new Uint8Array(atob(base64Data).split('').map(c => c.charCodeAt(0)));
        
        const ext = "png"; // Default to PNG for LlamaCloud images
        const key = `manuals/${manual_id}/${fig.figure_id}.${ext}`;
        const s3Uri = await uploadToS3(buffer, key, "image/png");

        // Enhanced figure analysis with vision model
        const visionAnalysis = await analyzeFigureWithVision(
          fig.image_data, 
          `Manual: ${manual_id}, Page: ${fig.page_number}`
        );

        const figureContent = [
          fig.caption_text || "",
          fig.ocr_text || "",
          visionAnalysis || ""
        ].filter(Boolean).join("\n");

        const embedding = figureContent.length > 10 ? await createEmbedding(figureContent) : null;

        const { error: figErr } = await supabase.from("figures").insert({
          manual_id,
          page_number: fig.page_number ?? null,
          figure_id: fig.figure_id,
          image_url: s3Uri,
          caption_text: fig.caption_text ?? null,
          ocr_text: fig.ocr_text ?? null,
          callouts_json: fig.callouts ?? null,
          bbox_pdf_coords: fig.bbox_pdf_coords ?? null,
          embedding_text: embedding,
          fec_tenant_id: docData.fec_tenant_id,
        });
        if (figErr) console.error("figures insert error:", figErr);
        else processedFigures++;
      } catch (e) {
        console.error("Figure process error:", e);
      }
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
            content_hash: crypto.randomUUID() // For tracking hierarchical relationships
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

    console.log(`✅ Processing complete: ${processedChunks} chunks, ${processedFigures} figures for manual ${manual_id}`);
    return new Response(JSON.stringify({
      success: true,
      manual_id,
      processed_chunks: processedChunks,
      processed_figures: processedFigures,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("llama-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message, details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});