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
  if (!chunkIds || chunkIds.length === 0) {
    return { citations: [], thumbnails: [] };
  }

  // Query text chunks to get page ranges
  const { data: textChunks, error: textError } = await db
    .from('chunks_text')
    .select('id, manual_id, doc_version, page_start, page_end')
    .in('id', chunkIds);
  if (textError) console.error('Error fetching text chunks:', textError);

  // Query figures directly (in case chunk IDs include figure IDs)
  const { data: figureChunks, error: figError } = await db
    .from('figures')
    .select('id, manual_id, page_number')
    .in('id', chunkIds);
  if (figError) console.error('Error fetching figure chunks:', figError);

  // Build map of pages from both sources
  const pages = new Map<string, { manual_id: string; page: number }>();
  
  // Add pages from text chunks
  for (const c of textChunks ?? []) {
    for (let p = c.page_start; p <= c.page_end; p++) {
      pages.set(`${c.manual_id}:p${p}`, { manual_id: c.manual_id, page: p });
    }
  }
  
  // Add pages from figure chunks
  for (const f of figureChunks ?? []) {
    if (f.page_number) {
      pages.set(`${f.manual_id}:p${f.page_number}`, { manual_id: f.manual_id, page: f.page_number });
    }
  }

  const plist = Array.from(pages.values());
  let images: any[] = [];
  
  if (plist.length > 0) {
    const manualIds = [...new Set(plist.map(p => p.manual_id))];
    const pageNumbers = [...new Set(plist.map(p => p.page))];
    
    const { data, error: e2 } = await db
      .from('figures')
      .select('manual_id,page_number,image_name,storage_url,kind')
      .in('manual_id', manualIds)
      .in('page_number', pageNumbers)
      .not('storage_url', 'is', null);
    
    if (e2) {
      console.error('Error fetching figures:', e2);
    } else {
      images = data ?? [];
    }
  }

  console.log(`📊 buildCitationsAndImages: ${chunkIds.length} chunk IDs → ${pages.size} pages → ${images.length} images`);

  return {
    citations: Array.from(pages.keys()), // ["manual-id:p57", ...]
    thumbnails: images.map(img => ({
      page_id: `${img.manual_id}:p${img.page_number}`,
      url: img.storage_url,
      title: `${img.kind || 'Figure'} · p.${img.page_number}`
    }))
  };
}
