// supabase/functions/llama-webhook/index.ts
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
  const resp = await aws.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`S3 upload failed: ${resp.status} ${resp.statusText} – ${body.slice(0, 1000)}`);

  // (optional) keep your debug logs
  const magicBytes = Array.from(buffer.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`🔎 Magic bytes for ${key}: ${magicBytes}`);
  console.log(`🪣 S3 verify -> key=${key} size=${buffer.length}B type=${contentType}`);

  // ⬅️ return the HTTPS url directly
  return url;
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

// Vision analysis (single, correct version)
async function analyzeFigureWithVision(imageData: string, context: string) {
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
              image_url: { url: imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}` },
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

// AI-powered OCR and caption generation for figures
async function enhanceFigureWithAI(imageData: string, context: string): Promise<{caption: string | null, ocrText: string | null}> {
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
              image_url: { url: imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}` }
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

  try {
    console.log("LlamaCloud webhook received");
    const payload = await req.json();

    console.log("Webhook payload keys:", Object.keys(payload || {}));
    console.log("Webhook sample (trimmed):", JSON.stringify(payload).slice(0, 2000));

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
    console.log(`Processing manual: ${manual_id} (job: ${jobId})`);

    // Clear old data
    console.log("🧹 Clearing old data for safe re-ingestion...");
    await supabase.from("chunks_text").delete().eq("manual_id", manual_id);
    await supabase.from("figures").delete().eq("manual_id", manual_id);
    console.log("✅ Old data cleared successfully");

    // Extract chunks (JSON → MD → TXT)
    let chunks: any[] = [];
    if (payload.json && Array.isArray(payload.json)) {
      chunks = extractSemanticChunks(payload.json);
      console.log(`Extracted ${chunks.length} semantic chunks with hierarchical structure`);
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

    /* ============================
       PATCH START: Figures section
       ============================ */
    const figures: Array<{
      figure_id: string;
      image_sources: any[];
      llama_asset_name: string | null;
      caption_text: string | null;
      ocr_text: string | null;
      page_number: number | null;
      callouts: any;
      bbox_pdf_coords: string | null;
    }> = [];

    console.log("🖼️ Starting figure extraction...", {
      hasJson: !!payload.json,
      hasImages: !!payload.images,
      jsonLength: Array.isArray(payload.json) ? payload.json.length : 0,
      imagesType: typeof payload.images,
      imagesLength: Array.isArray(payload.images) ? payload.images.length : (payload.images ? Object.keys(payload.images).length : 0),
    });

    if (payload.json && Array.isArray(payload.json)) {
      for (const page of payload.json) {
        if (page.images && Array.isArray(page.images)) {
          console.log(`📄 Page ${page.page} has ${page.images.length} images`);
          for (const img of page.images) {
            const imageName = img.name || `page${page.page}_img`;
            const imageSources = findAllImageSources(payload, imageName);

            console.log(`🔍 Image source detection for ${imageName}:`, {
              sourcesFound: imageSources.length,
              sourceTypes: imageSources.map((s) => typeof s),
              sourcePreview: imageSources.map((s) =>
                typeof s === "string" ? s.slice(0, 50) + "..." : (s && typeof s === "object" ? Object.keys(s) : String(s)),
              ),
            });

            figures.push({
              figure_id: imageName.replace(/\.[^/.]+$/, "") || crypto.randomUUID(),
              image_sources: imageSources,
              llama_asset_name: imageName || null, // Add asset name for fallback
              caption_text: img.caption || img.alt || null,
              ocr_text: img.text || null,
              page_number: page.page ?? null,
              callouts: img.callouts ?? null,
              bbox_pdf_coords: JSON.stringify({
                x: img.x || 0,
                y: img.y || 0,
                width: img.width || 0,
                height: img.height || 0,
              }),
            });
          }
        }
      }
    }

    // If JSON didn't yield figures but payload.images exists, fall back to images-only ingestion
    if (figures.length === 0 && payload.images) {
      console.log("🧯 No page JSON, but payload.images present — using assets-only path…");
      const imgs = Array.isArray(payload.images)
        ? payload.images
        : Object.keys(payload.images || {});
      for (const name of imgs.slice(0, 3)) {
        console.log("  sample image entry:", typeof name === "string" ? name : JSON.stringify(name).slice(0, 120));
      }

      // Minimal figures from image list
      const list = Array.isArray(payload.images) ? payload.images : Object.keys(payload.images);
      for (const raw of list) {
        const name = typeof raw === "string" ? raw : raw?.name || String(raw);
        figures.push({
          figure_id: name.replace(/\.[^/.]+$/, ""),
          image_sources: [],                // none inline
          llama_asset_name: name,           // use assets fallback
          caption_text: null,
          ocr_text: null,
          page_number: null,                // no page info available
          callouts: null,
          bbox_pdf_coords: null
        });
      }
      console.log(`🧩 Staged ${figures.length} figures from images-only list`);
    }


    console.log(`Found ${figures.length} figures to process`);

    let processedFigures = 0;
    let skippedFigures = 0;
    const processingErrors: Array<{ figure_id: string; error: string; sources_tried: number }> = [];

    console.log(`🔄 Processing ${figures.length} figures...`);

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      console.log(`📷 Processing figure ${i + 1}/${figures.length}: ${fig.figure_id}`);

      try {
        if ((!fig.image_sources || fig.image_sources.length === 0) && !fig.llama_asset_name) {
          console.warn(`⚠️ Skipping ${fig.figure_id}: no image sources and no asset name`);
          skippedFigures++;
          processingErrors.push({ figure_id: fig.figure_id, error: "No image sources or asset name found", sources_tried: 0 });
          continue;
        }

        // Try multiple sources until one resolves
        let resolved: { buffer: Uint8Array; contentType: string; ext: string } | null = null;
        let tried = 0;
        let lastErr = "";

        for (const src of fig.image_sources) {
          tried++;
          try {
            resolved = await resolveImageInput(src);
            console.log(`✅ Resolved ${fig.figure_id} from source ${tried}: ${resolved.buffer.length} bytes (${resolved.contentType})`);
            break;
          } catch (e: any) {
            lastErr = e?.message || String(e);
            console.warn(`⚠️ Source ${tried} failed for ${fig.figure_id}: ${lastErr}`);
          }
        }

        // If we still don't have a resolved image, try LlamaCloud assets by filename
        if (!resolved && fig.llama_asset_name) {
          try {
            console.log(`🪄 Falling back to Llama assets for ${fig.llama_asset_name}`);
            const fetched = await fetchImageFromLlama(jobId, fig.llama_asset_name);
            resolved = fetched;
            console.log(`✅ Asset fetch succeeded for ${fig.llama_asset_name} (${fetched.buffer.length} bytes)`);
          } catch (assetErr) {
            console.warn(`⚠️ Asset fetch failed for ${fig.llama_asset_name}:`, assetErr);
          }
        }

        if (!resolved) {
          console.error(`❌ All ${tried} sources failed for ${fig.figure_id}. Last: ${lastErr}`);
          skippedFigures++;
          processingErrors.push({ figure_id: fig.figure_id, error: `All sources failed. Last: ${lastErr}`, sources_tried: tried });
          continue;
        }

       // Upload to S3 (with retry)
const key = `manuals/${manual_id}/${fig.figure_id}.${resolved.ext}`;

let uploadInfo: { httpUrl: string; s3Uri: string; size: number; contentType: string } | null = null;
let uploadAttempts = 0;
const maxRetries = 2;

while (uploadAttempts <= maxRetries) {
  try {
    uploadInfo = await uploadToS3(resolved.buffer, key, resolved.contentType);
    console.log(`📤 Uploaded ${fig.figure_id} to S3: ${uploadInfo.httpUrl}`);
    break;
  } catch (uploadError) {
    uploadAttempts++;
    console.warn(`⚠️ S3 upload attempt ${uploadAttempts} failed for ${fig.figure_id}:`, uploadError);
    if (uploadAttempts > maxRetries) throw uploadError;
    await new Promise(r => setTimeout(r, 1000));
  }
}

if (!uploadInfo) throw new Error(`Upload never succeeded for ${fig.figure_id}`);

        // Enhanced figure processing with AI caption and OCR
        let enhancedCaption = fig.caption_text;
        let enhancedOcr = fig.ocr_text;
        let visionAnalysis: string | null = null;
        
        try {
          const firstSrc = fig.image_sources[0];
          const dataForVision =
            typeof firstSrc === "string"
              ? firstSrc
              : firstSrc?.data || firstSrc?.base64 || firstSrc?.b64_json || firstSrc?.url || firstSrc?.content || null;

          if (dataForVision) {
            const imageDataUri = typeof dataForVision === "string" ? dataForVision : String(dataForVision);
            const context = `Manual: ${manual_id}, Page: ${fig.page_number}`;
            
            // Get AI enhancement if we don't have good caption/OCR
            const needsEnhancement = !enhancedCaption || enhancedCaption.length < 20 || !enhancedOcr;
            if (needsEnhancement) {
              console.log(`🔍 Enhancing figure ${fig.figure_id} with AI...`);
              const enhancement = await enhanceFigureWithAI(imageDataUri, context);
              if (enhancement.caption && (!enhancedCaption || enhancedCaption.length < 20)) {
                enhancedCaption = enhancement.caption;
                console.log(`✨ Generated caption for ${fig.figure_id}: ${enhancedCaption.slice(0, 50)}...`);
              }
              if (enhancement.ocrText && !enhancedOcr) {
                enhancedOcr = enhancement.ocrText;
                console.log(`📝 Extracted OCR for ${fig.figure_id}: ${enhancedOcr.slice(0, 50)}...`);
              }
            }

            // Get vision analysis for additional context
            visionAnalysis = await analyzeFigureWithVision(imageDataUri, context);
          }
        } catch (vErr) {
          console.warn(`⚠️ Vision/Enhancement failed for ${fig.figure_id}:`, vErr);
        }

        const figureContent = [enhancedCaption || "", enhancedOcr || "", visionAnalysis || ""].filter(Boolean).join("\n");
        let embedding: number[] | null = null;
        if (figureContent.length > 10) {
      try {
        embedding = await createEmbedding(figureContent);
        console.log(`🔗 Generated figure embedding (${embedding.length} dimensions): ${fig.figure_id}`);
      } catch (embErr) {
        console.error(`❌ Figure embedding failed for ${fig.figure_id}:`, embErr.message || embErr);
      }
        }

        console.log(`💾 Inserting figure: ${fig.figure_id}, URL: ${uploadInfo!.httpUrl}, Size: ${uploadInfo!.size} bytes`);
        
        const { error: figureInsertError } = await supabase.from("figures").insert({
          manual_id,
          page_number: fig.page_number ?? null,
          figure_id: fig.figure_id,
          image_url: uploadInfo!.httpUrl,
          caption_text: enhancedCaption ?? null,
          ocr_text: enhancedOcr ?? null,
          callouts_json: fig.callouts ?? null,
          bbox_pdf_coords: fig.bbox_pdf_coords ?? null,
          embedding_text: embedding,
          fec_tenant_id: docData.fec_tenant_id,
        });
        if (figureInsertError) {
          console.error(`❌ DB insert failed for ${fig.figure_id}:`, figureInsertError);
        } else {
          processedFigures++;
          console.log(`✅ Stored figure ${fig.figure_id}`);
        }
      } catch (e) {
        console.error(`❌ Critical error processing figure ${fig.figure_id}:`, e);
        skippedFigures++;
      }
    }

    console.log(`📊 Figure processing summary: ${processedFigures} processed, ${skippedFigures} skipped`);

    if (skippedFigures) {
      console.log("🔍 Figure failure summary recorded");
    }
    /* ============================
       PATCH END: Figures section
       ============================ */

    // Chunks → embeddings → DB
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
            // NOTE: content_hash is a generated column (md5(content)) — do not set manually
          });
          if (insErr) console.error("chunks_text insert error:", insErr);
          else processedChunks++;
        } catch (e) {
          console.error("Chunk embed/insert error:", e);
        }
      }
    }

    // Update document & processing status
    await supabase.from("documents").update({ updated_at: new Date().toISOString() }).eq("manual_id", manual_id);

    await supabase.from("processing_status").upsert({
      job_id: jobId,
      manual_id,
      status: "completed",
      stage: "finished",
      current_task: `Processing complete - ${processedFigures} / ${figures.length} figures successful`,
      progress_percent: 100,
      total_chunks: chunks.length,
      chunks_processed: processedChunks,
      total_figures: figures.length,
      figures_processed: processedFigures,
      fec_tenant_id: docData.fec_tenant_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id" });

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
