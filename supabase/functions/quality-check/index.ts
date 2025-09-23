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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Quality metrics calculation
async function calculateQualityMetrics(manual_id: string) {
  console.log(`🔍 Running quality check for manual: ${manual_id}`);
  
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
    const avgChunkLength = chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length;
    const shortChunks = chunks.filter(c => c.content.length < 100).length;
    const longChunks = chunks.filter(c => c.content.length > 2000).length;
    const duplicateContent = new Set(chunks.map(c => c.content.slice(0, 200))).size;
    
    results.scores.chunk_quality = {
      total_chunks: chunks.length,
      avg_length: Math.round(avgChunkLength),
      short_chunks: shortChunks,
      long_chunks: longChunks,
      uniqueness: Math.round((duplicateContent / chunks.length) * 100)
    };

    // 2. FIGURE QUALITY ANALYSIS
    const { data: figures } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', manual_id);

    let figureScore = 0;
    if (figures && figures.length > 0) {
      const enhancedFigures = figures.filter(f => 
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
    const embeddings = chunks.filter(c => c.embedding).length;
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

    console.log(`✅ Quality check complete for ${manual_id}. Overall score: ${overallScore}%`);
    return results;

  } catch (error) {
    console.error("Quality check error:", error);
    results.issues.push(`❌ Quality check failed: ${error.message}`);
    return results;
  }
}

// Generate golden questions for testing
async function generateGoldenQuestions(manual_id: string) {
  console.log(`🧠 Generating golden questions for manual: ${manual_id}`);
  
  try {
    // Get sample content from the manual
    const { data: chunks } = await supabase
      .from('chunks_text')
      .select('content')
      .eq('manual_id', manual_id)
      .limit(5);

    if (!chunks || chunks.length === 0) {
      return { error: "No content found to generate questions from" };
    }

    const sampleContent = chunks.map(c => c.content.slice(0, 500)).join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_completion_tokens: 800,
        messages: [{
          role: 'user',
          content: `Based on this arcade game manual content, generate 10 high-quality troubleshooting questions that a technician would realistically ask. Focus on:
          
          1. Common failure modes
          2. Electrical issues (fuses, power, connections)
          3. Mechanical problems (motors, belts, sensors)
          4. Game-specific features
          5. Error codes and diagnostics
          
          Format as JSON array of objects with "question" and "expected_topics" fields.
          
          Manual content:
          ${sampleContent}`
        }]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    try {
      const questions = JSON.parse(content);
      console.log(`✅ Generated ${questions.length} golden questions for ${manual_id}`);
      return { questions };
    } catch (parseError) {
      console.error("Failed to parse generated questions:", parseError);
      return { error: "Failed to parse generated questions" };
    }

  } catch (error) {
    console.error("Golden question generation error:", error);
    return { error: error.message };
  }
}

// Test search and chat quality with golden questions
async function testSearchQuality(manual_id: string, questions: any[]) {
  console.log(`🔍 Testing search quality for manual: ${manual_id}`);
  
  const testResults = [];
  
  for (const q of questions.slice(0, 5)) { // Test first 5 questions
    try {
      // Test search function
      const searchResponse = await fetch(`${supabaseUrl}/functions/v1/search-manuals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          query: q.question,
          manual_id: manual_id,
          max_results: 5
        })
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const relevantResults = searchData.results?.length || 0;
        const avgSimilarity = searchData.results?.length > 0 
          ? searchData.results.reduce((sum: number, r: any) => sum + r.similarity, 0) / searchData.results.length 
          : 0;

        testResults.push({
          question: q.question,
          search_results: relevantResults,
          avg_similarity: Math.round(avgSimilarity * 100) / 100,
          status: relevantResults > 0 ? 'pass' : 'fail'
        });
      } else {
        testResults.push({
          question: q.question,
          status: 'error',
          error: `Search API error: ${searchResponse.status}`
        });
      }
    } catch (error) {
      testResults.push({
        question: q.question,
        status: 'error',
        error: error.message
      });
    }
  }

  const passRate = testResults.filter(r => r.status === 'pass').length / testResults.length;
  console.log(`✅ Search quality test complete. Pass rate: ${Math.round(passRate * 100)}%`);
  
  return {
    pass_rate: Math.round(passRate * 100),
    results: testResults
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id, test_type = 'all' } = await req.json();
    
    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    console.log(`🔬 Starting quality check for manual: ${manual_id}, test_type: ${test_type}`);

    const result: any = {
      manual_id,
      test_type,
      timestamp: new Date().toISOString()
    };

    // Run quality metrics
    if (test_type === 'all' || test_type === 'metrics') {
      result.quality_metrics = await calculateQualityMetrics(manual_id);
    }

    // Generate and test golden questions
    if (test_type === 'all' || test_type === 'questions') {
      const questionResult = await generateGoldenQuestions(manual_id);
      if (questionResult.questions) {
        result.golden_questions = questionResult.questions;
        
        // Test search quality with generated questions
        if (test_type === 'all' || test_type === 'search') {
          result.search_quality = await testSearchQuality(manual_id, questionResult.questions);
        }
      } else {
        result.question_generation_error = questionResult.error;
      }
    }

    console.log(`✅ Quality check complete for ${manual_id}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Quality check function error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});