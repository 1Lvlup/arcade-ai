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

function chunkText(text: string, chunkSize = 600, overlap = 100) {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
  const lines = text.split("\n");
  let current = "";
  let pageStart: number | undefined;
  let pageEnd: number | undefined;
  let menuPath: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const m = line.match(/Page\s+(\d+)/i);
    if (m) {
      const p = parseInt(m[1]);
      if (!pageStart) pageStart = p;
      pageEnd = p;
    }
    if (line.includes(" > ") && line.length < 100) {
      menuPath = line.trim();
    }

    current += line + "\n";
    const atEnd = i === lines.length - 1;
    if (current.length >= chunkSize || atEnd) {
      const trimmed = current.trim();
      if (trimmed.length > 50) {
        chunks.push({ content: trimmed, page_start: pageStart, page_end: pageEnd, menu_path: menuPath });
      }
      if (!atEnd) {
        const overlapLines = lines.slice(Math.max(0, i - Math.floor(overlap / 20)), i + 1);
        current = overlapLines.join("\n") + "\n";
      } else {
        current = "";
      }
    }
  }
  return chunks;
}

async function fetchWithRetry(url: string, tries = 3) {
  let last: Response | null = null;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.ok) return r;
    last = r;
    await new Promise(res => setTimeout(res, 300 * (i + 1)));
  }
  if (last) throw new Error(`Failed to fetch ${url}: ${last.status} ${last.statusText}`);
  throw new Error(`Failed to fetch ${url}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("LlamaCloud webhook received");
    // existing:
const payload = await req.json();
// ADD these lines:
const url = new URL(req.url);
const manualIdFromQS = url.searchParams.get('manual_id');

// Be robust about where metadata shows up:
const manual_id =
  payload?.metadata?.manual_id ??
  payload?.config?.metadata?.manual_id ??
  payload?.job?.metadata?.manual_id ??
  manualIdFromQS;

if (!manual_id) {
  // Temporary debugging to see the actual shape you’re getting back:
  console.error('Webhook payload keys:', Object.keys(payload || {}));
  console.error('Webhook sample (trimmed):', JSON.stringify(payload).slice(0, 2000));
  throw new Error('No manual_id found in metadata or query string');
}

    console.log("Webhook status:", payload.status);

    if (payload.status && payload.status !== "SUCCESS") {
      console.error("Job not successful:", payload);
      return new Response(JSON.stringify({ error: "Job failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlObj = new URL(req.url);
    const manual_id = payload?.metadata?.manual_id || urlObj.searchParams.get("manual_id");
    if (!manual_id) throw new Error("No manual_id found in metadata or query string");

    // Inline vs. result_url
    let { text_markdown, figures } = payload;
    if ((!text_markdown || !figures) && payload.result_url) {
      const r = await fetch(payload.result_url);
      if (r.ok) {
        const j = await r.json().catch(() => null);
        text_markdown = text_markdown || j?.text_markdown || j?.markdown || j?.md || "";
        figures = figures || j?.figures || j?.images || [];
      } else {
        console.warn("result_url fetch failed:", r.status, await r.text());
      }
    }

    console.log(`Processing manual: ${manual_id}`);
    console.log(`Text len: ${text_markdown?.length || 0}, figures: ${figures?.length || 0}`);

    // Figures → download → S3 → DB
    let processedFigures = 0;
    if (Array.isArray(figures) && figures.length) {
      for (const fig of figures) {
        try {
          if (!fig?.image_url) continue;
          const imgResp = await fetchWithRetry(fig.image_url);
          const contentType = imgResp.headers.get("content-type") || "image/png";
          const ext = contentType.includes("jpeg") ? "jpg" :
                      contentType.includes("png") ? "png" :
                      contentType.includes("webp") ? "webp" : "bin";
          const buf = new Uint8Array(await imgResp.arrayBuffer());

          const key = `manuals/${manual_id}/${fig.figure_id || crypto.randomUUID()}.${ext}`;
          const s3Uri = await uploadToS3(buf, key, contentType);

          const figureContent = [
            fig.caption_text || "",
            fig.ocr_text || "",
            Array.isArray(fig.callouts) ? JSON.stringify(fig.callouts) : "",
          ].filter(Boolean).join("\n");

          const embedding = figureContent.length > 10 ? await createEmbedding(figureContent) : null;

          const { error: figErr } = await supabase.from("figures").insert({
            manual_id,
            page_number: fig.page_number ?? null,
            figure_id: fig.figure_id ?? key.split("/").pop(),
            image_url: s3Uri,
            caption_text: fig.caption_text ?? null,
            ocr_text: fig.ocr_text ?? null,
            callouts_json: fig.callouts ?? null,
            bbox_pdf_coords: fig.bbox_pdf_coords ?? null,
            embedding_text: embedding,
            fec_tenant_id: "00000000-0000-0000-0000-000000000001",
          });
          if (figErr) console.error("figures insert error:", figErr);
          else processedFigures++;
        } catch (e) {
          console.error("Figure process error:", e);
        }
      }
    }

    // Text → chunks → embeddings → DB
    let processedChunks = 0;
    if (text_markdown && text_markdown.length > 0) {
      const chunks = chunkText(text_markdown);
      console.log(`Chunks: ${chunks.length}`);
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
            fec_tenant_id: "00000000-0000-0000-0000-000000000001",
          });
          if (insErr) console.error("chunks_text insert error:", insErr);
          else processedChunks++;
        } catch (e) {
          console.error("Chunk embed/insert error:", e);
        }
      }
    }

    // Update doc timestamp
    await supabase.from("documents").update({ updated_at: new Date().toISOString() }).eq("manual_id", manual_id);

    console.log(`Complete: ${processedChunks} chunks, ${processedFigures} figures`);
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