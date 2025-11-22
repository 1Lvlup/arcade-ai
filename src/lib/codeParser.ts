// Browser-safe code parser (no Node dependencies)

export interface CodeChunk {
  id: string;
  type: 'import' | 'function' | 'class' | 'component' | 'hook' | 'interface' | 'type' | 'const' | 'other';
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  size: number; // in bytes
}

export const parseFileIntoChunks = (filePath: string, content: string): CodeChunk[] => {
  const chunks: CodeChunk[] = [];
  const language = detectLanguage(filePath);

  // Only parse TypeScript/JavaScript files
  if (!['typescript', 'javascript', 'tsx', 'jsx'].includes(language)) {
    // Return entire file as single chunk for non-TS/JS files
    return [{
      id: 'full-file',
      type: 'other',
      name: 'Full File',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
      size: new Blob([content]).size
    }];
  }

  try {
    const lines = content.split('\n');
    const importLines: number[] = [];
    let currentChunk: { startLine: number; lines: string[]; type?: CodeChunk['type']; name?: string } | null = null;

    // Simple regex-based parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Track imports
      if (line.startsWith('import ')) {
        importLines.push(i);
        continue;
      }

      // Detect function declarations
      const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (funcMatch) {
        if (currentChunk) {
          chunks.push(createChunk(currentChunk, lines));
        }
        currentChunk = { startLine: lineNumber, lines: [lines[i]], type: 'function', name: funcMatch[1] };
        continue;
      }

      // Detect class declarations
      const classMatch = line.match(/^(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (classMatch) {
        if (currentChunk) {
          chunks.push(createChunk(currentChunk, lines));
        }
        currentChunk = { startLine: lineNumber, lines: [lines[i]], type: 'class', name: classMatch[1] };
        continue;
      }

      // Detect const/let/var declarations
      const constMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (constMatch) {
        if (currentChunk) {
          chunks.push(createChunk(currentChunk, lines));
        }
        const name = constMatch[1];
        const isComponent = /^[A-Z]/.test(name);
        const isHook = name.startsWith('use');
        const type = isComponent ? 'component' : isHook ? 'hook' : 'const';
        currentChunk = { startLine: lineNumber, lines: [lines[i]], type, name };
        continue;
      }

      // Detect interface declarations
      const interfaceMatch = line.match(/^(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (interfaceMatch) {
        if (currentChunk) {
          chunks.push(createChunk(currentChunk, lines));
        }
        currentChunk = { startLine: lineNumber, lines: [lines[i]], type: 'interface', name: interfaceMatch[1] };
        continue;
      }

      // Detect type declarations
      const typeMatch = line.match(/^(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (typeMatch) {
        if (currentChunk) {
          chunks.push(createChunk(currentChunk, lines));
        }
        currentChunk = { startLine: lineNumber, lines: [lines[i]], type: 'type', name: typeMatch[1] };
        continue;
      }

      // Add line to current chunk
      if (currentChunk) {
        currentChunk.lines.push(lines[i]);
      }
    }

    // Close final chunk
    if (currentChunk) {
      chunks.push(createChunk(currentChunk, lines));
    }

    // Add imports as first chunk if any
    if (importLines.length > 0) {
      const importContent = importLines.map(i => lines[i]).join('\n');
      chunks.unshift({
        id: 'imports',
        type: 'import',
        name: 'Imports',
        startLine: 1,
        endLine: importLines.length,
        content: importContent,
        size: new Blob([importContent]).size
      });
    }

    return chunks.length > 0 ? chunks : fallbackChunking(content);
  } catch (error) {
    console.warn(`Failed to parse ${filePath}, using fallback chunking:`, error);
    return fallbackChunking(content);
  }
};

function createChunk(
  chunkData: { startLine: number; lines: string[]; type?: CodeChunk['type']; name?: string },
  allLines: string[]
): CodeChunk {
  const content = chunkData.lines.join('\n');
  const type = chunkData.type || 'other';
  const name = chunkData.name || 'Unknown';
  
  return {
    id: `${type}-${name}-${chunkData.startLine}`,
    type,
    name,
    startLine: chunkData.startLine,
    endLine: chunkData.startLine + chunkData.lines.length - 1,
    content,
    size: new Blob([content]).size
  };
}

const fallbackChunking = (content: string): CodeChunk[] => {
  // Simple line-based chunking for unparseable files
  return [{
    id: 'full-file',
    type: 'other',
    name: 'Full File (unparsed)',
    startLine: 1,
    endLine: content.split('\n').length,
    content,
    size: new Blob([content]).size
  }];
};

const detectLanguage = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'json': 'json',
    'css': 'css',
    'html': 'html',
    'md': 'markdown'
  };
  return languageMap[ext || ''] || 'plaintext';
};
