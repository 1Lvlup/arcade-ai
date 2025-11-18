import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user from JWT
    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { format, name, filters } = await req.json();

    // Fetch approved training examples
    let query = supabase
      .from('training_examples')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { descending: true });

    if (filters?.min_quality) {
      // Would need quality_score column in training_examples
    }

    const { data: examples, error } = await query;

    if (error) throw error;

    let content = '';
    let filename = '';

    if (format === 'jsonl') {
      // Instruction-tuning JSONL format
      content = examples!.map(ex => JSON.stringify({
        prompt: `Q: ${ex.question}\nContext: [doc_id:${ex.doc_id || 'unknown'}]\nA:`,
        completion: ` ${ex.answer}\nSource: ${ex.evidence_spans || 'No evidence attached'}`
      })).join('\n');
      filename = `${name || 'export'}_${Date.now()}.jsonl`;
    } else if (format === 'triples') {
      // Reranker triples format (simplified)
      content = examples!.map(ex => JSON.stringify({
        query: ex.question,
        positive: ex.context || ex.answer,
        negative: '' // Would need negative examples
      })).join('\n');
      filename = `${name || 'export'}_triples_${Date.now()}.jsonl`;
    } else if (format === 'csv') {
      // CSV format
      content = 'question,answer,evidence,tags,difficulty\n';
      content += examples!.map(ex => {
        const q = `"${(ex.question || '').replace(/"/g, '""')}"`;
        const a = `"${(ex.answer || '').replace(/"/g, '""')}"`;
        const e = `"${(ex.evidence_spans || '').replace(/"/g, '""')}"`;
        const t = `"${(ex.tags || []).join(',')}}"`;
        const d = ex.difficulty || 'medium';
        return `${q},${a},${e},${t},${d}`;
      }).join('\n');
      filename = `${name || 'export'}_${Date.now()}.csv`;
    }

    // Save export record
    await supabase.from('training_exports').insert({
      name: name || 'Untitled Export',
      example_count: examples!.length,
      filters,
      file_url: filename,
      created_by: 'admin'
    });

    console.log(`Exported ${examples!.length} examples as ${format}`);

    return new Response(JSON.stringify({
      success: true,
      count: examples!.length,
      content,
      filename
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
