import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting project file sync...');

    // Define files to skip (similar to CodebaseIndexer logic)
    const shouldSkipPath = (path: string): boolean => {
      const skipPatterns = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'coverage',
        'package-lock.json',
        'yarn.lock',
        'bun.lockb',
        '.DS_Store',
        'tsconfig.tsbuildinfo',
      ];
      
      return skipPatterns.some(pattern => path.includes(pattern));
    };

    const allowedExtensions = [
      'ts', 'tsx', 'js', 'jsx', 'py', 'css', 'html', 'json', 'md', 'sql',
      'yaml', 'yml', 'toml', 'xml', 'sh', 'bash', 'env', 'txt', 'graphql',
    ];

    const shouldIndexFile = (path: string): boolean => {
      if (shouldSkipPath(path)) return false;
      
      const ext = path.split('.').pop()?.toLowerCase();
      if (!ext) return false;
      
      return allowedExtensions.includes(ext);
    };

    const detectLanguage = (path: string): string => {
      const ext = path.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'css': 'css',
        'html': 'html',
        'json': 'json',
        'md': 'markdown',
        'sql': 'sql',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml',
        'xml': 'xml',
        'sh': 'bash',
        'bash': 'bash',
        'graphql': 'graphql',
      };
      return langMap[ext || ''] || 'text';
    };

    // Read project files recursively
    const readDirectory = async (dirPath: string, baseDir: string = dirPath): Promise<Array<{ path: string; content: string; language: string }>> => {
      const files: Array<{ path: string; content: string; language: string }> = [];
      
      try {
        for await (const entry of Deno.readDir(dirPath)) {
          const fullPath = `${dirPath}/${entry.name}`;
          const relativePath = fullPath.replace(`${baseDir}/`, '');
          
          if (entry.isDirectory) {
            if (!shouldSkipPath(relativePath)) {
              const subFiles = await readDirectory(fullPath, baseDir);
              files.push(...subFiles);
            }
          } else if (entry.isFile && shouldIndexFile(relativePath)) {
            try {
              const stat = await Deno.stat(fullPath);
              
              // Skip files larger than 2MB
              if (stat.size > 2000000) {
                console.log(`Skipping large file: ${relativePath} (${stat.size} bytes)`);
                continue;
              }
              
              const content = await Deno.readTextFile(fullPath);
              const language = detectLanguage(relativePath);
              
              files.push({
                path: relativePath,
                content,
                language,
              });
            } catch (error) {
              console.error(`Error reading file ${relativePath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
      
      return files;
    };

    // Get the project root directory (one level up from supabase/functions)
    const functionDir = Deno.cwd();
    const projectRoot = functionDir.split('/').slice(0, -2).join('/'); // Go up from supabase/functions
    
    console.log(`Scanning project from: ${projectRoot}`);
    
    const files = await readDirectory(projectRoot);
    
    console.log(`Found ${files.length} files to sync`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        files,
        count: files.length 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in sync-project-files:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
