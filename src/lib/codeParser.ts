import { parse } from '@typescript-eslint/parser';

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
    const ast = parse(content, {
      sourceType: 'module',
      ecmaVersion: 2022,
      ecmaFeatures: { jsx: true },
      loc: true,
      range: true
    });

    const lines = content.split('\n');

    // Extract imports first
    const imports: string[] = [];
    ast.body.forEach((node: any) => {
      if (node.type === 'ImportDeclaration') {
        imports.push(content.slice(node.range[0], node.range[1]));
      }
    });

    if (imports.length > 0) {
      const importContent = imports.join('\n');
      chunks.push({
        id: 'imports',
        type: 'import',
        name: 'Imports',
        startLine: 1,
        endLine: imports.length,
        content: importContent,
        size: new Blob([importContent]).size
      });
    }

    // Extract other declarations
    ast.body.forEach((node: any, index: number) => {
      if (node.type === 'ImportDeclaration') return; // Already handled

      const nodeContent = content.slice(node.range[0], node.range[1]);
      const chunkSize = new Blob([nodeContent]).size;

      if (node.type === 'FunctionDeclaration' && node.id) {
        chunks.push({
          id: `func-${node.id.name}-${index}`,
          type: 'function',
          name: node.id.name,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          content: nodeContent,
          size: chunkSize
        });
      } else if (node.type === 'ClassDeclaration' && node.id) {
        chunks.push({
          id: `class-${node.id.name}-${index}`,
          type: 'class',
          name: node.id.name,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          content: nodeContent,
          size: chunkSize
        });
      } else if (node.type === 'VariableDeclaration') {
        node.declarations.forEach((declaration: any, declIndex: number) => {
          if (declaration.id?.name) {
            const name = declaration.id.name;
            const isComponent = /^[A-Z]/.test(name);
            const isHook = name.startsWith('use');
            
            chunks.push({
              id: `var-${name}-${index}-${declIndex}`,
              type: isComponent ? 'component' : isHook ? 'hook' : 'const',
              name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: nodeContent,
              size: chunkSize
            });
          }
        });
      } else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        const declaration = node.declaration;
        if (declaration) {
          if (declaration.type === 'FunctionDeclaration' && declaration.id) {
            chunks.push({
              id: `export-func-${declaration.id.name}-${index}`,
              type: 'function',
              name: `${declaration.id.name} (exported)`,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: nodeContent,
              size: chunkSize
            });
          } else if (declaration.type === 'VariableDeclaration') {
            declaration.declarations.forEach((decl: any, declIndex: number) => {
              if (decl.id?.name) {
                const name = decl.id.name;
                const isComponent = /^[A-Z]/.test(name);
                const isHook = name.startsWith('use');
                
                chunks.push({
                  id: `export-var-${name}-${index}-${declIndex}`,
                  type: isComponent ? 'component' : isHook ? 'hook' : 'const',
                  name: `${name} (exported)`,
                  startLine: node.loc.start.line,
                  endLine: node.loc.end.line,
                  content: nodeContent,
                  size: chunkSize
                });
              }
            });
          }
        }
      } else if (node.type === 'TSInterfaceDeclaration' && node.id) {
        chunks.push({
          id: `interface-${node.id.name}-${index}`,
          type: 'interface',
          name: node.id.name,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          content: nodeContent,
          size: chunkSize
        });
      } else if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        chunks.push({
          id: `type-${node.id.name}-${index}`,
          type: 'type',
          name: node.id.name,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          content: nodeContent,
          size: chunkSize
        });
      }
    });

    return chunks.length > 0 ? chunks : fallbackChunking(content);
  } catch (error) {
    console.warn(`Failed to parse ${filePath}, using fallback chunking:`, error);
    return fallbackChunking(content);
  }
};

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
