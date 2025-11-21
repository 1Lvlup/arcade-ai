import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GitHubFile {
  path: string;
  content: string;
  language: string | null;
  last_modified: string;
}

const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /out\//,
  /\.next\//,
  /\.nuxt\//,
  /\.cache\//,
  /coverage\//,
  /\.env/,
  /\.DS_Store/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
  /bun\.lockb/,
  /\.min\.js$/,
  /\.map$/,
];

const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.mp4', '.webm', '.ogg', '.mp3', '.wav',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib',
];

function shouldIndexFile(path: string): boolean {
  if (SKIP_PATTERNS.some(pattern => pattern.test(path))) {
    return false;
  }
  const ext = path.substring(path.lastIndexOf('.'));
  return !SKIP_EXTENSIONS.includes(ext);
}

function detectLanguage(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.sql': 'sql',
    '.sh': 'shell',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
  };
  return languageMap[ext] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const githubToken = Deno.env.get('GITHUB_TOKEN');

    if (!githubToken) {
      throw new Error('GITHUB_TOKEN not configured. Please add it in Supabase secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { repository } = await req.json();
    
    if (!repository || !repository.includes('/')) {
      throw new Error('Invalid repository format. Use "owner/repo"');
    }

    console.log(`Fetching repository tree for: ${repository}`);

    // Get default branch
    const repoResponse = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Supabase-Edge-Function',
      },
    });

    if (!repoResponse.ok) {
      const errorText = await repoResponse.text();
      console.error('GitHub API error:', errorText);
      throw new Error(`Failed to fetch repository: ${repoResponse.status} ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Get repository tree recursively
    const treeResponse = await fetch(
      `https://api.github.com/repos/${repository}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function',
        },
      }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch tree: ${treeResponse.statusText}`);
    }

    const treeData = await treeResponse.json();
    const files: GitHubFile[] = [];
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    // Filter for indexable files
    const indexableFiles = treeData.tree.filter((item: any) => 
      item.type === 'blob' && shouldIndexFile(item.path)
    );

    console.log(`Found ${indexableFiles.length} indexable files`);

    // Fetch file contents (with batching to avoid rate limits)
    const BATCH_SIZE = 10;
    for (let i = 0; i < indexableFiles.length; i += BATCH_SIZE) {
      const batch = indexableFiles.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (item: any) => {
        try {
          // Check size before fetching
          if (item.size > MAX_FILE_SIZE) {
            console.log(`Skipping large file: ${item.path} (${item.size} bytes)`);
            return null;
          }

          const contentResponse = await fetch(
            `https://api.github.com/repos/${repository}/contents/${item.path}`,
            {
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3.raw',
                'User-Agent': 'Supabase-Edge-Function',
              },
            }
          );

          if (!contentResponse.ok) {
            console.error(`Failed to fetch ${item.path}: ${contentResponse.statusText}`);
            return null;
          }

          const content = await contentResponse.text();
          
          return {
            path: item.path,
            content,
            language: detectLanguage(item.path),
            last_modified: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`Error fetching ${item.path}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults.filter((f): f is GitHubFile => f !== null));

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < indexableFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Successfully fetched ${files.length} files`);

    return new Response(
      JSON.stringify({ 
        files,
        repository,
        total_files: files.length,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in sync-github-repo:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check edge function logs for more information'
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
