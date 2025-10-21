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
export async function buildCitationsAndImages(db: any, chunkIds: string[], manualId?: string) {
  if (!chunkIds || chunkIds.length === 0) {
    console.log('🖼️ No chunk IDs provided for image retrieval');
    return { citations: [], thumbnails: [] };
  }

  console.log(`🔍 Building citations for ${chunkIds.length} chunk IDs${manualId ? ` (manual: ${manualId})` : ' (all manuals)'}`);

  // Query text chunks to get page ranges and manual IDs
  const { data: textChunks, error: textError } = await db
    .from('chunks_text')
    .select('id, manual_id, doc_version, page_start, page_end')
    .in('id', chunkIds);
  if (textError) console.error('❌ Error fetching text chunks:', textError);

  // Query figures directly (in case chunk IDs include figure IDs)
  let figureQuery = db
    .from('figures')
    .select('id, manual_id, page_number, storage_url, kind, image_name')
    .in('id', chunkIds)
    .not('storage_url', 'is', null);
  
  // CRITICAL: Filter by manual_id if provided to prevent cross-manual contamination
  if (manualId) {
    figureQuery = figureQuery.eq('manual_id', manualId);
    console.log(`🔒 Filtering figures by manual_id: ${manualId}`);
  }
  
  const { data: figureChunks, error: figError } = await figureQuery;
  if (figError) console.error('❌ Error fetching figure chunks:', figError);

  console.log(`📄 Found ${textChunks?.length || 0} text chunks, ${figureChunks?.length || 0} figure chunks`);

  // Build map of pages PER MANUAL (prevent cross-contamination)
  const pagesByManual = new Map<string, Set<number>>();
  
  // Add pages from text chunks
  for (const c of textChunks ?? []) {
    if (!pagesByManual.has(c.manual_id)) {
      pagesByManual.set(c.manual_id, new Set());
    }
    const pages = pagesByManual.get(c.manual_id)!;
    for (let p = c.page_start; p <= c.page_end; p++) {
      if (p && p > 0 && p < 1000) { // Sanity check: ignore invalid page numbers
        pages.add(p);
      }
    }
  }
  
  // Add pages from figure chunks
  for (const f of figureChunks ?? []) {
    if (f.page_number && f.page_number > 0 && f.page_number < 1000) {
      if (!pagesByManual.has(f.manual_id)) {
        pagesByManual.set(f.manual_id, new Set());
      }
      pagesByManual.get(f.manual_id)!.add(f.page_number);
    }
  }

  console.log(`📑 Page map by manual:`, 
    Array.from(pagesByManual.entries()).map(([mid, pages]) => 
      `${mid}: ${pages.size} pages`
    ).join(', ')
  );

  // Only use figures that were actually returned by search (in chunkIds)
  // This ensures only relevant images are shown, not all images from relevant pages
  const allImages = figureChunks ?? [];
  
  console.log(`🖼️ Using ${allImages.length} relevant figures from search results`);

  // Build citations array
  const citations: string[] = [];
  for (const [manualId, pages] of pagesByManual.entries()) {
    for (const page of pages) {
      citations.push(`${manualId}:p${page}`);
    }
  }

  console.log(`✅ Total: ${citations.length} citations, ${allImages.length} images`);

  return {
    citations,
    thumbnails: allImages.map(img => ({
      page_id: `${img.manual_id}:p${img.page_number}`,
      url: img.storage_url,
      title: `${img.kind || 'Figure'} · ${img.manual_id} p.${img.page_number}`,
      manual_id: img.manual_id
    }))
  };
}
