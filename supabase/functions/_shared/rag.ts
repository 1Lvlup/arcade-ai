// --- Token estimate + page-aware chunker ---
const estTokens = (s: string) => Math.ceil(s.split(/\s+/).length * 0.75);

export function pageAwareChunk(markdown: string, meta: {
  manual_id: string; version: string;
}) {
  const pages = markdown.split(/\n(?=### Page \d+)/g);
  const out: any[] = [];
  for (const pageBlock of pages) {
    const m = pageBlock.match(/^### Page (\d+)/);
    if (!m) continue;
    const page = parseInt(m[1], 10);

    const parts = pageBlock.split(/\n{2,}/g).filter(Boolean);
    let buf: string[] = []; let tok = 0;
    const flush = () => {
      if (!buf.length) return;
      out.push({
        manual_id: meta.manual_id,
        version:   meta.version,
        page_start: page,
        page_end:   page,
        section_path: [],        // optional: fill later
        text: buf.join("\n\n"),
        features: {}             // optional: fill later
      });
      buf = []; tok = 0;
    };
    for (const p of parts) {
      const t = estTokens(p);
      if (tok + t > 500) flush();
      buf.push(p); tok += t;
      if (tok >= 600) flush();
    }
    flush();
  }
  return out;
}

// --- Build citations + thumbnails from used chunk IDs ---
export async function buildCitationsAndImages(db: any, chunkIds: string[]) {
  const { data: chunks, error } = await db
    .from('rag_chunks')
    .select('id, manual_id, version, page_start, page_end')
    .in('id', chunkIds);  // use the UUID primary key
  if (error) throw error;

  const pages = new Map<string, { manual_id: string; version: string; page: number }>();
  for (const c of chunks ?? []) {
    for (let p = c.page_start; p <= c.page_end; p++) {
      pages.set(`${c.manual_id}@${c.version}:p${p}`, { manual_id: c.manual_id, version: c.version, page: p });
    }
  }

  const plist = Array.from(pages.values());
  let images: any[] = [];
  if (plist.length) {
    const { data, error: e2 } = await db
      .from('figures')
      .select('manual_id,version,page,image_name,storage_url,kind')
      .in('manual_id', plist.map(p => p.manual_id))
      .in('version',   plist.map(p => p.version))
      .in('page',      plist.map(p => p.page));
    if (e2) throw e2;
    images = data ?? [];
  }

  return {
    citations: Array.from(pages.keys()), // ["kkosi-vr@1.0.0:p57", ...]
    thumbnails: images.map(img => ({
      page_id: `${img.manual_id}@${img.version}:p${img.page}`,
      url: img.storage_url,
      title: `${img.kind} · p.${img.page}`
    }))
  };
}
