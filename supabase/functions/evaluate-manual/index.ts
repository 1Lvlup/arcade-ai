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

// Model configuration for grading golden questions
// Use BACKEND_MODEL env var to allow flexibility, default to gpt-5-2025-08-07
const GRADER_MODEL = Deno.env.get('BACKEND_MODEL') || 'gpt-5-2025-08-07';
const GRADER_MAX_TOKENS = 800;

// Quality metrics calculation
async function calculateQualityMetrics(supabase: any, manual_id: string) {
  console.log(`🔍 Running quality metrics for manual: ${manual_id}`);
  
  const results: any = {
    manual_id,
    timestamp: new Date().toISOString(),
    scores: {},
    issues: [],
    recommendations: []
  };

  try {
    // 1. CHUNK QUALITY ANALYSIS
    const { data: chunks } = await supabase
      .from('chunks_text')
      .select('*')
      .eq('manual_id', manual_id);

    if (!chunks || chunks.length === 0) {
      results.issues.push("❌ No chunks found - processing may have failed");
      return results;
    }

    // Chunk quality metrics
    const avgChunkLength = chunks.reduce((sum: number, c: any) => sum + c.content.length, 0) / chunks.length;
    const shortChunks = chunks.filter((c: any) => c.content.length < 100).length;
    const longChunks = chunks.filter((c: any) => c.content.length > 2000).length;
    const uniqueContent = new Set(chunks.map((c: any) => c.content.slice(0, 200))).size;

    results.scores.chunk_quality = {
      total_chunks: chunks.length,
      avg_length: Math.round(avgChunkLength),
      short_chunks: shortChunks,
      long_chunks: longChunks,
      uniqueness: Math.round((uniqueContent / chunks.length) * 100)
    };

    // 2. FIGURE QUALITY ANALYSIS
    const { data: figures } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', manual_id);

    let figureScore = 0;
    if (figures && figures.length > 0) {
      const enhancedFigures = figures.filter((f: any) => 
        f.caption_text && f.caption_text.length > 50
      ).length;
      figureScore = Math.round((enhancedFigures / figures.length) * 100);

      results.scores.figure_quality = {
        total_figures: figures.length,
        enhanced_descriptions: enhancedFigures,
        enhancement_rate: figureScore
      };
    }

    // 3. EMBEDDING QUALITY CHECK
    const embeddings = chunks.filter((c: any) => c.embedding).length;
    const embeddingRate = Math.round((embeddings / chunks.length) * 100);

    results.scores.embedding_quality = {
      embedded_chunks: embeddings,
      embedding_rate: embeddingRate
    };

    // 4. OVERALL SCORE CALCULATION
    const chunkScore = Math.min(100, Math.max(0, 100 - (shortChunks * 5) - (longChunks * 2)));
    const overallScore = Math.round((chunkScore + figureScore + embeddingRate) / 3);
    results.scores.overall = overallScore;

    // 5. ISSUE DETECTION
    if (shortChunks > chunks.length * 0.3) {
      results.issues.push("⚠️ Too many short chunks - may indicate poor parsing");
    }
    if (embeddingRate < 95) {
      results.issues.push("⚠️ Some chunks missing embeddings - search quality affected");
    }
    if (figureScore < 50) {
      results.issues.push("⚠️ Low figure enhancement rate - vision processing may have failed");
    }
    if (avgChunkLength < 200) {
      results.issues.push("⚠️ Average chunk length too short - context may be fragmented");
    }

    // 6. RECOMMENDATIONS
    if (overallScore >= 85) {
      results.recommendations.push("✅ Excellent quality! Manual ready for production use.");
    } else if (overallScore >= 70) {
      results.recommendations.push("👍 Good quality with minor issues. Consider re-uploading if critical.");
    } else {
      results.recommendations.push("🔄 Poor quality detected. Recommend re-uploading the manual.");
    }

    console.log(`✅ Quality metrics complete. Overall score: ${overallScore}%`);
    return results;

  } catch (error) {
    console.error("Quality metrics error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    results.issues.push(`❌ Quality check failed: ${errorMessage}`);
    return results;
  }
}

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

    // STEP 1: Run quality metrics first
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 STEP 1: Data Quality Metrics`);
    console.log(`${'='.repeat(80)}\n`);
    
    const qualityMetrics = await calculateQualityMetrics(supabase, manual_id);
    
    console.log(`\n📈 Quality Scores:`);
    console.log(`   Overall: ${qualityMetrics.scores.overall}%`);
    console.log(`   Chunks: ${qualityMetrics.scores.chunk_quality?.total_chunks} (avg ${qualityMetrics.scores.chunk_quality?.avg_length} chars)`);
    console.log(`   Figures: ${qualityMetrics.scores.figure_quality?.enhancement_rate}% enhanced`);
    console.log(`   Embeddings: ${qualityMetrics.scores.embedding_quality?.embedding_rate}% complete`);
    
    if (qualityMetrics.issues.length > 0) {
      console.log(`\n⚠️  Issues found:`);
      qualityMetrics.issues.forEach((issue: string) => console.log(`   ${issue}`));
    }

    // STEP 2: Get golden questions for this manual
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 STEP 2: Answer Quality Evaluation`);
    console.log(`${'='.repeat(80)}\n`);

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
    console.log(`🤖 Using grading model: ${GRADER_MODEL}`);

    const results = [];

    // Process each question
    for (const q of questions as GoldenQuestion[]) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 Question ${results.length + 1}/${questions.length}`);
      console.log(`📝 "${q.question}"`);
      console.log(`📚 Category: ${q.category} | Importance: ${q.importance}`);
      console.log(`${'='.repeat(80)}\n`);

      // Step 1: Search for relevant passages using existing search-manuals-robust function
      console.log(`🔍 Searching for relevant passages...`);
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
        const errorText = await searchResponse.text();
        console.error(`❌ Search failed (${searchResponse.status}):`, errorText);
        console.error('Failed question:', q.question);
        continue;
      }

      const searchData = await searchResponse.json();
      const passages = searchData.results || [];

      console.log(`\n📚 Retrieved ${passages.length} passages from search`);
      
      // Log passage quality
      const withPages = passages.filter(p => p.page_start && p.page_end).length;
      const avgScore = passages.reduce((sum, p) => sum + (p.score || 0), 0) / passages.length;
      
      console.log(`   ✓ Passages with page numbers: ${withPages}/${passages.length}`);
      console.log(`   ✓ Average relevance score: ${avgScore.toFixed(3)}`);
      console.log(`   ✓ Score range: ${Math.min(...passages.map(p => p.score || 0)).toFixed(3)} - ${Math.max(...passages.map(p => p.score || 0)).toFixed(3)}`);
      
      if (withPages < passages.length) {
        console.log(`   ⚠️  WARNING: ${passages.length - withPages} passages missing page numbers!`);
      }

      // Step 2: Generate answer using PRODUCTION answering AI (chat-manual)
      console.log(`🤖 Calling production answering AI (chat-manual)...`);
      const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat-manual`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: q.question,
          manual_id,
          conversation_id: null // One-shot evaluation, no conversation
        })
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error(`❌ Production answering failed (${chatResponse.status}):`, errorText);
        console.error('Failed question:', q.question);
        continue;
      }

      const chatData = await chatResponse.json();
      const answer = chatData;
      
      console.log(`\n✍️ Answer generated via PRODUCTION AI`);
      console.log(`   Answer length: ${answer.answer?.length || 0} chars`);
      console.log(`   Citations: ${answer.citations?.length || 0}`);
      console.log(`   Steps: ${answer.steps?.length || 0}`);

      // Step 3: Grade the answer with strict technical rubric
      const gradePrompt = {
        system: `You are a strict technical grader for arcade troubleshooting answers.

Score each category as PASS/PARTIAL/FAIL:
- citation_fidelity: Does answer cite actual passages? Are citations accurate?
- specificity: Are component names, part numbers, values specific (not vague)?
- procedure_completeness: Are all steps mentioned? Any critical gaps?
- tooling_context: Correct tools/equipment mentioned when needed?
- escalation_outcome: Clear next steps or when to escalate?
- safety_accuracy: No unsafe advice? Correct safety warnings?

CRITICAL RULES:
- If no overlap with passages and no cites → citation_fidelity = FAIL
- If ≥2 categories FAIL → overall = FAIL
- Otherwise if any PARTIAL or FAIL → overall = PARTIAL
- All PASS → overall = PASS

Return JSON with this exact structure:
{
  "score": {
    "citation_fidelity": "PASS|PARTIAL|FAIL",
    "specificity": "PASS|PARTIAL|FAIL",
    "procedure_completeness": "PASS|PARTIAL|FAIL",
    "tooling_context": "PASS|PARTIAL|FAIL",
    "escalation_outcome": "PASS|PARTIAL|FAIL",
    "safety_accuracy": "PASS|PARTIAL|FAIL"
  },
  "overall": "PASS|PARTIAL|FAIL",
  "missing_keywords": ["keyword1", "keyword2"],
  "evidence_pages": [1, 5, 12],
  "rationale": "brief summary explaining the overall score"
}`,
        user: `Question: ${q.question}

Expected keywords: ${JSON.stringify(q.expected_keywords || [])}

Manual passages:
${passagesText.substring(0, 6000)}

Assistant's answer JSON to grade:
${JSON.stringify(answer)}`
      };

      const gradeRequestBody: any = {
        model: GRADER_MODEL,
        max_completion_tokens: GRADER_MAX_TOKENS,
        messages: [
          { role: 'system', content: gradePrompt.system },
          { role: 'user', content: gradePrompt.user }
        ],
        response_format: { type: 'json_object' }
      };

      const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');
      const gradeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Project': openaiProjectId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradeRequestBody),
      });

      if (!gradeResponse.ok) {
        const gradeError = await gradeResponse.text();
        console.log(`\n❌ Grading failed for question: "${q.question}"`);
        console.error(`Grading error details:`, {
          status: gradeResponse.status,
          statusText: gradeResponse.statusText,
          error: gradeError
        });
        continue;
      }

      const gradeData = await gradeResponse.json();
      const grade = JSON.parse(gradeData.choices[0].message.content);
      
      console.log(`\n📊 Grade: ${grade.overall}`);
      console.log(`   Breakdown: citation=${grade.score.citation_fidelity}, specificity=${grade.score.specificity}`);
      console.log(`   Rationale: ${grade.rationale?.substring(0, 100)}...`);
      if (grade.missing_keywords?.length > 0) {
        console.log(`   ⚠️  Missing keywords: ${grade.missing_keywords.join(', ')}`);
      }

      // Store evaluation result with V2 structured data
      const { error: insertError } = await supabase
        .from('question_evaluations')
        .insert({
          question_id: q.id,
          manual_id,
          fec_tenant_id: profile.fec_tenant_id,
          answer: answer.answer, // legacy plain text
          answer_json: answer, // full structured answer
          citations: answer.citations,
          grade_overall: grade.overall,
          grade_breakdown: grade.score, // detailed category scores
          missing_keywords: grade.missing_keywords || [],
          rationale: grade.rationale,
          evidence_pages: grade.evidence_pages || [],
          retrieval_debug: {
            passages_count: passages.length,
            passages: passages.slice(0, 3).map((p: any) => ({
              page: p.page_start,
              score: p.score,
              preview: p.content.substring(0, 200)
            }))
          },
          answer_model: 'production-chat-manual',
          grader_model: GRADER_MODEL
        });

      if (insertError) {
        console.error('Error storing evaluation:', insertError);
      }

      results.push({
        question_id: q.id,
        question: q.question,
        answer: answer.answer,
        score: grade.overall,
        grade_breakdown: grade.score
      });
    }

    // Calculate summary stats
    const pass = results.filter(r => r.score === 'PASS').length;
    const partial = results.filter(r => r.score === 'PARTIAL').length;
    const fail = results.filter(r => r.score === 'FAIL').length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ EVALUATION COMPLETE`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`📊 Data Quality: ${qualityMetrics.scores.overall}%`);
    console.log(`📝 Answer Quality: PASS ${pass}/${results.length}, PARTIAL ${partial}/${results.length}, FAIL ${fail}/${results.length}`);

    return new Response(JSON.stringify({
      success: true,
      manual_id,
      quality_metrics: qualityMetrics,
      answer_evaluation: {
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