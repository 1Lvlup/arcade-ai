import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

interface GoldenQuestion {
  id: string;
  question: string;
  question_type: string;
  category: string;
  importance: string;
  expected_keywords: string[];
  filters?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { manual_id } = await req.json();
    console.log('🔍 Evaluating manual:', manual_id);

    if (!manual_id) {
      throw new Error('Manual ID is required');
    }

    // Get user context for RLS
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    
    if (!user) {
      throw new Error('Invalid user');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id });

    // Get golden questions for this manual
    const { data: questions, error: questionsError } = await supabase
      .from('golden_questions')
      .select('*')
      .eq('manual_id', manual_id);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      throw new Error('Failed to fetch questions');
    }

    if (!questions || questions.length === 0) {
      throw new Error('No golden questions found. Generate questions first.');
    }

    console.log(`📋 Evaluating ${questions.length} questions`);

    const results = [];

    // Process each question
    for (const q of questions as GoldenQuestion[]) {
      console.log(`\n🤔 Question: ${q.question}`);

      // Step 1: Search for relevant passages using existing search-manuals-robust function
      const searchResponse = await fetch(`${supabaseUrl}/functions/v1/search-manuals-robust`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: q.question,
          manual_id,
          max_results: 8
        })
      });

      if (!searchResponse.ok) {
        console.error('Search failed for question:', q.question);
        continue;
      }

      const searchData = await searchResponse.json();
      const passages = searchData.results || [];

      console.log(`📚 Found ${passages.length} relevant passages`);

      // Step 2: Generate answer using RAG
      const passagesText = passages
        .map((p: any) => `[Page ${p.page_start}] ${p.content}`)
        .join('\n\n---\n\n');

      const answerPrompt = {
        system: `You are Lead Arcade Technician. Answer using ONLY the provided passages from the arcade manual. If insufficient information is provided, say so and propose a short, safe diagnostic as a Working Theory.

Return JSON with this exact structure:
{
  "answer": "your detailed answer here",
  "citations": [{"page": number, "figure": "fig_id or null"}],
  "coverage": "strong|medium|weak"
}`,
        user: `Question: ${q.question}

Passages (verbatim from manual):
${passagesText.substring(0, 8000)}`
      };

      const answerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: answerPrompt.system },
            { role: 'user', content: answerPrompt.user }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!answerResponse.ok) {
        console.error('Answer generation failed');
        continue;
      }

      const answerData = await answerResponse.json();
      const answer = JSON.parse(answerData.choices[0].message.content);
      console.log(`✍️ Generated answer (${answer.coverage} coverage)`);

      // Step 3: Grade the answer
      const gradePrompt = {
        system: `You grade an answer to a Golden Question using the provided manual passages.

Scoring criteria:
- PASS: Answer is supported by passages AND contains expected keywords (or true equivalents)
- PARTIAL: Answer is supported but missing 1-2 expected items or somewhat vague
- FAIL: Answer is unsupported, contradicts passages, or completely misses the question

Return JSON with this exact structure:
{
  "score": "PASS|PARTIAL|FAIL",
  "missing_keywords": ["keyword1", "keyword2"],
  "rationale": "brief explanation of the score",
  "evidence_pages": [page numbers that support or contradict the answer]
}`,
        user: `Question: ${q.question}

Expected keywords: ${JSON.stringify(q.expected_keywords)}

Manual passages:
${passagesText.substring(0, 6000)}

Answer to grade:
${JSON.stringify(answer)}`
      };

      const gradeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: gradePrompt.system },
            { role: 'user', content: gradePrompt.user }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Low temp for consistent grading
        }),
      });

      if (!gradeResponse.ok) {
        console.error('Grading failed');
        continue;
      }

      const gradeData = await gradeResponse.json();
      const grade = JSON.parse(gradeData.choices[0].message.content);
      
      console.log(`📊 Score: ${grade.score}`);

      // Store evaluation result
      const { error: insertError } = await supabase
        .from('question_evaluations')
        .insert({
          question_id: q.id,
          manual_id,
          fec_tenant_id: profile.fec_tenant_id,
          answer: answer.answer,
          citations: answer.citations,
          coverage: answer.coverage,
          score: grade.score,
          missing_keywords: grade.missing_keywords || [],
          rationale: grade.rationale,
          evidence_pages: grade.evidence_pages || [],
          answer_model: 'gpt-4o',
          grader_model: 'gpt-4o'
        });

      if (insertError) {
        console.error('Error storing evaluation:', insertError);
      }

      results.push({
        question_id: q.id,
        question: q.question,
        answer: answer.answer,
        score: grade.score,
        coverage: answer.coverage
      });
    }

    // Calculate summary stats
    const pass = results.filter(r => r.score === 'PASS').length;
    const partial = results.filter(r => r.score === 'PARTIAL').length;
    const fail = results.filter(r => r.score === 'FAIL').length;

    console.log(`\n✅ Evaluation complete:`);
    console.log(`   PASS: ${pass}/${results.length}`);
    console.log(`   PARTIAL: ${partial}/${results.length}`);
    console.log(`   FAIL: ${fail}/${results.length}`);

    return new Response(JSON.stringify({
      success: true,
      manual_id,
      summary: {
        total: results.length,
        pass,
        partial,
        fail,
        pass_rate: (pass / results.length * 100).toFixed(1)
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error evaluating manual:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});