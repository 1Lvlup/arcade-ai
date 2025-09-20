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

    // Map LlamaCloud format to our expected format
    const text_markdown = payload.md || "";
    console.log(`Text markdown length: ${text_markdown.length}`);

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

        const figureContent = [
          fig.caption_text || "",
          fig.ocr_text || "",
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

    // Text → chunks → embeddings → DB
    let processedChunks = 0;
    if (text_markdown && text_markdown.length > 0) {
      const chunks = chunkText(text_markdown);
      console.log(`Generated ${chunks.length} chunks from text`);
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