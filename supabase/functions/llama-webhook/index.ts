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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Semantic chunking with hierarchical structure
function extractSemanticChunks(jsonData: any[]): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];

  for (const page of jsonData) {
    if (!page.blocks || !Array.isArray(page.blocks)) continue;

    let currentSection = "";
    let currentContent = "";
    const pageNum = page.page || null;

    for (const block of page.blocks) {
      const blockText = block.content || block.text || "";
      if (!blockText.trim()) continue;

      // Filter out junk content
      if (
        blockText.match(/^[A-Z0-9_]+\.(VSD|PDF|DOC|DWG)$/i) ||
        blockText.match(/^[#\d\s\-_]+$/) ||
        blockText.length < 15
      ) continue;

      const isMainTitle = blockText.match(/^[A-Z\s&]{5,}$/) || block.block_type === "title";
      
      if (isMainTitle) {
        if (currentContent.trim() && currentContent.length > 100) {
          chunks.push({
            content: `${currentSection}\n\n${currentContent}`.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: currentSection,
          });
        }
        currentSection = blockText.trim();
        currentContent = "";
      } else {
        currentContent += blockText + "\n";
      }
    }

    // Add final chunk if exists
    if (currentContent.trim() && currentContent.length > 100) {
      chunks.push({
        content: `${currentSection}\n\n${currentContent}`.trim(),
        page_start: pageNum,
        page_end: pageNum,
        menu_path: currentSection,
      });
    }
  }

  return chunks;
}

// Simple markdown chunking fallback
function extractChunksFromMarkdown(markdown: string): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
  
  // Split by headers and process
  const sections = markdown.split(/^#{1,3}\s+(.+)$/gm);
  
  for (let i = 1; i < sections.length; i += 2) {
    const title = sections[i];
    const content = sections[i + 1]?.trim();
    
    if (content && content.length > 100) {
      chunks.push({
        content: `${title}\n\n${content}`,
        menu_path: title,
      });
    }
  }
  
  return chunks;
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("PHASE 0: begin webhook");

  try {
    // Extract body data
    const body = await req.json();
    console.log("📥 Request body keys:", Object.keys(body));

    // Try to extract fields from different possible payload formats
    let manual_id = body.manual_id;
    let job_id = body.job_id || body.jobId;
    let tenant_id = body.tenant_id || body.fec_tenant_id;
    
    // If we don't have manual_id/tenant_id from payload, try to get from existing document
    if (!manual_id || !tenant_id) {
      if (job_id) {
        const { data: doc } = await supabase
          .from("documents")
          .select("manual_id, fec_tenant_id")
          .eq("job_id", job_id)
          .single();
        
        if (doc) {
          manual_id = manual_id || doc.manual_id;
          tenant_id = tenant_id || doc.fec_tenant_id;
        }
      }
    }
    
    if (!manual_id || !job_id || !tenant_id) {
      console.error("Missing required fields after extraction:", { manual_id, job_id, tenant_id, bodyKeys: Object.keys(body) });
      throw new Error("Missing required fields: manual_id, job_id, tenant_id");
    }

    // Set tenant context for RLS
    const { error: tenantError } = await supabase.rpc('set_tenant_context', { tenant_id });
    if (tenantError) {
      console.error("❌ Failed to set tenant context:", tenantError);
      throw tenantError;
    }

    // --- PHASE A: TEXT FIRST ---
    console.log("PHASE A: text -> start");

    // Get parse payload (prefer JSON; fallback to markdown or refetch by job_id)
    const payload = await getLlamaPayload(req, job_id);
    console.log("PAYLOAD KEYS", Object.keys(payload || {}));
    console.log("pages?", !!payload?.pages, "markdown?", !!payload?.markdown);

    let chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
    if (payload?.pages) {
      chunks = extractSemanticChunks(payload.pages);
      console.log("PHASE A: text -> extracted from JSON", { count: chunks.length });
    }
    if (chunks.length === 0 && payload?.markdown) {
      chunks = extractChunksFromMarkdown(payload.markdown);
      console.log("PHASE A: text -> extracted from MD", { count: chunks.length });
    }

    if (!chunks.length) {
      console.log("PHASE A: text -> NO CHUNKS FOUND");
    } else {
      // Batch embeddings to reduce API calls (e.g., 64 at a time)
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
          fec_tenant_id: tenant_id,
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

    const figures = payload?.figures ?? extractFiguresMeta(payload);
    const figureRows = (figures || []).map((f: any) => ({
      manual_id,
      figure_id: f.figure_id,
      page_number: f.page_number ?? null,
      // store original llama asset ref so later jobs can fetch:
      llama_asset_name: f.asset_name ?? null, // <-- IMPORTANT
      image_url: "",                          // NOT filled here - empty string for NOT NULL constraint
      caption_text: null,
      ocr_text: null,
      vision_text: null,
      fec_tenant_id: tenant_id,
    }));

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

    await markProcessingStatus(manual_id, tenant_id, {
      status: chunks.length ? "completed" : "failed",
      chunks_processed: chunks.length,
      total_chunks: chunks.length,
      figures_detected: figureRows.length,
    });

    console.log("PHASE Z: webhook -> done");
    return new Response(JSON.stringify({ success: true, chunks: chunks.length, figures: figureRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("PHASE ERR:", error);
    // Try to mark as failed if we have manual_id and tenant_id
    try {
      const body = await req.clone().json();
      if (body.manual_id && body.tenant_id) {
        await markProcessingStatus(body.manual_id, body.tenant_id, { status: "failed" });
      }
    } catch (e) {
      console.error("Failed to mark processing status as failed:", e);
    }

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper functions

async function getLlamaPayload(req: Request, jobId?: string): Promise<any> {
  try {
    const body = await req.clone().json();
    
    // First try to get from request body
    if (body.json || body.markdown || body.figures) {
      return {
        pages: body.json,
        markdown: body.markdown,
        figures: body.figures
      };
    }

    // Fallback: fetch from LlamaCloud API if we have job_id
    if (jobId) {
      console.log("🔄 Fetching payload from LlamaCloud for job:", jobId);
      
      const llamaApiKey = Deno.env.get("LLAMACLOUD_API_KEY");
      if (!llamaApiKey) {
        console.warn("⚠️ LLAMACLOUD_API_KEY not available for refetch");
        return null;
      }

      const resp = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/json`, {
        headers: { "Authorization": `Bearer ${llamaApiKey}` }
      });

      if (resp.ok) {
        const data = await resp.json();
        console.log("✅ Successfully fetched payload from LlamaCloud");
        return { pages: data };
      } else {
        console.warn("⚠️ Failed to fetch from LlamaCloud:", resp.status, resp.statusText);
      }
    }

    return null;
  } catch (error) {
    console.error("❌ Error getting Llama payload:", error);
    return null;
  }
}

function extractFiguresMeta(payload: any): any[] {
  const figures: any[] = [];
  
  if (!payload) return figures;

  // Extract from pages if available
  if (payload.pages && Array.isArray(payload.pages)) {
    for (const page of payload.pages) {
      if (page.images && Array.isArray(page.images)) {
        for (const img of page.images) {
          figures.push({
            figure_id: img.name || img.id || crypto.randomUUID(),
            page_number: page.page || null,
            asset_name: img.name || img.filename || null
          });
        }
      }
    }
  }

  // Extract from direct figures array if available
  if (payload.figures && Array.isArray(payload.figures)) {
    for (const fig of payload.figures) {
      figures.push({
        figure_id: fig.figure_id || fig.name || fig.id || crypto.randomUUID(),
        page_number: fig.page_number || fig.page || null,
        asset_name: fig.asset_name || fig.name || fig.filename || null
      });
    }
  }

  return figures;
}

async function markProcessingStatus(manualId: string, tenantId: string, updates: any) {
  const { error } = await supabase
    .from("processing_status")
    .upsert({
      manual_id: manualId,
      fec_tenant_id: tenantId,
      job_id: updates.job_id || manualId,
      ...updates,
      updated_at: new Date().toISOString()
    }, { onConflict: "manual_id" });

  if (error) {
    console.error("❌ Failed to update processing status:", error);
    throw error;
  }
}