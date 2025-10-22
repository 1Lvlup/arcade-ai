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
export async function buildCitationsAndImages(db: any, chunkIds: string[], manualId: string) {
  // PHASE 1.1: Strict Manual ID Enforcement - manualId is now REQUIRED
  if (!manualId) {
    throw new Error('❌ CRITICAL: manualId is required for buildCitationsAndImages');
  }
  
  if (!chunkIds || chunkIds.length === 0) {
    console.log('🖼️ No chunk IDs provided for image retrieval');
    return { citations: [], thumbnails: [] };
  }

  console.log(`🔍 Building citations for ${chunkIds.length} chunk IDs (manual: ${manualId})`);

  // Query text chunks to get page ranges and manual IDs
  const { data: textChunks, error: textError } = await db
    .from('chunks_text')
    .select('id, manual_id, doc_version, page_start, page_end')
    .in('id', chunkIds);
  if (textError) console.error('❌ Error fetching text chunks:', textError);
  
  // PHASE 1.1: Cross-Manual Contamination Detection
  if (textChunks && textChunks.length > 0) {
    const uniqueManuals = new Set(textChunks.map(c => c.manual_id));
    if (uniqueManuals.size > 1) {
      const manualList = Array.from(uniqueManuals).join(', ');
      console.error(`❌ CONTAMINATION DETECTED: chunks span ${uniqueManuals.size} manuals: ${manualList}`);
      throw new Error(`Cross-manual contamination detected in chunk IDs. Expected: ${manualId}, Found: ${manualList}`);
    }
    
    // Verify all chunks match the requested manual
    const wrongManualChunks = textChunks.filter(c => c.manual_id !== manualId);
    if (wrongManualChunks.length > 0) {
      console.error(`❌ MANUAL MISMATCH: ${wrongManualChunks.length} chunks from wrong manual:`, 
        wrongManualChunks.map(c => c.manual_id).slice(0, 3));
      throw new Error(`Chunk manual mismatch: expected ${manualId}, got chunks from ${wrongManualChunks[0].manual_id}`);
    }
  }

  // PHASE 1.2: Fetch manual metadata for page validation
  const { data: manualMeta } = await db
    .from('manual_metadata')
    .select('page_count, canonical_title')
    .eq('manual_id', manualId)
    .single();
  
  // Determine max page: use metadata if available, otherwise calculate from data
  let maxPage = 999; // Safe fallback
  if (manualMeta?.page_count && manualMeta.page_count > 0) {
    maxPage = manualMeta.page_count;
    console.log(`📘 Manual "${manualMeta.canonical_title || manualId}" has ${maxPage} pages (from metadata)`);
  } else {
    // Fallback: calculate from existing chunks and figures
    const { data: maxChunkPage } = await db
      .from('chunks_text')
      .select('page_end')
      .eq('manual_id', manualId)
      .order('page_end', { ascending: false })
      .limit(1)
      .single();
    
    const { data: maxFigurePage } = await db
      .from('figures')
      .select('page_number')
      .eq('manual_id', manualId)
      .order('page_number', { ascending: false })
      .limit(1)
      .single();
    
    const calculatedMax = Math.max(
      maxChunkPage?.page_end || 0,
      maxFigurePage?.page_number || 0
    );
    
    if (calculatedMax > 0 && calculatedMax < 999) {
      maxPage = calculatedMax;
      console.log(`📘 Manual "${manualId}" estimated max page: ${maxPage} (calculated from data)`);
    } else {
      console.warn(`⚠️ Could not determine page count for ${manualId}, using fallback: ${maxPage}`);
    }
  }

  // Build page ranges from text chunks with validation
  const pageRanges: Array<{ manual_id: string, pages: number[] }> = [];
  let rejectedPages = 0;
  
  for (const c of textChunks ?? []) {
    const pages: number[] = [];
    for (let p = c.page_start; p <= c.page_end; p++) {
      if (p && p > 0 && p <= maxPage) {
        pages.push(p);
      } else if (p > maxPage) {
        rejectedPages++;
        console.warn(`⚠️ Rejecting invalid page ${p} from chunk ${c.id} (manual max: ${maxPage})`);
      }
    }
    if (pages.length > 0) {
      pageRanges.push({ manual_id: c.manual_id, pages });
    }
  }

  if (rejectedPages > 0) {
    console.warn(`⚠️ VALIDATION: Rejected ${rejectedPages} invalid page references`);
  }
  
  console.log(`📄 Found ${textChunks?.length || 0} text chunks covering ${pageRanges.length} valid page ranges`);

  // Query figures based on the pages referenced in the chunks
  // PHASE 1.1: Strict manual_id enforcement on figure retrieval
  let figureChunks: any[] = [];
  let crossManualFigures = 0;
  
  for (const range of pageRanges) {
    let figureQuery = db
      .from('figures')
      .select('id, manual_id, page_number, storage_url, kind, image_name, caption_text, ocr_text, semantic_tags, detected_components, figure_type, keywords')
      .eq('manual_id', manualId)  // ENFORCE: Use parameter, not range.manual_id
      .in('page_number', range.pages)
      .not('storage_url', 'is', null);
    
    const { data: figs, error: figError } = await figureQuery;
    if (figError) console.error(`❌ Error fetching figures for ${manualId}:`, figError);
    
    // Double-check: reject any figures that don't match manual_id
    if (figs) {
      const validFigs = figs.filter(f => f.manual_id === manualId);
      const invalidFigs = figs.length - validFigs.length;
      if (invalidFigs > 0) {
        crossManualFigures += invalidFigs;
        console.error(`❌ CONTAMINATION: Rejected ${invalidFigs} figures from wrong manual`);
      }
      figureChunks.push(...validFigs);
    }
  }

  if (crossManualFigures > 0) {
    console.error(`❌ TOTAL CONTAMINATION: Blocked ${crossManualFigures} cross-manual figures`);
  }
  
  console.log(`📄 Found ${figureChunks.length} valid figure chunks from ${pageRanges.length} page ranges`);

  // Build map of pages PER MANUAL (prevent cross-contamination)
  // PHASE 1.2: Enhanced page validation
  const pagesByManual = new Map<string, Set<number>>();
  
  // Add pages from text chunks with strict validation
  for (const c of textChunks ?? []) {
    if (!pagesByManual.has(c.manual_id)) {
      pagesByManual.set(c.manual_id, new Set());
    }
    const pages = pagesByManual.get(c.manual_id)!;
    for (let p = c.page_start; p <= c.page_end; p++) {
      if (p && p > 0 && p <= maxPage) { // Use calculated maxPage, not hardcoded 1000
        pages.add(p);
      }
    }
  }
  
  // Add pages from figure chunks with strict validation
  for (const f of figureChunks ?? []) {
    if (f.page_number && f.page_number > 0 && f.page_number <= maxPage) {
      if (!pagesByManual.has(f.manual_id)) {
        pagesByManual.set(f.manual_id, new Set());
      }
      pagesByManual.get(f.manual_id)!.add(f.page_number);
    } else if (f.page_number > maxPage) {
      console.warn(`⚠️ Skipping figure on invalid page ${f.page_number} (max: ${maxPage})`);
    }
  }

  console.log(`📑 Page map by manual:`, 
    Array.from(pagesByManual.entries()).map(([mid, pages]) => 
      `${mid}: ${pages.size} pages`
    ).join(', ')
  );

  // Filter images by relevance using metadata, captions, OCR text
  const allImages = (figureChunks ?? []).filter(img => {
    // Must have storage URL
    if (!img.storage_url) {
      console.log(`❌ Skipping image: no storage_url`);
      return false;
    }
    
    // Check if image has meaningful content (caption, OCR, or metadata)
    const hasCaption = img.caption_text && img.caption_text.length > 10;
    const hasOCR = img.ocr_text && img.ocr_text.length > 5;
    const hasMetadata = (img.semantic_tags && img.semantic_tags.length > 0) || 
                        (img.keywords && img.keywords.length > 0) ||
                        (img.detected_components && Object.keys(img.detected_components || {}).length > 0);
    const hasType = img.kind || img.figure_type;
    
    const isRelevant = hasCaption || hasOCR || hasMetadata || hasType;
    
    return isRelevant;
  });
  
  // Score and limit images to top 5 most relevant
  // PHASE 1.3: Image deduplication by page
  const scoredImages = allImages.map(img => {
    let score = 0;
    
    // Prioritize images with captions (most relevant)
    if (img.caption_text && img.caption_text.length > 20) score += 5;
    else if (img.caption_text) score += 3;
    
    // Images with OCR are likely important diagrams/tables
    if (img.ocr_text && img.ocr_text.length > 20) score += 4;
    else if (img.ocr_text) score += 2;
    
    // Images with metadata
    if (img.semantic_tags && img.semantic_tags.length > 0) score += 2;
    if (img.keywords && img.keywords.length > 0) score += 2;
    if (img.detected_components && Object.keys(img.detected_components || {}).length > 0) score += 1;
    
    // Specific figure types are more relevant
    if (img.kind === 'diagram' || img.kind === 'schematic' || img.kind === 'table') score += 3;
    
    return { ...img, score };
  });
  
  // Sort by score descending first
  scoredImages.sort((a, b) => b.score - a.score);
  
  // PHASE 1.3: Deduplicate by page - take only highest-scoring image per page
  const imagesByPage = new Map<number, typeof scoredImages[0]>();
  for (const img of scoredImages) {
    if (!imagesByPage.has(img.page_number)) {
      imagesByPage.set(img.page_number, img);
    }
    if (imagesByPage.size >= 5) break; // Stop at 5 unique pages
  }
  
  const topImages = Array.from(imagesByPage.values());
  const uniquePages = Array.from(imagesByPage.keys()).sort((a, b) => a - b);
  
  console.log(`🖼️ Filtered to ${topImages.length} images from ${uniquePages.length} unique pages: [${uniquePages.join(', ')}]`);
  console.log(`   (from ${allImages.length} relevant, ${figureChunks?.length || 0} total before filtering)`);

  // Build citations array
  const citations: string[] = [];
  for (const [manualId, pages] of pagesByManual.entries()) {
    for (const page of pages) {
      citations.push(`${manualId}:p${page}`);
    }
  }

  console.log(`✅ Total: ${citations.length} citations, ${topImages.length} images`);

  return {
    citations,
    thumbnails: topImages.map(img => ({
      page_id: `${img.manual_id}:p${img.page_number}`,
      url: img.storage_url,
      title: `${img.kind || 'Figure'} · ${img.manual_id} p.${img.page_number}`,
      manual_id: img.manual_id
    }))
  };
}
