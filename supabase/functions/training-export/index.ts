import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminKey = req.headers.get('x-admin-key');
    if (adminKey !== Deno.env.get('ADMIN_API_KEY')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { format, name, filters } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
