import { CodeChunk } from '@/lib/codeParser';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
}

interface RelevantChunk {
  fileId: string;
  chunkId: string;
  score: number;
  reason: string;
}

/**
 * Extract keywords from a user query, filtering out common words
 */
export function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'how', 'where', 'when', 'why'
  ]);

  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)]; // Remove duplicates
}

/**
 * Calculate relevance score between a chunk and keywords
 */
function calculateChunkScore(chunk: CodeChunk, keywords: string[]): number {
  const chunkText = `${chunk.name} ${chunk.content}`.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    // Exact match in chunk name (high value)
    if (chunk.name.toLowerCase().includes(keyword)) {
      score += 10;
    }

    // Match in content (medium value)
    const contentMatches = (chunkText.match(new RegExp(keyword, 'gi')) || []).length;
    score += contentMatches * 2;

    // Type-specific bonuses
    if (keyword.match(/^(upload|download|file|storage)$/i) && chunk.type === 'function') {
      score += 5;
    }
    if (keyword.match(/^(component|ui|render)$/i) && chunk.type === 'component') {
      score += 5;
    }
    if (keyword.match(/^(hook|use)$/i) && chunk.type === 'hook') {
      score += 5;
    }
  }

  return score;
}

/**
 * Analyze user query and automatically select relevant code chunks
 */
export function analyzeRelevantChunks(
  query: string,
  fileChunks: Map<string, CodeChunk[]>,
  relevanceThreshold: number = 5,
  maxChunks: number = 20
): RelevantChunk[] {
  const keywords = extractKeywords(query);
  
  if (keywords.length === 0) {
    return [];
  }

  const scoredChunks: RelevantChunk[] = [];

  // Score all chunks across all files
  for (const [fileId, chunks] of fileChunks.entries()) {
    for (const chunk of chunks) {
      const score = calculateChunkScore(chunk, keywords);
      
      if (score >= relevanceThreshold) {
        // Determine reason for selection
        const matchedKeywords = keywords.filter(k => 
          chunk.name.toLowerCase().includes(k) || 
          chunk.content.toLowerCase().includes(k)
        );
        
        scoredChunks.push({
          fileId,
          chunkId: chunk.id,
          score,
          reason: `Matches: ${matchedKeywords.slice(0, 3).join(', ')}`
        });
      }
    }
  }

  // Sort by score and return top N
  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);
}

/**
 * Get suggested chunks based on query context
 */
export function getSuggestedSelection(
  query: string,
  files: IndexedFile[],
  fileChunks: Map<string, CodeChunk[]>,
  currentSelections: Map<string, Set<string>>
): Map<string, Set<string>> {
  const relevant = analyzeRelevantChunks(query, fileChunks);
  const newSelections = new Map<string, Set<string>>();

  for (const item of relevant) {
    if (!newSelections.has(item.fileId)) {
      newSelections.set(item.fileId, new Set());
    }
    newSelections.get(item.fileId)!.add(item.chunkId);
  }

  return newSelections;
}

/**
 * Generate a preview summary of what will be included
 */
export function generateSelectionPreview(
  selections: Map<string, Set<string>>,
  fileChunks: Map<string, CodeChunk[]>,
  files: IndexedFile[]
): string {
  const fileMap = new Map(files.map(f => [f.id, f]));
  let preview = '**Smart Selection Preview:**\n\n';
  let totalChunks = 0;

  for (const [fileId, chunkIds] of selections.entries()) {
    const file = fileMap.get(fileId);
    if (!file) continue;

    const chunks = fileChunks.get(fileId) || [];
    const selectedChunks = chunks.filter(c => chunkIds.has(c.id));
    
    if (selectedChunks.length > 0) {
      preview += `📄 **${file.file_path}** (${selectedChunks.length} chunks)\n`;
      selectedChunks.slice(0, 5).forEach(chunk => {
        preview += `  - ${chunk.type}: ${chunk.name}\n`;
        totalChunks++;
      });
      if (selectedChunks.length > 5) {
        preview += `  - ... and ${selectedChunks.length - 5} more\n`;
      }
      preview += '\n';
    }
  }

  preview += `\n**Total: ${totalChunks} code chunks selected**`;
  return preview;
}
