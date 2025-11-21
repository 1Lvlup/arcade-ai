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
      return new Response(
        JSON.stringify({ 
          error: 'GitHub token not configured',
          details: 'Please add a GitHub Personal Access Token as GITHUB_TOKEN in Supabase secrets. Generate one at: https://github.com/settings/tokens with "repo" scope.'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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

    let { repository } = await req.json();
    
    // Handle both "owner/repo" and full GitHub URLs
    if (repository.startsWith('http')) {
      const match = repository.match(/github\.com\/([^\/]+\/[^\/\.]+)/);
      if (!match) {
        throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
      }
      repository = match[1];
    }
    
    if (!repository || !repository.includes('/')) {
      throw new Error('Invalid repository format. Use "owner/repo" or full GitHub URL');
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
      
      let errorMessage = 'Failed to fetch repository';
      let errorDetails = 'Check edge function logs for more information';
      
      if (repoResponse.status === 404) {
        errorMessage = 'Repository not found';
        errorDetails = `The repository "${repository}" either doesn't exist, is private, or your GitHub token doesn't have access. Please check:\n\n1. Repository name is correct (case-sensitive)\n2. Repository exists on GitHub\n3. If private, your GITHUB_TOKEN has "repo" scope\n4. Token belongs to an account with access`;
      } else if (repoResponse.status === 401) {
        errorMessage = 'GitHub authentication failed';
        errorDetails = 'Your GITHUB_TOKEN is invalid or expired. Generate a new Personal Access Token at: https://github.com/settings/tokens';
      } else if (repoResponse.status === 403) {
        errorMessage = 'GitHub API rate limit exceeded';
        errorDetails = 'Too many requests. Wait a few minutes or use a different GitHub token.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorDetails }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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
    
    const skippedFiles = {
      tooLarge: [] as string[],
      fetchFailed: [] as string[],
      filtered: 0,
    };

    // Filter for indexable files
    const allBlobs = treeData.tree.filter((item: any) => item.type === 'blob');
    const indexableFiles = allBlobs.filter((item: any) => {
      const shouldIndex = shouldIndexFile(item.path);
      if (!shouldIndex) skippedFiles.filtered++;
      return shouldIndex;
    });

    console.log(`Total blobs: ${allBlobs.length}, Indexable: ${indexableFiles.length}, Filtered: ${skippedFiles.filtered}`);

    // Fetch file contents (with batching to avoid rate limits)
    const BATCH_SIZE = 10;
    for (let i = 0; i < indexableFiles.length; i += BATCH_SIZE) {
      const batch = indexableFiles.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (item: any) => {
        try {
          // Check size before fetching
          if (item.size > MAX_FILE_SIZE) {
            console.log(`Skipping large file: ${item.path} (${item.size} bytes)`);
            skippedFiles.tooLarge.push(item.path);
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
            skippedFiles.fetchFailed.push(item.path);
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
          skippedFiles.fetchFailed.push(item.path);
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
    console.log(`Skipped: ${skippedFiles.tooLarge.length} too large, ${skippedFiles.fetchFailed.length} fetch failed, ${skippedFiles.filtered} filtered out`);

    return new Response(
      JSON.stringify({ 
        files,
        repository,
        total_files: files.length,
        skipped: {
          too_large: skippedFiles.tooLarge.length,
          fetch_failed: skippedFiles.fetchFailed.length,
          filtered: skippedFiles.filtered,
        },
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
