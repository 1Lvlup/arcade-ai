// supabase/functions/repage-manual/index.ts
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

function looksUnreliable(pages) {
  const vals = pages.map((p) => Number.isFinite(p) ? Number(p) : null);
  const ones = vals.filter((v) => v === 1).length;
  return vals.length > 0 && ones / vals.length >= 0.5;
}

// simple "page detector" over raw page text
function detectPageNumber(text) {
  // Try patterns like "Page 12", "p. 12", "12 / 64", etc.
  const s = text.slice(0, 1200); // head is where headers/footers live in parse
  const m1 = s.match(/\bpage\s+(\d{1,4})\b/i);
  if (m1) return parseInt(m1[1]);
  const m2 = s.match(/\bp\.?\s*(\d{1,4})\b/i);
  if (m2) return parseInt(m2[1]);
  const m3 = s.match(/\b(\d{1,4})\s*[\/|]\s*\d{2,4}\b/); // "12/64"
  if (m3) return parseInt(m3[1]);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Verify user is authenticated
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(auth || "");
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authenticated" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ ok: false, error: "Admin access required" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { manual_id } = await req.json();
    if (!manual_id) throw new Error("manual_id required");

    // 1) Pull existing chunks in PDF order (fall back to created_at)
    const { data: chunks, error } = await supabase
      .from("chunks_text")
      .select("id, manual_id, page_start, content, created_at")
      .eq("manual_id", manual_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!chunks?.length) throw new Error("no chunks for manual");

    const pageHints = chunks.map((c) => Number(c.page_start));
    const unreliable = looksUnreliable(pageHints);

    // 2) Build a per-chunk new page number
    let next = 1;
    const updates = [];
    for (const c of chunks) {
      // If you have per-page parsed blobs somewhere, you can pull them and call detectPageNumber
      // Here, try to infer from the chunk text first:
      const detected = detectPageNumber(c.content || "");
      let newPage;

      if (!unreliable && Number.isFinite(Number(c.page_start)) && Number(c.page_start) > 0) {
        // paging looks fine overall → keep original
        newPage = Number(c.page_start);
      } else if (detected) {
        newPage = detected;
      } else {
        // fallback: sequential in order
        newPage = next++;
      }

      updates.push({
        chunk_id: c.id,
        old_hint: String(c.page_start ?? "?"),
        new_page: newPage
      });
    }

    // 3) Write map + optional log, and patch chunks' page_start
    //    (keep original in log; we only overwrite page_start with the clean number)
    const mapRows = updates.map((u) => ({
      manual_id,
      old_page_hint: u.old_hint,
      new_page: u.new_page,
      confidence: 0.9
    }));

    // upsert map
    await supabase.from("manual_page_map").upsert(mapRows, {
      onConflict: "manual_id,old_page_hint"
    });

    // log changes
    await supabase.from("chunk_repage_log").insert(
      updates.map((u) => ({
        manual_id,
        chunk_id: u.chunk_id,
        old_page_start: u.old_hint,
        new_page_start: u.new_page
      }))
    );

    // patch chunks and figures
    for (const u of updates) {
      // Update chunk
      await supabase
        .from("chunks_text")
        .update({
          page_start: u.new_page,
          page_end: u.new_page
        })
        .eq("id", u.chunk_id);
      
      // Update figures on the same page
      const chunk = chunks.find(c => c.id === u.chunk_id);
      if (chunk?.page_start) {
        await supabase
          .from("figures")
          .update({
            page_number: u.new_page
          })
          .eq("manual_id", manual_id)
          .eq("page_number", Number(chunk.page_start));
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        repaged: updates.length
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.error('Repage error:', e);
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
