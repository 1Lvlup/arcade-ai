/**
 * Optimized chunking strategy for RAG
 * - Smaller chunks (400-600 chars) for better precision
 * - Overlap (120-150 chars) for context continuity
 * - Include section headings for better context
 */

interface ChunkMetadata {
  manual_id: string;
  page_start: number;
  page_end: number;
  section_heading?: string;
  menu_path?: string;
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

const CHUNK_SIZE = 500; // Target chunk size in characters
const CHUNK_OVERLAP = 135; // Overlap between chunks
const MIN_CHUNK_SIZE = 200; // Don't create tiny chunks

/**
 * Split text into optimized chunks with overlap and section context
 */
export function createChunks(
  text: string,
  metadata: ChunkMetadata
): Chunk[] {
  const chunks: Chunk[] = [];
  
  // Add section heading to the beginning if available
  const sectionPrefix = metadata.section_heading 
    ? `[${metadata.section_heading}]\n\n` 
    : '';
  
  const fullText = sectionPrefix + text;
  let startIndex = 0;

  while (startIndex < fullText.length) {
    let endIndex = startIndex + CHUNK_SIZE;

    // If this isn't the last chunk, try to break at a sentence or paragraph
    if (endIndex < fullText.length) {
      // Look for paragraph break first
      const paragraphBreak = fullText.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex && paragraphBreak - startIndex > MIN_CHUNK_SIZE) {
        endIndex = paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = Math.max(
          fullText.lastIndexOf('. ', endIndex),
          fullText.lastIndexOf('.\n', endIndex),
          fullText.lastIndexOf('!\n', endIndex),
          fullText.lastIndexOf('?\n', endIndex)
        );
        if (sentenceBreak > startIndex && sentenceBreak - startIndex > MIN_CHUNK_SIZE) {
          endIndex = sentenceBreak + 1;
        }
      }
    }

    const chunkText = fullText.substring(startIndex, endIndex).trim();
    
    if (chunkText.length >= MIN_CHUNK_SIZE || startIndex === 0) {
      chunks.push({
        content: chunkText,
        metadata: { ...metadata }
      });
    }

    // Move start position with overlap
    startIndex = endIndex - CHUNK_OVERLAP;
    
    // If we're at the end, break
    if (endIndex >= fullText.length) {
      break;
    }
  }

  console.log(`📦 Created ${chunks.length} chunks from ${fullText.length} chars (avg: ${Math.round(fullText.length / chunks.length)} chars/chunk)`);
  
  return chunks;
}

/**
 * Split markdown by pages and create chunks
 */
export function chunkMarkdownByPage(
  markdown: string,
  manualId: string,
  sectionHeadings?: Map<number, string>
): Chunk[] {
  const allChunks: Chunk[] = [];
  const pagePattern = /^### Page (\d+)/gm;
  const pages: Array<{ pageNum: number; content: string }> = [];
  
  let match;
  let lastIndex = 0;
  
  while ((match = pagePattern.exec(markdown)) !== null) {
    if (lastIndex > 0) {
      const pageNum = parseInt(pages[pages.length - 1]?.pageNum?.toString() || '0');
      const content = markdown.substring(lastIndex, match.index).trim();
      if (pages.length > 0) {
        pages[pages.length - 1].content = content;
      }
    }
    pages.push({
      pageNum: parseInt(match[1]),
      content: '',
    });
    lastIndex = match.index;
  }
  
  // Handle last page
  if (pages.length > 0) {
    pages[pages.length - 1].content = markdown.substring(lastIndex).trim();
  }
  
  // Chunk each page
  for (const page of pages) {
    const sectionHeading = sectionHeadings?.get(page.pageNum);
    const pageChunks = createChunks(page.content, {
      manual_id: manualId,
      page_start: page.pageNum,
      page_end: page.pageNum,
      section_heading: sectionHeading,
    });
    allChunks.push(...pageChunks);
  }
  
  return allChunks;
}
