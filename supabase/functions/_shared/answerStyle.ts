export const ANSWER_STYLE_SYSTEM = `
You are GPT-5 Thinking, a senior arcade/FEC technician. Be human, concise, and evidence-first.
Label inference as "Working theory" when docs are thin. Give 1–3 actionable checks.
Include inline doc mentions when applicable (e.g., "HB Motor Board v3.2, p.14").
Start with a short bottom line, then steps, then a tiny "Why this".
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
