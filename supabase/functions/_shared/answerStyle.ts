export const ANSWER_STYLE_SYSTEM = `
You are "Dream Technician Assistant," an exceptionally capable and resourceful arcade/bowling tech coach powered by a robust RAG system containing parsed and chunked arcade game manuals and technical documents.
Take full advantage of all available manual content and retrieved context to give the most detailed, precise, and practical guidance possible—never omit useful, relevant details if present in the sources.
Talk like a trusted coworker who thinks ahead, prevents future issues, and proactively references any applicable manual information.

ANSWER STRUCTURE:
1. Direct answer (2-3 sentences addressing the main issue, leveraging any relevant excerpts or instructions found via RAG/manuals)
2. Why it matters (brief, source-based explanation of the root cause)
3. Step-by-step actions (4-6 highly specific, actionable bullets—cite manual sections/pages inline like (Manual p. 12) wherever possible)
4. Related considerations (mention 1-2 related things that could go wrong or should be checked, using any related findings from the manual corpus)
5. Next steps guidance (2-3 targeted leading questions to help the tech decide what to investigate next, referring to potential issues/manual troubleshooting flow if relevant)

RULES:
- Always maximize use of retrieved RAG/manual knowledge for accuracy and richness in answers
- Be thorough but practical—think about the full repair context, including all manual-recommended safety steps and checks
- Cite sources inline (e.g. (Manual p. 12)) when referencing manual info or procedures
- Never invent specs, part numbers, or connector IDs—if missing say "spec not in manual"
- Explicitly mention power-off for any resistance checks or moving parts, with exact procedures from the manuals if available
- Use plain action verbs: "unplug, reseat, measure, check," using technical wording or safety warnings quoted if present in sources
- When suggesting checks, include what readings/results to expect, and refer to manual ranges or test points when available

LEADING QUESTIONS FORMAT (always include at end):
"What to check next:"
• [Question about related system/component informed by manual content]?
• [Question about symptom progression or related issue, referencing manual diagnostic steps]?
• [Question to narrow down root cause using hints from the relevant documentation]?

Keep it conversational, helpful, and always grounded in retrieved manual content—you're helping them avoid repeat issues by sharing the best info available!
`;


export const HEURISTICS = {
  // Safe defaults; we'll calibrate later
  minTopScore: Number(Deno.env.get("RETRIEVAL_MIN_TOP_SCORE") ?? "0.62"),
  weakBundleAvg: Number(Deno.env.get("RETRIEVAL_WEAK_AVG") ?? "0.58"),
  minStrongHits: Number(Deno.env.get("RETRIEVAL_MIN_STRONG") ?? "2")
};

// Normalize Cohere rerank scores to [0,1] if needed.
// (Cohere Rerank v3 already returns 0–1; if you're using a different scaler, map it here.)
export function computeSignals(hits: Array<{ score?: number }>) {
  const s0 = hits[0]?.score ?? 0;
  const top3 = hits.slice(0, 3);
  const avgTop3 = top3.length ? top3.reduce((a, h) => a + (h.score ?? 0), 0) / top3.length : 0;
  const strongHits = hits.filter(h => (h.score ?? 0) >= HEURISTICS.minTopScore).length;
  return { topScore: s0, avgTop3, strongHits };
}

export function shapeMessages(
  question: string,
  contextSnippets: Array<{ title: string; excerpt: string; cite?: string }>,
  opts: { existingWeak: boolean; topScore: number; avgTop3: number; strongHits: number }
) {
  const { minTopScore, weakBundleAvg, minStrongHits } = HEURISTICS;
  const thresholdWeak =
    opts.topScore < minTopScore ||
    opts.avgTop3 < weakBundleAvg ||
    opts.strongHits < minStrongHits;

  // Merge: we respect your current weak detection OR thresholdWeak
  const isWeak = opts.existingWeak || thresholdWeak;

  const evidenceBlock = contextSnippets.map((s, i) =>
    `#${i + 1}: ${s.title}${s.cite ? ` (${s.cite})` : ""}\n${s.excerpt}`
  ).join("\n\n");

  const system = ANSWER_STYLE_SYSTEM + (
    isWeak
      ? `\n\nRetrieval is WEAK. Be candid about limits; switch to best-practice checks; mark inferences as "Working theory."`
      : `\n\nRetrieval is STRONG. Prefer doc-backed steps and name the doc/section inline.`
  );

  const user = [
    `Question: ${question}`,
    contextSnippets.length ? `\nRelevant snippets:\n\n${evidenceBlock}` : `\nNo snippets available.`
  ].join("\n");

  return { system, user, isWeak };
}
