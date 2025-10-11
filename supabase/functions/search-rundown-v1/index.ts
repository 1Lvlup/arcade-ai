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

function hasSpacedLetterJunk(s: string) {
  // only trigger if we really see runs like "H Y P E R" etc.
  return /(?:\b[A-Za-z]\b[\s_\-]*){3,}\b[A-Za-z]\b/.test(s);
}

function joinSingleLetterRuns(text: string) {
  const toks = String(text || "").split(/\s+/);
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => { run.length >= 3 ? out.push(run.join("")) : out.push(...run); run = []; };
  for (const t of toks) {
    if (/^[A-Za-z]$/.test(t)) run.push(t);
    else { if (run.length) flush(); out.push(t); }
  }
  if (run.length) flush();
  return out.join(" ");
}

function normalizeGist(raw: string) {
  let s = String(raw ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[_•·●▪︎◦]+/g, " ")
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // only do aggressive fixes if the junk pattern actually exists
  if (hasSpacedLetterJunk(s)) {
    s = joinSingleLetterRuns(s);
    s = s.replace(/(?:\b[A-Za-z]\b[ \t_\-]*){3,}\b[A-Za-z]\b/gm, m => m.replace(/[ \t_\-]/g, ""));
    s = s.replace(/(?:\b[A-Za-z]\b[\s\r\n]*){3,}\b[A-Za-z]\b/gm, m => m.replace(/[\s\r\n]/g, ""));
  }

  // ⚠️ PRECISION FIX: only strip explicit references like "Page 5", "P/N: 400048006", "Rev E"
  s = s.replace(/\bpage\s+\d{1,4}\b/gi, " ");
  s = s.replace(/\b(?:p\/n|pn)\s*[:#-]?\s*[A-Z0-9][A-Z0-9\-\.]{1,}\b/gi, " ");
  s = s.replace(/\brev\s*[:#-]?\s*[A-Z0-9][A-Z0-9\-\.]{0,}\b/gi, " ");

  // safety: if content is still mostly single letters, let caller drop it
  const tokens = s.split(/\s+/);
  const singleFrac = tokens.length ? tokens.filter(t => t.length === 1).length / tokens.length : 0;
  if (singleFrac > 0.35) return "";

  return s.replace(/\s{2,}/g, " ").trim();
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
