// supabase/functions/llama-webhook/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FEATURE FLAGS - DEFAULT OFF TO PREVENT EXPENSIVE OPERATIONS IN WEBHOOK
const ENHANCE_IN_WEBHOOK = (Deno.env.get("ENHANCE_IN_WEBHOOK") ?? "false").toLowerCase() === "true";
const PROCESS_FIGURES_IN_WEBHOOK = (Deno.env.get("PROCESS_FIGURES_IN_WEBHOOK") ?? "false").toLowerCase() === "true";
const UPLOAD_FIGURES_IN_WEBHOOK = (Deno.env.get("UPLOAD_FIGURES_IN_WEBHOOK") ?? "false").toLowerCase() === "true";
const EMBED_FIGURES_IN_WEBHOOK = (Deno.env.get("EMBED_FIGURES_IN_WEBHOOK") ?? "false").toLowerCase() === "true";

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

// S3 upload function (GUARDED - only runs if UPLOAD_FIGURES_IN_WEBHOOK=true)
async function uploadToS3(buffer: Uint8Array, key: string, contentType = "application/octet-stream"): Promise<{httpUrl: string; s3Uri: string; size: number; contentType: string}> {
  if (!UPLOAD_FIGURES_IN_WEBHOOK) {
    console.log("🚫 uploadToS3 called but UPLOAD_FIGURES_IN_WEBHOOK=false");
    throw new Error("S3 upload disabled in webhook");
  }
  
  const httpUrl = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  const s3Uri = `s3://${s3Bucket}/${key}`;
  
  const resp = await aws.fetch(httpUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buffer)
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`S3 upload failed: ${resp.status} ${resp.statusText} – ${body.slice(0, 1000)}`);

  // (optional) keep your debug logs
  const magicBytes = Array.from(buffer.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`🔎 Magic bytes for ${key}: ${magicBytes}`);
  console.log(`🪣 S3 verify -> key=${key} size=${buffer.length}B type=${contentType}`);

  // Return complete upload metadata
  return {
    httpUrl,
    s3Uri,
    size: buffer.length,
    contentType
  };
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

// Batch embeddings for efficiency
async function createEmbeddingsBatch(texts: string[], model = "text-embedding-3-small") {
  const inputs = texts.map(text => text.length > 8000 ? text.slice(0, 8000) : text);
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: inputs }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`OpenAI batch embedding failed: ${r.status} ${r.statusText} – ${t.slice(0, 1000)}`);
  const data = JSON.parse(t);
  return data.data.map((item: any) => item.embedding as number[]);
}

/* ============================
   PATCH START: Image helpers
   ============================ */

// Universal image resolver (string/URL/object) → bytes + contentType + ext
async function resolveImageInput(imageInput: any): Promise<{buffer: Uint8Array, contentType: string, ext: string}> {
  let base64Data = "";
  let contentType = "image/png";

  // Accept strings: data URLs, http(s) URLs, raw base64
  if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const [header, data] = imageInput.split(",");
      if (!header || !data) throw new Error("Invalid data URL format");
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) contentType = mimeMatch[1];
      base64Data = data;
    } else if (imageInput.startsWith("http")) {
      const response = await fetch(imageInput);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    } else {
      base64Data = imageInput; // raw base64
    }
  } else if (imageInput && typeof imageInput === "object") {
    // Try common keys: data/base64/b64_json/image_data/url/content
    const keys = ["data", "base64", "b64_json", "image_data", "url", "content"];
    for (const k of keys) {
      if (imageInput[k]) {
        return resolveImageInput(imageInput[k]); // recurse
      }
    }
    throw new Error("No recognized image data key found in object");
  } else {
    throw new Error(`Unsupported image input type: ${typeof imageInput}`);
  }

  // Validate base64
  if (!base64Data || base64Data.length < 100) throw new Error(`Base64 too short: ${base64Data?.length || 0}`);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) throw new Error("Invalid base64 format");

  // Convert to bytes
  let buffer: Uint8Array;
  try {
    const bin = atob(base64Data);
    buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
  } catch {
    throw new Error("Base64 decode failed");
  }
  if (buffer.length < 100) throw new Error(`Decoded buffer too small: ${buffer.length} bytes`);

  // Sniff common mime types by magic bytes if unknown
  if (contentType === "image/png" && buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) contentType = "image/jpeg";
    else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) contentType = "image/gif";
    else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) contentType = "image/webp";
  }
  const ext =
    contentType.includes("jpeg") ? "jpg" :
    contentType.includes("gif") ? "gif" :
    contentType.includes("webp") ? "webp" : "png";

  return { buffer, contentType, ext };
}

// Collect all plausible sources for a given image name from payload
function findAllImageSources(payload: any, imageName: string): any[] {
  const sources: any[] = [];
  if (!payload?.images) return sources;

  try {
    if (Array.isArray(payload.images)) {
      // Array of strings or objects
      const nameMatch = payload.images.find((x: any) => typeof x === "string" && x.includes(imageName));
      if (nameMatch) sources.push(nameMatch);

      const objectMatches = payload.images.filter(
        (x: any) => x && typeof x === "object" && (x.name === imageName || x.filename === imageName || x.id === imageName),
      );
      sources.push(...objectMatches);

      // Index-aligned fallback if counts happen to match
      if (payload.json && Array.isArray(payload.json)) {
        for (const page of payload.json) {
          if (page.images && Array.isArray(page.images)) {
            const idx = page.images.findIndex((img: any) => img.name === imageName);
            if (idx >= 0 && idx < payload.images.length) sources.push(payload.images[idx]);
          }
        }
      }
    } else if (typeof payload.images === "object") {
      // Object keyed by name variations
      const direct = payload.images[imageName];
      if (direct) sources.push(direct);

      const base = imageName?.replace(/\.[^/.]+$/, "");
      if (payload.images[base]) sources.push(payload.images[base]);

      const variations = [
        imageName?.toLowerCase(),
        imageName?.toUpperCase(),
        `img_${imageName}`,
        `figure_${imageName}`,
      ].filter(Boolean);
      for (const v of variations) {
        if (payload.images[v]) sources.push(payload.images[v]);
      }
    }

    // Embedded in page JSON
    if (Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          for (const img of page.images) {
            if (img.name === imageName) {
              const embeddedKeys = ["data", "base64", "image_data", "url", "src"];
              for (const k of embeddedKeys) if (img[k]) sources.push(img[k]);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn(`⚠️ Error detecting sources for ${imageName}:`, e);
  }

  return sources;
}
/* ============================
   PATCH END: Image helpers
   ============================ */

// Fetch an image file (bytes) from LlamaCloud result images by jobId + filename
async function fetchImageFromLlama(jobId: string, filename: string): Promise<{buffer: Uint8Array, contentType: string, ext: string}> {
  // LlamaCloud correct image result endpoint
  const url = `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${encodeURIComponent(jobId)}/result/image/${encodeURIComponent(filename)}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("LLAMACLOUD_API_KEY")!}`
    }
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Llama assets fetch failed (${resp.status} ${resp.statusText}) for ${filename}: ${txt.slice(0, 500)}`);
  }

  // Get content-type and bytes
  const contentType = resp.headers.get("content-type") || "image/png";
  const arr = new Uint8Array(await resp.arrayBuffer());

  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("gif")) ext = "gif";
  else if (contentType.includes("webp")) ext = "webp";

  if (arr.length < 100) {
    throw new Error(`Downloaded asset too small (${arr.length} bytes) for ${filename}`);
  }

  return { buffer: arr, contentType, ext };
}

// Vision analysis (GUARDED - only runs if ENHANCE_IN_WEBHOOK=true)
async function analyzeFigureWithVision(imageData: string, context: string) {
  if (!ENHANCE_IN_WEBHOOK) {
    console.log("🚫 analyzeFigureWithVision called but ENHANCE_IN_WEBHOOK=false");
    return null;
  }
  if (!openaiApiKey) {
    console.error("❌ OPENAI_API_KEY not available - skipping vision analysis");
    return null;
  }
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this technical diagram from an arcade game manual. Context: ${context}.
              Focus on: (1) components/labels, (2) wiring/connectors, (3) specs/part numbers, (4) troubleshooting hints, (5) safety notes. Be specific.`,
            },
            {
              type: "image_url", 
              image_url: { url: imageData },
            },
          ],
        }],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Vision analysis failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 300)}`);
      return null;
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error(`❌ Vision analysis error:`, error);
    return null;
  }
}

// AI-powered OCR and caption generation (GUARDED - only runs if ENHANCE_IN_WEBHOOK=true)
async function enhanceFigureWithAI(imageData: string, context: string): Promise<{caption: string | null, ocrText: string | null}> {
  if (!ENHANCE_IN_WEBHOOK) {
    console.log("🚫 enhanceFigureWithAI called but ENHANCE_IN_WEBHOOK=false");
    return {caption: null, ocrText: null};
  }
  if (!openaiApiKey) {
    console.error("❌ OPENAI_API_KEY not available - skipping AI enhancement");
    return {caption: null, ocrText: null};
  }
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `You are an expert at analyzing technical diagrams and images from arcade game manuals. Your job is to:
1. Generate a descriptive caption for the image (focus on what it shows functionally)
2. Extract any visible text from the image (OCR)

Respond in JSON format:
{
  "caption": "Brief descriptive caption of what the image shows",
  "ocr_text": "All visible text extracted from the image, or null if no text"
}`
        }, {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image from an arcade game manual. Context: ${context}. Provide a caption and extract any text.`
            },
            {
              type: "image_url",
              image_url: { url: imageData }
            }
          ]
        }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ OpenAI API failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
      return {caption: null, ocrText: null};
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return {caption: null, ocrText: null};

    try {
      const parsed = JSON.parse(content);
      return {
        caption: parsed.caption || null,
        ocrText: parsed.ocr_text || null
      };
    } catch {
      // Fallback: treat the response as a caption
      return {caption: content.slice(0, 200), ocrText: null};
    }
  } catch (error) {
    console.warn(`⚠️ Figure enhancement failed:`, error);
    return {caption: null, ocrText: null};
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

      // junk filter
      if (
        blockText.match(/^[A-Z0-9_]+\.(VSD|PDF|DOC|DWG)$/i) ||
        blockText.match(/^[#\d\s\-_]+$/) ||
        blockText.match(/^(FILENAME|ENGINEER|DRAWN BY|DATE|REVISED|PAGE \d+ OF \d+|VENDOR|COPYRIGHT|PROPRIETARY)[\s\d]*$/i) ||
        blockText.length < 15 ||
        blockText.match(/^(Figure|Fig|Diagram|Table|Chart)\s*\d*$/i)
      ) continue;

      const isMainTitle = blockText.match(/^[A-Z\s&]{5,}$/) || block.block_type === "title";
      const isSubtitle = blockText.match(/^\d+\.\s/) || blockText.match(/^[A-Z][a-z\s]+:$/);
      const isTOC = blockText.toLowerCase().includes("table of contents");
      if (isTOC) continue;

      if (isMainTitle && !isSubtitle) {
        if (currentContent.trim() && currentContent.length > 100) {
          chunks.push({
            content: `${currentSection}\n\n${currentContent}`.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: currentSection,
            chunk_type: "section",
            parent_id: sectionId,
          });
        }
        currentSection = blockText.trim();
        currentSubsection = "";
        currentContent = "";
        sectionId = crypto.randomUUID();
      } else if (isSubtitle) {
        if (currentContent.trim() && currentContent.length > 80) {
          chunks.push({
            content: `${currentSection}\n${currentSubsection}\n\n${currentContent}`.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: `${currentSection} > ${currentSubsection}`,
            chunk_type: "subsection",
            parent_id: sectionId,
          });
        }
        currentSubsection = blockText.trim();
        currentContent = "";
      } else {
        currentContent += blockText + "\n\n";
      }
    }

    if (currentContent.trim() && currentContent.length > 80) {
      chunks.push({
        content: `${currentSection}\n${currentSubsection}\n\n${currentContent}`.trim(),
        page_start: pageNum,
        page_end: pageNum,
        menu_path: currentSubsection ? `${currentSection} > ${currentSubsection}` : currentSection,
        chunk_type: currentSubsection ? "subsection" : "section",
        parent_id: sectionId,
      });
    }
  }

  // dedupe by semantic fingerprint
  const deduped: typeof chunks = [];
  const seen = new Map<string, typeof chunks[0]>();
  for (const ch of chunks) {
    const fingerprint = ch.content.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 150);
    const existing = seen.get(fingerprint);
    if (!existing || ch.content.length > existing.content.length) seen.set(fingerprint, ch);
  }
  return Array.from(seen.values());
}

// Markdown fallback
function extractChunksFromMarkdown(text: string): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
  const sections = text.split(/^#{2,3}\s+(.+)$/m);
  for (let i = 1; i < sections.length; i += 2) {
    const heading = sections[i]?.trim();
    const content = sections[i + 1]?.trim();
    if (content && content.length > 120 && !content.match(/^(FILENAME|ENGINEER|DRAWN BY|COPYRIGHT|PROPRIETARY)/i)) {
      chunks.push({ content: heading ? `${heading}\n\n${content}` : content, menu_path: heading || undefined });
    }
  }
  if (chunks.length === 0) {
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim().length > 150);
    for (const para of paras) if (!para.match(/^(FILENAME|ENGINEER|DRAWN BY|COPYRIGHT)/i)) chunks.push({ content: para.trim() });
  }
  return chunks;
}

// Plain text fallback
function chunkPlainText(text: string): Array<{content: string}> {
  const chunks: Array<{content: string}> = [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 50);
  const chunkSize = 5;
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join(". ").trim();
    if (chunk.length > 120 && !chunk.match(/^(FILENAME|ENGINEER|DRAWN BY)/i)) chunks.push({ content: chunk });
  }
  return chunks;
}

// Helper to infer page numbers from filenames or indices
function inferPageNumber(nameOrKey?: string, idx?: number | null) {
  const s = String(nameOrKey || "");

  // Common patterns: "page_12", "page-012", "p12", "p_12", "Page 7", "img_p21_1.png"
  const m =
    s.match(/page[_\-\s]?(\d{1,4})/i) ||
    s.match(/\bp(?:age)?[_\-\s]?(\d{1,4})\b/i) ||
    s.match(/img_p(\d{1,4})/i) || // LlamaCloud format like "img_p21_1.png"
    // trailing number before extension: "..._003.png"
    s.match(/[_\-](\d{1,4})\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/i);

  if (m) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) return n;
  }

  // As a last resort, if you believe images[] order ≈ page order
  if (typeof idx === "number") return idx + 1; // 1-based page guess

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("PHASE 0: begin webhook");

  try {
    const payload = await req.json();
    console.log("Webhook payload keys:", Object.keys(payload || {}));
    console.log("PAYLOAD KEYS", Object.keys(payload || {}));
    console.log("pages?", !!payload?.pages, "markdown?", !!payload?.markdown);

    const jobId = payload.jobId;
    if (!jobId) throw new Error("No jobId found in payload");

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("manual_id, fec_tenant_id")
      .eq("job_id", jobId)
      .single();

    if (docError || !docData) {
      console.error("Failed to find document with job_id:", jobId, docError);
      throw new Error(`No document found for job_id: ${jobId}`);
    }

    await supabase.rpc("set_tenant_context", { tenant_id: docData.fec_tenant_id });
    console.log(`Set tenant context: ${docData.fec_tenant_id}`);

    const manual_id = docData.manual_id;
    const tenantId = docData.fec_tenant_id;
    console.log(`Processing manual: ${manual_id} (job: ${jobId})`);

    // Clear old data
    console.log("🧹 Clearing old data for safe re-ingestion...");
    await supabase.from("chunks_text").delete().eq("manual_id", manual_id);
    await supabase.from("figures").delete().eq("manual_id", manual_id);
    console.log("✅ Old data cleared successfully");

    // --- PHASE A: TEXT FIRST ---
    console.log("PHASE A: text -> start");

    // Extract chunks (JSON → MD → TXT)
    let chunks: any[] = [];
    if (payload.pages) {
      chunks = extractSemanticChunks(payload.pages);
      console.log("PHASE A: text -> extracted from JSON", { count: chunks.length });
    }
    if (chunks.length === 0 && payload.markdown) {
      chunks = extractChunksFromMarkdown(payload.markdown);
      console.log("PHASE A: text -> extracted from MD", { count: chunks.length });
    }
    if (chunks.length === 0 && payload.json && Array.isArray(payload.json)) {
      chunks = extractSemanticChunks(payload.json);
      console.log("PHASE A: text -> extracted from JSON fallback", { count: chunks.length });
    }
    if (chunks.length === 0) {
      console.warn("No chunks from JSON, falling back to markdown");
      const md = payload.md || "";
      if (md) {
        chunks = extractChunksFromMarkdown(md);
        console.log(`Fallback: Extracted ${chunks.length} chunks from markdown`);
      }
    }
    if (chunks.length === 0) {
      console.warn("No chunks from markdown, falling back to plain text");
      const txt = payload.txt || "";
      if (txt) {
        chunks = chunkPlainText(txt);
        console.log(`Fallback: Extracted ${chunks.length} chunks from plain text`);
      }
    }

    if (!chunks.length) {
      console.log("PHASE A: text -> NO CHUNKS FOUND");
    } else {
      // Batch embeddings to reduce API calls (64 at a time)
      const BATCH = 64;
      let inserted = 0;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const inputs = batch.map(c => c.content);
        const emb = await createEmbeddingsBatch(inputs, "text-embedding-3-small");
        const rows = batch.map((c, idx) => ({
          manual_id,
          page_start: c.page_start ?? null,
          page_end: c.page_end ?? null,
          menu_path: c.menu_path ?? null,
          content: c.content,
          embedding: emb[idx],
          fec_tenant_id: tenantId,
        }));
        const { error } = await supabase.from("chunks_text").insert(rows);
        if (error) throw error;
        inserted += rows.length;
        console.log("PHASE A: text -> inserted", { inserted, total: chunks.length });
      }
    }

    console.log("PHASE A: text -> done", { chunks: chunks.length });

    // --- PHASE B: FIGURES (METADATA ONLY) ---
    console.log("PHASE B: figures -> start");

    const figureRows: any[] = [];

    // Extract from JSON pages first
    if (payload.json && Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          for (const img of page.images) {
            const imageName = img.name || `page${page.page}_img`;
            figureRows.push({
              manual_id,
              figure_id: imageName.replace(/\.[^/.]+$/, "") || crypto.randomUUID(),
              page_number: page.page ?? null,
              llama_asset_name: imageName || null, // IMPORTANT: store original asset ref
              image_url: null,                     // NOT filled here
              caption_text: null,
              ocr_text: null,
              vision_text: null,
              fec_tenant_id: tenantId,
            });
          }
        }
      }
    }

    // Fallback to payload.images if no JSON figures
    if (figureRows.length === 0 && payload.images) {
      const list = Array.isArray(payload.images) ? payload.images : Object.keys(payload.images);
      for (const raw of list) {
        const name = typeof raw === "string" ? raw : raw?.name || String(raw);
        figureRows.push({
          manual_id,
          figure_id: name.replace(/\.[^/.]+$/, ""),
          page_number: null,
          llama_asset_name: name,
          image_url: null,
          caption_text: null,
          ocr_text: null,
          vision_text: null,
          fec_tenant_id: tenantId,
        });
      }
    }

    if (figureRows.length) {
      const { error } = await supabase.from("figures").upsert(figureRows, { onConflict: "manual_id,figure_id" });
      if (error) throw error;
    }

    console.log("PHASE B: figures -> done", { figures: figureRows.length });

    // --- PHASE C: ALL EXPENSIVE WORK SKIPPED IN WEBHOOK ---
    if (!PROCESS_FIGURES_IN_WEBHOOK) {
      console.log("PHASE C: expensive work skipped (PROCESS_FIGURES_IN_WEBHOOK=false)");
    } else {
      // If you ever flip it on, be explicit which sub-steps are allowed:
      if (UPLOAD_FIGURES_IN_WEBHOOK) console.log("...would upload figures, but disabled");
      if (ENHANCE_IN_WEBHOOK) console.log("...would enhance figures, but disabled");
      if (EMBED_FIGURES_IN_WEBHOOK) console.log("...would embed figures, but disabled");
    }

    await supabase.from("processing_status").upsert({
      job_id: jobId,
      manual_id,
      status: chunks.length ? "completed" : "failed",
      stage: "finished",
      current_task: `Processing complete - ${chunks.length} chunks processed`,
      progress_percent: 100,
      total_chunks: chunks.length,
      chunks_processed: chunks.length,
      total_figures: figureRows.length,
      figures_processed: figureRows.length, // metadata only
      fec_tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id" });

    console.log("PHASE Z: webhook -> done");
    return new Response(JSON.stringify({
      success: true,
      manual_id,
      processed_chunks: chunks.length,
      total_chunks: chunks.length,
      figures_detected: figureRows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("PHASE ERR:", e);
    const manual_id = "unknown"; // fallback
    await supabase.from("processing_status").upsert({
      job_id: "unknown",
      manual_id,
      status: "failed",
      error_message: e instanceof Error ? e.message : String(e),
      fec_tenant_id: "00000000-0000-0000-0000-000000000001", // fallback
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id" });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
