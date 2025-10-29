import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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

    // Define validation schema
    const trainingExampleSchema = z.object({
      source_query_id: z.string().uuid().optional(),
      question: z.string().min(1, "Question required").max(2000, "Question too long"),
      context: z.string().max(20000, "Context too long").optional(),
      answer: z.string().max(10000, "Answer too long").optional(),
      expected_answer: z.string().max(10000, "Expected answer too long").optional(),
      evidence_spans: z.array(z.object({
        start: z.number().int().min(0),
        end: z.number().int().min(0),
        text: z.string().max(1000)
      })).max(50).optional(),
      verified_by: z.string().max(255).optional(),
      model_type: z.enum(['chat', 'completion', 'instruct']).default('chat'),
      do_instructions: z.array(z.string().max(500)).max(20).default([]),
      dont_instructions: z.array(z.string().max(500)).max(20).default([]),
      tags: z.array(z.string().max(100)).max(20).default([]),
      difficulty: z.enum(['easy', 'medium', 'hard']).default('medium')
    }).refine(
      data => data.answer || data.expected_answer,
      { message: "Either answer or expected_answer must be provided" }
    );

    const rawPayload = await req.json();
    const payload = trainingExampleSchema.parse(rawPayload);
    const {
      source_query_id,
      question,
      context,
      answer,
      expected_answer,
      evidence_spans,
      verified_by,
      model_type,
      do_instructions,
      dont_instructions,
      tags,
      difficulty
    } = payload;

    // Validate numeric policy: no unverified numbers allowed
    const numericPattern = /\d+\.?\d*/g;
    const numberMatches = [...(answer || expected_answer).matchAll(numericPattern)];
    
    if (numberMatches.length > 0 && (!evidence_spans || evidence_spans.length === 0)) {
      return new Response(JSON.stringify({ 
        error: 'Numeric policy violation: numbers detected without evidence spans' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user_id from query log if source_query_id provided
    let user_id = null;
    if (source_query_id) {
      const { data: queryLog } = await supabase
        .from('query_logs')
        .select('user_id')
        .eq('id', source_query_id)
        .single();
      user_id = queryLog?.user_id;
    }

    const { data, error } = await supabase
      .from('training_examples')
      .insert({
        source_query_id,
        question,
        context,
        answer,
        expected_answer,
        evidence_spans,
        verified_by,
        verified_at: new Date().toISOString(),
        model_type,
        do_instructions,
        dont_instructions,
        tags,
        difficulty,
        user_id,
        is_approved: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating training example:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Training example created:', data.id, 'by', verified_by);

    return new Response(JSON.stringify({ example_id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in training-create-example:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
