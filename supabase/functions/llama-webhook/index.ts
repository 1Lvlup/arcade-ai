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

// Robust payload extraction helpers
type AnyObj = Record<string, any>;
function pick<T=any>(obj: AnyObj | undefined, path: string, def?: T): T | undefined {
  if (!obj) return def;
  return path.split('.').reduce<any>((o, k) => (o && k in o ? o[k] : undefined), obj) ?? def;
}

function coalesce<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v as T;
  return undefined;
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
    // Extract body data with robust parsing
    const raw = await req.json().catch(() => ({}));
    console.log("📥 Request body keys:", Object.keys(raw));

    // Try multiple locations for each required field
    const manual_id = coalesce<string>(
      raw.manual_id,
      pick(raw, 'document.id'),
      pick(raw, 'data.document_id'),
      pick(raw, 'metadata.manual_id'),
    );
    const job_id = coalesce<string>(
      raw.job_id,
      raw.jobId,
      pick(raw, 'job.id'),
      pick(raw, 'data.job_id'),
      pick(raw, 'metadata.job_id'),
    );
    const title = coalesce<string>(
      raw.title,
      pick(raw, 'document.title'),
      pick(raw, 'data.title'),
      'Untitled Manual'
    );
    let tenant_id = coalesce<string>(
      raw.tenant_id,
      raw.fec_tenant_id,
      pick(raw, 'metadata.tenant_id'),
      pick(raw, 'data.tenant_id'),
    );
    const user_id = coalesce<string>(
      raw.user_id,
      pick(raw, 'metadata.user_id'),
      pick(raw, 'data.user_id'),
    );

    console.log('PHASE 0: payload received', {
      have_manual: !!manual_id,
      have_job: !!job_id,
      have_tenant: !!tenant_id,
      title,
      sample_keys: Object.keys(raw).slice(0, 10)
    });

    // If we don't have manual_id/tenant_id from payload, try to get from existing document
    if (!manual_id || !tenant_id) {
      if (job_id) {
        const { data: doc } = await supabase
          .from("documents")
          .select("manual_id, fec_tenant_id")
          .eq("job_id", job_id)
          .maybeSingle();
        
        if (doc) {
          if (!manual_id) {
            console.log("📄 Found manual_id from existing document:", doc.manual_id);
          }
          if (!tenant_id) {
            tenant_id = doc.fec_tenant_id;
            console.log("🏢 Found tenant_id from existing document:", tenant_id);
          }
        }
      }
    }

    // HARD REQUIREMENTS: manual + job. We'll derive tenant if missing
    if (!manual_id || !job_id) {
      console.error("❌ Missing required fields after extraction:", { 
        manual_id, 
        job_id, 
        tenant_id, 
        bodyKeys: Object.keys(raw) 
      });
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required fields',
        details: { manual_id, job_id, title, tenant_id, sample_keys: Object.keys(raw).slice(0, 20) }
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If tenant_id missing, try to derive from profiles using user_id (optional)
    if (!tenant_id && user_id) {
      const { data: prof } = await supabase.from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user_id)
        .maybeSingle();
      tenant_id = prof?.fec_tenant_id;
    }
    if (!tenant_id) {
      // final fallback default
      tenant_id = '00000000-0000-0000-0000-000000000001';
    }

    // Set tenant context for RLS
    const { error: tenantError } = await supabase.rpc('set_tenant_context', { tenant_id });
    if (tenantError) {
      console.error("❌ Failed to set tenant context:", tenantError);
      throw tenantError;
    }

    // Upsert document & mark status first - ACK quickly
    const { error: docErr } = await supabase.from('documents').upsert({
      manual_id,
      title,
      job_id,
      fec_tenant_id: tenant_id,
    }, { onConflict: 'manual_id' });
    if (docErr) {
      console.error("❌ Document upsert failed:", docErr);
      throw docErr;
    }

    await supabase.from('processing_status').upsert({
      manual_id,
      job_id,
      fec_tenant_id: tenant_id,
      status: 'accepted',
      stage: 'webhook_received',
      chunks_processed: 0,
      total_chunks: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'manual_id' });

    console.log("✅ PHASE ACK: Document accepted, returning 202");

    // ACK immediately so we never "stall" the caller
    return new Response(JSON.stringify({ 
      ok: true, 
      manual_id, 
      job_id, 
      status: 'accepted',
      message: 'Document received and queued for processing'
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("PHASE ERR:", error);
    // Try to mark as failed if we have manual_id and tenant_id
    try {
      const errorBody = await req.text().catch(() => '{}');
      const parsedBody = JSON.parse(errorBody);
      
      const manual_id = parsedBody.manual_id || parsedBody.document?.id;
      const tenant_id = parsedBody.tenant_id || parsedBody.fec_tenant_id || '00000000-0000-0000-0000-000000000001';
      
      if (manual_id && tenant_id) {
        await markProcessingStatus(manual_id, tenant_id, { 
          status: "failed",
          error_message: (error as Error).message 
        });
      }
    } catch (e) {
      console.error("Failed to mark processing status as failed:", e);
    }

    return new Response(JSON.stringify({ 
      ok: false,
      error: (error as Error).message,
      details: "Webhook processing failed"
    }), {
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