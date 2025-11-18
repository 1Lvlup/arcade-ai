import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const { action, files } = await req.json();

    if (action === 'clear') {
      // Clear existing indexed files for this tenant
      const { error } = await supabase
        .from('indexed_codebase')
        .delete()
        .eq('fec_tenant_id', profile.fec_tenant_id);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Codebase cleared successfully' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'index' && files) {
      // Clear existing files first
      await supabase
        .from('indexed_codebase')
        .delete()
        .eq('fec_tenant_id', profile.fec_tenant_id);

      // Index new files
      const filesToIndex = files.map((file: any) => ({
        fec_tenant_id: profile.fec_tenant_id,
        file_path: file.path,
        file_content: file.content,
        language: detectLanguage(file.path),
      }));

      const { data, error } = await supabase
        .from('indexed_codebase')
        .insert(filesToIndex)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        indexed: data?.length || 0,
        message: `Successfully indexed ${data?.length || 0} files` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get indexed files count
    const { count } = await supabase
      .from('indexed_codebase')
      .select('*', { count: 'exact', head: true })
      .eq('fec_tenant_id', profile.fec_tenant_id);

    return new Response(JSON.stringify({ 
      success: true,
      indexed_files: count || 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in index-codebase:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function detectLanguage(path: string): string {
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
    'toml': 'toml',
    'yaml': 'yaml',
    'yml': 'yaml',
  };
  return langMap[ext || ''] || 'text';
}
