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

// --- Build citations + thumbnails from retrieved figures ---
export async function buildCitationsAndImages(db: any, chunkIds: string[], figureChunks: any[], manualId: string) {
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
  
  // PHASE 1.1: Cross-Manual Contamination Detection & Auto-Fix
  if (textChunks && textChunks.length > 0) {
    const manualCounts = textChunks.reduce((acc, c) => {
      acc[c.manual_id] = (acc[c.manual_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const uniqueManuals = Object.keys(manualCounts);
    
    if (uniqueManuals.length > 1) {
      // Find the dominant manual (most chunks)
      const dominantManual = uniqueManuals.reduce((a, b) => 
        manualCounts[a] > manualCounts[b] ? a : b
      );
      
      console.log(`⚠️ Multi-manual detected: ${uniqueManuals.join(', ')}`);
      console.log(`🔧 Auto-filtering to dominant manual: ${dominantManual} (${manualCounts[dominantManual]}/${textChunks.length} chunks)`);
      
      // Filter chunk IDs to only the dominant manual
      const filteredChunkIds = textChunks
        .filter(c => c.manual_id === dominantManual)
        .map(c => c.id);
      
      // Update chunkIds array and manualId
      chunkIds = filteredChunkIds;
      manualId = dominantManual;
      
      // Re-filter textChunks
      const originalCount = textChunks.length;
      textChunks.splice(0, textChunks.length, ...textChunks.filter(c => c.manual_id === dominantManual));
      console.log(`✅ Filtered ${originalCount} → ${textChunks.length} chunks`);
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

  // Use ONLY figures passed in from search-unified (NO PAGE SCRAPING)
  if (!figureChunks || figureChunks.length === 0) {
    console.log('🖼️ No figures provided from search - no images will be shown (strict mode)');
    figureChunks = [];
  } else {
    console.log(`📄 Using ${figureChunks.length} figures from search results (strict mode - NO page scraping)`);

  }


  // RELAXED FILTERING: Show all images with storage URLs (user wants "too many images")
  const allImages = (figureChunks ?? []).filter(img => {
    // Only requirement: must have storage URL
    if (!img.storage_url) {
      return false;
    }
    
    // That's it! Show everything
    return true;
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
    const figType = (img.figure_type || '').toLowerCase();
    if (figType.includes('diagram') || figType.includes('schematic') || figType.includes('table') || figType.includes('exploded')) score += 3;
    
    return { ...img, score };
  });
  
  // Sort by score descending first
  scoredImages.sort((a, b) => b.score - a.score);
  
  // RELAXED: Show up to 15 images (user wants more images showing up)
  const imagesByPage = new Map<number, typeof scoredImages[0]>();
  for (const img of scoredImages) {
    if (!imagesByPage.has(img.page_number)) {
      imagesByPage.set(img.page_number, img);
    }
    if (imagesByPage.size >= 15) break; // Increased from 5 to 15
  }
  
  const topImages = Array.from(imagesByPage.values());
  const uniquePages = Array.from(imagesByPage.keys()).sort((a, b) => a - b);
  
  console.log(`🖼️ Filtered to ${topImages.length} images from ${uniquePages.length} unique pages: [${uniquePages.join(', ')}]`);
  console.log(`   (from ${allImages.length} relevant, ${figureChunks?.length || 0} total before filtering)`);

  // Build citations array from text chunks only
  const citations: string[] = [];
  const citationPages = new Set<number>();
  
  for (const c of textChunks ?? []) {
    for (let p = c.page_start; p <= c.page_end; p++) {
      if (p && p > 0 && p <= maxPage && !citationPages.has(p)) {
        citations.push(`${c.manual_id}:p${p}`);
        citationPages.add(p);
      }
    }
  }

  console.log(`✅ Total: ${citations.length} citations, ${topImages.length} images`);

  return {
    citations,
    thumbnails: topImages.map(img => ({
      page_id: `${img.manual_id}:p${img.page_number}`,
      url: img.storage_url,
      title: `${img.figure_type || img.caption_text?.substring(0, 50) || 'image'} · ${img.manual_id} p.${img.page_number}`,
      manual_id: img.manual_id
    }))
  };
}
