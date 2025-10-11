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

/** Collapse "H Y P E R  B O W L I N G", "H\n * Y\n * P\n * E\n * R", and mixed cases into normal words. */
function collapseSpacedLetters(s: string) {
  // join single letters separated by spaces: H Y P E R → HYPER
  s = s.replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ""));

  // join single letters separated by newlines: H\nY\nP\nE\nR → HYPER
  s = s.replace(/\b(?:[A-Z]\s*(?:\r?\n|\r)\s*){2,}[A-Z]\b/g, (m) =>
    m.replace(/[\s\r\n]+/g, "")
  );

  // handle mixed case/accidentally spaced words like i n s t a l l a t i o n
  s = s.replace(/\b([a-z])(?:\s+([a-z])){3,}\b/g, (m) => m.replace(/\s+/g, ""));

  return s;
}

/** Final pass that removes page marks, HTML comments, duplicates and squashes whitespace. */
function normalizeGist(raw: string) {
  let s = String(raw ?? "");

  // Remove HTML comments like <!-- Page 4 End --> etc.
  s = s.replace(/<!--[\s\S]{0,500}?-->/g, " ");

  // Remove pure page headers/footers like "Page 12", "Page II", "#" etc., but
  // DO NOT remove the word "page" in normal sentences.
  s = s.replace(/\bPage\s+(?:[0-9IVX]+)\b/gi, " ");
  s = s.replace(/^\s*#\s*Page\s+[0-9IVX]+\s*$/gim, " ");

  // Remove P/N and REV lines only when they actually look like codes
  s = s.replace(/\bP\/N\s*[:#]?\s*[A-Z0-9\-\.]{3,}\b/gi, " ");
  s = s.replace(/\bREV\.?\s*[A-Z]?(?:,\s*)?\d{1,2}\/\d{2}\b/gi, " ");

  // Turn hard line breaks into spaces early so we can collapse letter-per-line
  s = s.replace(/[\r\n]+/g, " ");

  // Now fix the spaced-letter artifacts
  s = collapseSpacedLetters(s);

  // Kill leftover "single-letter parade" runs (>=5 letters): H Y P E R … → HYPER
  s = s.replace(
    /\b(?:[A-Za-z]\s+){4,}[A-Za-z]\b/g,
    (m) => m.replace(/\s+/g, "")
  );

  // Un-hyphenate line-break splits like "elec-\ntronics"
  s = s.replace(/(\w)[-–]\s+(\w)/g, "$1$2");

  // Collapse excessive spacing
  s = s.replace(/[·•●▪︎◦_]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
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
      const joined = arr
        .map((x) => (x.content ?? x.text ?? ""))
        .filter(t => t && t.length > 20)
        .join(" ");
      
      console.log("normalizeGist INPUT:", joined.slice(0, 200));
      const gist = normalizeGist(joined).slice(0, 900);
      console.log("normalizeGist OUTPUT:", gist.slice(0, 200));
      
      if (!gist || gist.length < 120 || /table of contents|installation manual\s+cover/i.test(gist)) {
        return null as any; // skip junk sections
      }
      
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
