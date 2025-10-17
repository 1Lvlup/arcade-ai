import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { format = 'jsonl', filters = {} } = await req.json();

    let query = supabase
      .from('training_examples')
      .select('*')
      .eq('is_approved', true);

    if (filters.model_type) {
      query = query.eq('model_type', filters.model_type);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    const { data: examples, error } = await query;

    if (error) {
      console.error('Error fetching training examples:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let exportContent = '';

    if (format === 'jsonl') {
      // Instruction-tuning JSONL format
      exportContent = examples.map(ex => JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that answers questions accurately based on technical documentation.' },
          { role: 'user', content: ex.question },
          { role: 'assistant', content: ex.expected_answer }
        ],
        metadata: {
          difficulty: ex.difficulty,
          tags: ex.tags,
          evidence: ex.evidence_spans
        }
      })).join('\n');
    } else if (format === 'triples') {
      // Reranker triples format
      exportContent = examples.map(ex => JSON.stringify({
        query: ex.question,
        positive: ex.context,
        negative: null // Would need negative examples
      })).join('\n');
    } else if (format === 'csv') {
      // Simple CSV format
      const header = 'question,answer,difficulty,tags\n';
      const rows = examples.map(ex => 
        `"${ex.question.replace(/"/g, '""')}","${ex.expected_answer.replace(/"/g, '""')}","${ex.difficulty}","${ex.tags.join(';')}"`
      ).join('\n');
      exportContent = header + rows;
    }

    console.log('Exported', examples.length, 'training examples in', format, 'format');

    return new Response(JSON.stringify({ 
      content: exportContent,
      count: examples.length,
      format
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in training-export:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
