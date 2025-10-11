// supabase/functions/search-rundown-v1/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBUST_URL = `${SUPABASE_URL}/functions/v1/search-manuals-robust`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

type Snip = {
  manual_id?: string;
  doc_id?: string;
  page?: number;
  page_start?: number;
  page_end?: number;
  section_path?: string[];  // preferred
  menu_path?: string[];     // fallback
  content?: string;
  text?: string;
  score?: number;
};

function textOf(x: Snip) {
  return (x.content ?? x.text ?? "").toString();
}

function normalizeGist(raw: string) {
  let s = (raw || "")
    .replace(/[\r\n]+/g, " ")            // collapse newlines
    .replace(/[_•·●▪︎◦]+/g, " ")         // bullets/underscores → space
    .replace(/<[^>]{0,500}>/g, " ")      // strip HTML-ish tags
    .replace(/\s{2,}/g, " ");            // multi-space → single

  // collapse spaced ALL-CAPS like "H Y P E R B O W L I N G"
  s = s.replace(/\b(?:[A-Z]\s){3,}[A-Z]\b/g, (m) => m.replace(/\s/g, ""));

  // collapse spaced lower-case runs
  s = s.replace(/\b(?:[a-z]\s){3,}[a-z]\b/g, (m) => m.replace(/\s/g, ""));

  // trim noisy prefixes
  s = s.replace(/\b(?:page|p\/n|rev)\s*[:#]?\s*\w+(\s|$)/gi, " ");
  return s.trim();
}

function topSection(x: Snip) {
  const a = x.section_path?.[0] ?? x.menu_path?.[0] ?? "General";
  return String(a).slice(0, 80);
}

function clusterSections(results: Snip[]) {
  const buckets: Record<string, Snip[]> = {};
  for (const r of results) {
    const k = topSection(r);
    (buckets[k] ??= []).push(r);
  }
  return Object.entries(buckets)
    .sort((a, b) => b[1].length - a[1].length) // biggest first
    .slice(0, 8)
    .map(([title, arr]) => {
      // drop sections that cleaned to almost nothing or look like cover/TOC
      const cleaned = arr.map(textOf).map(normalizeGist).join(" ");
      if (cleaned.length < 80 || /installation manual\s+cover|table of contents/i.test(cleaned)) {
        return null as any;
      }

      const gist = normalizeGist(
        arr.map(textOf)
           .filter(t => t && t.length > 20)
           .join(" ")
      ).slice(0, 900);
      
      const citations = arr.slice(0, 3).map((x) => ({
        manual_id: x.manual_id ?? x.doc_id ?? null,
        page: x.page_start ?? x.page ?? null,
      }));
      return { title, gist, citations };
    })
    .filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // accept either q or query
    const body = await req.json();
    const qText = typeof body.query === "string" ? body.query : body.q;
    const { manual_id = null, system = null, vendor = null, limit = 80 } = body;

    if (!qText) {
      return new Response(JSON.stringify({ ok: false, error: "Missing query" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Reuse robust search (uses `query`, not `q`)
    const robust = await fetch(ROBUST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY
      },
      body: JSON.stringify({ query: qText, manual_id, system, vendor, limit })
    });

    const data = await robust.json();
    console.log("rundown robust hits:", Array.isArray(data?.results) ? data.results.length : -1);
    
    if (!robust.ok) {
      return new Response(JSON.stringify({ ok: false, error: data?.error || "robust search failed" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const results: Snip[] = data?.results ?? data ?? [];
    const sections = clusterSections(results);
    const summary = `High-level overview of ${system ?? "the requested system"}.`;

    return new Response(JSON.stringify({ ok: true, summary, sections }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
