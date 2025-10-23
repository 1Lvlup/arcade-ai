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
const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');

const QUESTION_MODEL = 'gpt-5-2025-08-07';
const GRADER_MODEL = 'gpt-5-2025-08-07';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { manual_id } = await req.json();
    console.log('🚀 Starting comprehensive question generation & evaluation for:', manual_id);

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

    await supabase.rpc('set_tenant_context', { p_tenant_id: profile.fec_tenant_id });

    // ========================================================================
    // STEP 1: Build comprehensive manual summary
    // ========================================================================
    console.log('\n📊 STEP 1: Analyzing manual content...');
    
    const { data: manual } = await supabase
      .from('documents')
      .select('title, source_filename')
      .eq('manual_id', manual_id)
      .single();

    if (!manual) {
      throw new Error('Manual not found');
    }

    const { data: chunks } = await supabase
      .from('chunks_text')
      .select('content, menu_path, page_start, page_end')
      .eq('manual_id', manual_id)
      .order('page_start', { ascending: true });

    if (!chunks || chunks.length === 0) {
      throw new Error('No content found for this manual');
    }

    const { data: figures } = await supabase
      .from('figures')
      .select('caption_text, keywords, page_number, vision_text')
      .eq('manual_id', manual_id)
      .order('page_number', { ascending: true });

    // Build structured summary
    const sections: string[] = [];
    sections.push(`# MANUAL: ${manual.title}`);
    sections.push(`Source: ${manual.source_filename}`);
    sections.push(`Total Pages: ${Math.max(...chunks.map(c => c.page_end || 0))}`);
    sections.push('');

    // Table of contents
    const menuPaths = new Set(chunks.filter(c => c.menu_path).map(c => c.menu_path));
    sections.push(`# TABLE OF CONTENTS (${menuPaths.size} sections)`);
    Array.from(menuPaths).sort().forEach(path => sections.push(`  • ${path}`));
    sections.push('');

    // Key sections preview
    const keywordSections = ['troubleshooting', 'maintenance', 'installation', 'setup', 'safety', 'specifications', 'error'];
    const relevantChunks = chunks.filter(c => 
      keywordSections.some(kw => 
        c.menu_path?.toLowerCase().includes(kw) || 
        c.content.toLowerCase().includes(kw)
      )
    );

    sections.push(`# KEY CONTENT SAMPLES`);
    relevantChunks.slice(0, 8).forEach(chunk => {
      sections.push(`## ${chunk.menu_path || 'General'} (Pages ${chunk.page_start}-${chunk.page_end})`);
      sections.push(chunk.content.substring(0, 300) + '...\n');
    });

    const summary = sections.join('\n');

    // ========================================================================
    // STEP 2: Generate strategic test questions using structured output
    // ========================================================================
    console.log('\n🧠 STEP 2: Generating strategic test questions...');

    const questionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Project': openaiProjectId || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: QUESTION_MODEL,
        max_completion_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: `You are an expert at creating diagnostic test questions for technical documentation systems.

Your goal: Generate realistic, DETAILED troubleshooting questions that will STRESS TEST a RAG system's ability to:
- Find the right information across multiple pages
- Combine information from different sections
- Handle technical terminology correctly
- Provide specific part numbers, voltages, and procedures
- Give complete step-by-step answers

CRITICAL: Questions should be 2-4 sentences long to provide full context and detail.

QUESTION TYPES TO GENERATE (10-12 total):

1. **Multi-step Troubleshooting** (3-4 questions)
   - Questions that require information from 3+ different sections
   - Example: "The lane sensor is showing error code 12 and the display is flashing red. What are the possible causes for this error code, what diagnostic steps should I perform in order, and what tools will I need?"
   - Should test: retrieval quality, procedure completeness, proper sequencing

2. **Specification Lookups** (2-3 questions)
   - Questions requiring exact part numbers, voltages, measurements
   - Example: "I need to replace the motor control board and want to verify the correct voltage output. What voltage should the motor control board output on connector J5, and what is the part number for a replacement board?"
   - Should test: specificity, citation accuracy, no hallucination

3. **Complex Diagnostics** (2-3 questions)
   - Questions about interpreting error codes or symptoms with context
   - Example: "The green LED flashes 3 times, pauses, then turns solid red and stays on. The machine was working fine yesterday. What does this error pattern mean, what components should I check, and is there anything I should verify before replacing parts?"
   - Should test: diagnostic reasoning, multi-source synthesis

4. **Installation/Setup** (2-3 questions)
   - Questions about proper installation or calibration procedures with detail
   - Example: "I'm installing new ball gate sensors for the first time. What is the proper alignment procedure, what tools do I need, what are the critical safety steps, and how do I verify they're working correctly after installation?"
   - Should test: procedure completeness, safety mentions, tool requirements

QUALITY REQUIREMENTS:
- Each question should be 2-4 sentences providing full context and specificity
- Each question should require 6-12 sentences to answer comprehensively
- Include 5-7 expected_keywords that MUST appear in a good answer
- Questions should be specific to this manual's content (use actual component names you see)
- Vary importance: high for safety/critical, medium for routine, low for optional

Return as a JSON object with a "questions" array.`
          },
          {
            role: 'user',
            content: `Analyze this manual and generate 10-12 strategic test questions:

${summary.substring(0, 8000)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_test_questions',
            description: 'Generate strategic test questions for a technical manual',
            parameters: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      question_type: { 
                        type: 'string',
                        enum: ['troubleshooting', 'specifications', 'diagnostics', 'installation', 'maintenance', 'safety']
                      },
                      category: { type: 'string' },
                      importance: { 
                        type: 'string',
                        enum: ['high', 'medium', 'low']
                      },
                      expected_keywords: { 
                        type: 'array',
                        items: { type: 'string' }
                      },
                      explanation: { type: 'string' }
                    },
                    required: ['question', 'question_type', 'category', 'importance', 'expected_keywords', 'explanation'],
                    additionalProperties: false
                  }
                }
              },
              required: ['questions'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_test_questions' } }
      }),
    });

    if (!questionResponse.ok) {
      const errorText = await questionResponse.text();
      console.error('OpenAI API error:', questionResponse.status, errorText);
      throw new Error(`Failed to generate questions: ${questionResponse.status}`);
    }

    const questionData = await questionResponse.json();
    const toolCall = questionData.choices[0].message.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const { questions } = JSON.parse(toolCall.function.arguments);
    console.log(`✅ Generated ${questions.length} test questions`);

    // ========================================================================
    // STEP 3: Store questions in database
    // ========================================================================
    console.log('\n💾 STEP 3: Storing questions...');

    const questionsToInsert = questions.map((q: any) => ({
      manual_id,
      fec_tenant_id: profile.fec_tenant_id,
      question: q.question,
      question_type: q.question_type,
      category: q.category,
      importance: q.importance,
      explanation: q.explanation,
      expected_keywords: q.expected_keywords,
      filters: null
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('golden_questions')
      .insert(questionsToInsert)
      .select('id, question, question_type, category, importance, expected_keywords');

    if (insertError) {
      console.error('Error storing questions:', insertError);
      throw new Error('Failed to store questions');
    }

    console.log(`✅ Stored ${insertedQuestions.length} questions`);

    // ========================================================================
    // STEP 4: Answer each question using PRODUCTION chat system
    // ========================================================================
    console.log('\n🤖 STEP 4: Answering questions with production system...');

    const results = [];

    for (let i = 0; i < insertedQuestions.length; i++) {
      const q = insertedQuestions[i];
      const originalQ = questions[i];
      
      console.log(`\n[${ i + 1}/${insertedQuestions.length}] "${q.question}"`);

      // Call production chat-manual with explicit request for detailed answer
      const detailedQuestion = `${q.question}\n\nPlease provide a comprehensive, detailed answer with:
- Complete step-by-step procedures
- Specific part numbers, voltages, and component names
- Page references from the manual
- Safety considerations
- Required tools
- Verification steps
- What to do if the issue persists

Answer in 6-12 sentences with specific citations.`;

      const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat-manual`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: detailedQuestion,
          manual_id,
          conversation_id: null
        })
      });

      if (!chatResponse.ok) {
        console.error(`❌ Failed to get answer: ${chatResponse.status}`);
        continue;
      }

      const answer = await chatResponse.json();
      console.log(`  ✓ Got answer (${answer.answer?.length || 0} chars)`);

      // ========================================================================
      // STEP 5: Grade the answer with strict rubric
      // ========================================================================
      console.log(`  📊 Grading answer...`);

      const gradeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Project': openaiProjectId || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GRADER_MODEL,
          max_completion_tokens: 800,
          messages: [
            {
              role: 'system',
              content: `You are a strict grader for technical troubleshooting answers.

Grade each category as PASS/PARTIAL/FAIL:

1. **citation_fidelity**: Does answer cite actual manual pages? Are citations accurate?
   - PASS: Multiple specific page citations, verifiable against source
   - PARTIAL: Some citations but vague or incomplete
   - FAIL: No citations or fabricated page numbers

2. **specificity**: Are component names, part numbers, values specific (not vague)?
   - PASS: Exact part numbers, connector IDs, voltage values, pin numbers
   - PARTIAL: Some specifics but also generic terms
   - FAIL: All generic/vague ("check the motor", "test voltage")

3. **procedure_completeness**: Are all necessary steps included? Any critical gaps?
   - PASS: Complete step-by-step with all safety, tools, and verification
   - PARTIAL: Main steps present but missing safety or verification
   - FAIL: Missing critical steps or dangerous gaps

4. **tooling_context**: Are correct tools/equipment mentioned when needed?
   - PASS: Specific tools mentioned (multimeter, torque wrench, etc.)
   - PARTIAL: Tools mentioned but not all necessary ones
   - FAIL: No tool mentions when clearly needed

5. **escalation_outcome**: Clear next steps or when to escalate?
   - PASS: Clear "if X then do Y" logic and escalation criteria
   - PARTIAL: Some guidance but incomplete
   - FAIL: Dead end with no next steps

6. **safety_accuracy**: No unsafe advice? Correct safety warnings?
   - PASS: Mentions power-off, lockout/tagout, specific hazards
   - PARTIAL: General safety mention but not specific
   - FAIL: Dangerous omissions or wrong safety info

OVERALL SCORE RULES:
- If ≥2 categories are FAIL → overall = FAIL
- Else if any PARTIAL or FAIL → overall = PARTIAL  
- All PASS → overall = PASS

Return JSON with exact structure shown.`
            },
            {
              role: 'user',
              content: `Question: ${q.question}

Expected keywords: ${JSON.stringify(originalQ.expected_keywords)}

Answer to grade:
${JSON.stringify(answer, null, 2)}

Grade this answer against the rubric.`
            }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'grade_answer',
              description: 'Grade a technical answer against rubric',
              parameters: {
                type: 'object',
                properties: {
                  score: {
                    type: 'object',
                    properties: {
                      citation_fidelity: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                      specificity: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                      procedure_completeness: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                      tooling_context: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                      escalation_outcome: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                      safety_accuracy: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] }
                    },
                    required: ['citation_fidelity', 'specificity', 'procedure_completeness', 'tooling_context', 'escalation_outcome', 'safety_accuracy'],
                    additionalProperties: false
                  },
                  overall: { type: 'string', enum: ['PASS', 'PARTIAL', 'FAIL'] },
                  missing_keywords: { type: 'array', items: { type: 'string' } },
                  evidence_pages: { type: 'array', items: { type: 'number' } },
                  rationale: { type: 'string' }
                },
                required: ['score', 'overall', 'missing_keywords', 'evidence_pages', 'rationale'],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'grade_answer' } }
        }),
      });

      if (!gradeResponse.ok) {
        console.error(`❌ Grading failed: ${gradeResponse.status}`);
        continue;
      }

      const gradeData = await gradeResponse.json();
      const gradeToolCall = gradeData.choices[0].message.tool_calls?.[0];
      
      if (!gradeToolCall) {
        console.error('❌ No grading tool call');
        continue;
      }

      const grade = JSON.parse(gradeToolCall.function.arguments);
      console.log(`  ✓ Grade: ${grade.overall}`);

      // Store evaluation
      await supabase
        .from('question_evaluations')
        .insert({
          question_id: q.id,
          manual_id,
          fec_tenant_id: profile.fec_tenant_id,
          answer: answer.answer,
          answer_json: answer,
          citations: answer.citations,
          grade_overall: grade.overall,
          grade_breakdown: grade.score,
          missing_keywords: grade.missing_keywords,
          rationale: grade.rationale,
          evidence_pages: grade.evidence_pages,
          retrieval_debug: {},
          answer_model: 'production-chat-manual',
          grader_model: GRADER_MODEL
        });

      results.push({
        question: q.question,
        grade: grade.overall,
        breakdown: grade.score
      });
    }

    // Calculate summary
    const pass = results.filter(r => r.grade === 'PASS').length;
    const partial = results.filter(r => r.grade === 'PARTIAL').length;
    const fail = results.filter(r => r.grade === 'FAIL').length;

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ COMPLETE');
    console.log(`${'='.repeat(80)}`);
    console.log(`Questions: ${results.length}`);
    console.log(`PASS: ${pass}, PARTIAL: ${partial}, FAIL: ${fail}`);
    console.log(`Pass Rate: ${(pass / results.length * 100).toFixed(1)}%`);

    return new Response(JSON.stringify({
      success: true,
      manual_id,
      questions_generated: insertedQuestions.length,
      questions_evaluated: results.length,
      summary: {
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
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
