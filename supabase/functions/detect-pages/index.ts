// supabase/functions/detect-pages/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const url = Deno.env.get("SUPABASE_URL");
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, service);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { manual_id } = await req.json();
    if (!manual_id) throw new Error("manual_id required");

    console.log(`[detect-pages] Detecting pages for manual: ${manual_id}`);

    // Fetch document to get LlamaCloud job results
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("job_id, manual_id")
      .eq("manual_id", manual_id)
      .single();

    if (docError || !document?.job_id) {
      throw new Error("Document not found or missing job_id");
    }

    // Fetch markdown result from LlamaCloud
    const LLAMACLOUD_API_KEY = Deno.env.get("LLAMACLOUD_API_KEY");
    const jobResultUrl = `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${document.job_id}/result/markdown`;
    
    const response = await fetch(jobResultUrl, {
      headers: {
        Authorization: `Bearer ${LLAMACLOUD_API_KEY}`,
        Accept: "text/plain"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch markdown: ${response.statusText}`);
    }

    const markdown = await response.text();
    
    // Parse page markers from markdown
    // Format: "---\nPage: 5\n---" or similar
    const pageMarkerRegex = /---\s*\n\s*Page:\s*(\d+)\s*\n\s*---/gi;
    const matches = [...markdown.matchAll(pageMarkerRegex)];
    
    const pageMap: { sequential_page: number; actual_page_label: string }[] = [];
    let sequentialPage = 1;
    
    for (const match of matches) {
      const actualPageLabel = match[1];
      pageMap.push({
        sequential_page: sequentialPage,
        actual_page_label: actualPageLabel
      });
      sequentialPage++;
    }

    // Calculate confidence
    const totalPages = sequentialPage - 1;
    const detectedPages = pageMap.length;
    const confidence = detectedPages > 0 ? Math.min(detectedPages / totalPages, 1.0) : 0.0;

    console.log(`[detect-pages] Detected ${detectedPages}/${totalPages} pages, confidence: ${confidence}`);

    // Store in page_label_map table
    if (pageMap.length > 0) {
      const mapRows = pageMap.map(p => ({
        manual_id,
        sequential_page: p.sequential_page,
        actual_page_label: p.actual_page_label,
        confidence,
        detection_method: 'llamacloud_markdown_parser'
      }));

      const { error: insertError } = await supabase
        .from('page_label_map')
        .upsert(mapRows, {
          onConflict: 'manual_id,sequential_page'
        });

      if (insertError) {
        console.error('[detect-pages] Error storing page map:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        manual_id,
        detected_pages: detectedPages,
        total_pages: totalPages,
        confidence,
        page_map: pageMap
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.error('[detect-pages] Error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage
      }),
      {
        status: 400,
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
