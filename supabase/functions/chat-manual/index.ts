import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const openaiProjectId = Deno.env.get("OPENAI_PROJECT_ID");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extract technical keywords from query
function keywordLine(q: string): string {
  const toks = q.match(/\b(CR-?2032|CMOS|BIOS|HDMI|VGA|J\d+|pin\s?\d+|[0-9]+V|5V|12V|error\s?E-?\d+)\b/ig) || [];
  return [...new Set(toks)].join(" ");
}

// Token boost for exact technical term matches
function tokenBoost(text: string): number {
  return /\b(CR-?2032|CMOS|BIOS|HDMI|J\d+|pin\s?\d+|[0-9]+V)\b/i.test(text) ? 0.15 : 0;
}

// Maximal Marginal Relevance for result diversity
function applyMMR(results: any[], lambda = 0.7, targetCount = 10): any[] {
  if (results.length <= targetCount) return results;

  const selected = [results[0]]; // Start with highest scoring result
  const remaining = results.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevanceScore = (candidate.score || 0) + tokenBoost(candidate.content);

      // Calculate diversity (1 - max similarity to selected items)
      let maxSimilarity = 0;
      for (const sel of selected) {
        const similarity = textSimilarity(candidate.content, sel.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      const diversityScore = 1 - maxSimilarity;

      // MMR formula: λ * relevance + (1-λ) * diversity
      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// Simple text similarity using Jaccard similarity
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Create embedding for search
async function createEmbedding(text: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: text 
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Search for relevant chunks using hybrid approach
async function searchChunks(query: string, manual_id?: string, tenant_id?: string) {
  const startTime = Date.now();
  
  // Extract keywords and enhance query
  const keywords = keywordLine(query);
  const hybridQuery = keywords ? `${query}\nKeywords: ${keywords}` : query;
  
  console.log('🔍 Starting hybrid search for query:', query.substring(0, 100));
  if (keywords) {
    console.log('🔑 Extracted keywords:', keywords);
  }
  
  const queryEmbedding = await createEmbedding(hybridQuery);
  console.log('✅ Created query embedding');

  // Strategy 1: Vector search - retrieve top 60 for reranking
  // Tuning: top_k_raw = 60, will rerank to top 10
  // Min score gate: 0.30 (tunable to 0.30-0.35 based on telemetry)
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_chunks_improved', {
    query_embedding: queryEmbedding,
    top_k: 60,
    min_score: 0.30,
    manual: manual_id,
    tenant_id: tenant_id
  });

  if (vectorError) {
    console.error('❌ Vector search error:', vectorError);
  }

  console.log(`📊 Vector search found ${vectorResults?.length || 0} results`);

  // Strategy 2: Text search fallback
  let textResults = [];
  if (!vectorResults || vectorResults.length < 10) {
    const { data: textData, error: textError } = await supabase.rpc('match_chunks_text', {
      query_text: hybridQuery,
      top_k: 60,
      manual: manual_id,
      tenant_id: tenant_id
    });

    if (textError) {
      console.error('❌ Text search error:', textError);
    } else {
      textResults = textData || [];
      console.log(`📊 Text search found ${textResults.length} results`);
    }
  }

  // Strategy 3: Simple search as last resort
  let simpleResults = [];
  if ((!vectorResults || vectorResults.length === 0) && textResults.length === 0) {
    const { data: simpleData, error: simpleError } = await supabase.rpc('simple_search', {
      search_query: query,
      search_manual: manual_id,
      search_tenant: tenant_id,
      search_limit: 60
    });

    if (simpleError) {
      console.error('❌ Simple search error:', simpleError);
    } else {
      simpleResults = (simpleData || []).map((r: any) => ({
        ...r,
        score: 0.5,
        content_type: 'text'
      }));
      console.log(`📊 Simple search found ${simpleResults.length} results`);
    }
  }

  // Choose best candidates for reranking
  let candidates = [];
  let strategy = 'none';
  if (vectorResults && vectorResults.length > 0) {
    candidates = vectorResults;
    strategy = 'vector';
  } else if (textResults.length > 0) {
    candidates = textResults;
    strategy = 'text';
  } else {
    candidates = simpleResults;
    strategy = 'simple';
  }

  console.log(`✅ Using ${strategy} search strategy with ${candidates.length} candidates`);

  // Apply Cohere Rerank if we have candidates
  let finalResults = [];
  if (candidates.length > 0) {
    try {
      const cohereApiKey = Deno.env.get("COHERE_API_KEY");
      if (!cohereApiKey) {
        console.warn('⚠️ COHERE_API_KEY not found, skipping rerank');
        finalResults = candidates.slice(0, 10);
      } else {
        console.log('🔄 Reranking with Cohere...');
        // Truncate documents to ~1500 chars to stay within API limits
        const truncatedDocs = candidates.map(c => 
          c.content.length > 1500 ? c.content.slice(0, 1500) : c.content
        );
        
        const cohereRes = await fetch("https://api.cohere.ai/v1/rerank", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cohereApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "rerank-3",
            query: query,
            documents: truncatedDocs,
            top_n: 10
          })
        });

        if (!cohereRes.ok) {
          const errorText = await cohereRes.text();
          console.error('❌ Cohere rerank failed:', cohereRes.status, errorText);
          finalResults = candidates.slice(0, 10);
        } else {
          const rerank = await cohereRes.json();
          finalResults = rerank.results.map((r: any) => ({
            ...candidates[r.index],
            rerank_score: r.relevance_score,
            original_score: candidates[r.index].score
          }));
          console.log(`✅ Reranked to top ${finalResults.length} results`);
        }
      }
    } catch (error) {
      console.error('❌ Rerank error:', error);
      finalResults = candidates.slice(0, 10);
    }
  }

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);

  return { results: finalResults, strategy };
}

// STAGE 1: Generate draft answer using ONLY manual context
async function generateDraftAnswer(query: string, chunks: any[]) {
  // Format context with [pX] prefixes for easy citation
  const context = chunks.map((chunk: any, idx: number) => {
    const pagePrefix = chunk.page_start 
      ? `[p${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}]`
      : '[p?]';
    const menuPath = chunk.menu_path ? ` ${chunk.menu_path}` : '';
    
    return `${pagePrefix}${menuPath}\n${chunk.content}`;
  }).join('\n\n---\n\n');

  console.log('📝 [STAGE 1] Formatted context with', chunks.length, 'chunks');
  console.log('📄 Context preview:', context.substring(0, 200) + '...');

  const messages = [
    {
      role: "system",
      content: `You are a senior arcade technician. Using ONLY the provided manual content below,
create a structured draft answer. Include citations (page numbers/figures) where you use information.
If the answer is not in the manual, say so clearly in the draft.
Do not guess or add information beyond the manual in this stage.

MANUAL CONTEXT:
${context}`
    },
    {
      role: "user",
      content: `Question: ${query}
Provide a draft answer in structured JSON with these fields:
{
  "summary": string,
  "steps": [ { "step": string, "expected": string } ],
  "why": [string],
  "safety": [string],
  "sources": [ { "page": number, "note": string } ]
}`
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [STAGE 1] Draft generation failed:', response.status, errorText);
    throw new Error(`Draft generation failed: ${response.status}`);
  }
  
  const data = await response.json();
  const draftJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ [STAGE 1] Draft answer generated:', JSON.stringify(draftJson).substring(0, 200) + '...');
  
  return draftJson;
}

// STAGE 2: Enhance draft with expert knowledge
async function generateExpertAnswer(query: string, draftJson: any) {
  console.log('🎓 [STAGE 2] Enhancing draft with expert knowledge...');

  const messages = [
    {
      role: "system",
      content: `You are a master arcade technician mentor. You have:
- The user's question
- A structured draft answer from the manual
- Your own expert knowledge of similar machines and common failures

Tasks:
1. Review the draft for accuracy against the manual.
2. If the manual contains enough info, polish it into a clear, conversational answer.
3. If the manual lacks detail, add your own expert reasoning and best-practice troubleshooting steps beyond the manual (clearly labeled as "Expert Advice").
4. Do not hallucinate specifics about this exact model if unsupported; instead, give generalized best practices or next-step tests a pro would run.
5. Always cite the manual where applicable, and clearly separate "manual content" vs "expert advice."
6. Make the answer conversational, supportive, and actionable.

Return JSON in this schema:
{
  "summary": string,
  "steps": [ { "step": string, "expected": string, "source": "manual"|"expert" } ],
  "expert_advice": [string],
  "safety": [string],
  "sources": [ { "page": number, "note": string } ]
}`
    },
    {
      role: "user",
      content: `Question: ${query}
Manual-based draft answer:
${JSON.stringify(draftJson, null, 2)}`
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4, // Slightly higher for more creative expert advice
      response_format: { type: "json_object" },
      max_tokens: 1200,
      messages
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [STAGE 2] Expert enhancement failed:', response.status, errorText);
    console.log('⚠️ Falling back to draft answer');
    return draftJson; // Fallback to draft if enhancement fails
  }
  
  const data = await response.json();
  const expertJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ [STAGE 2] Expert answer generated:', JSON.stringify(expertJson).substring(0, 200) + '...');
  
  return expertJson;
}


async function generateResponse(query: string, chunks: any[]) {
  // Format context with [pX] prefixes for easy citation
  // Each line is prefixed with page info to make citations simple
  const context = chunks.map((chunk: any, idx: number) => {
    const pagePrefix = chunk.page_start 
      ? `[p${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}]`
      : '[p?]';
    const menuPath = chunk.menu_path ? ` ${chunk.menu_path}` : '';
    
    return `${pagePrefix}${menuPath}\n${chunk.content}`;
  }).join('\n\n---\n\n');

  console.log('📝 Formatted context with', chunks.length, 'chunks');
  console.log('📄 Context preview:', context.substring(0, 200) + '...');

  const messages = [
    {
      role: "system",
      content: `Lead Arcade Technician AI Assistant.

CRITICAL INSTRUCTIONS:
- Use ONLY the provided manual context (context is prefixed with [pX] page markers)
- If the answer is not in the context, respond with: "I don't find this in the manual"
- Temperature: 0.2 for grounded, consistent answers
- Return STRICT JSON with this exact structure:
{
  "summary": "Brief overview of the solution",
  "steps": ["Step 1 description", "Step 2 description", ...],
  "why": ["Explanation 1", "Explanation 2", ...],
  "safety": ["Safety warning 1", "Safety warning 2", ...],
  "sources": ["p8", "p12-15", "fig 12", ...]
}

- summary: Concise answer to the question
- steps: Ordered, atomic actions (use empty array if not applicable)
- why: Explanations of why these steps work (use empty array if not applicable)  
- safety: Important safety warnings (use empty array if none)
- sources: Page numbers and figure references from context (e.g., "p8", "p12-15", "fig 12")`
    },
    {
      role: "user",
      content: `Question:\n${query}`
    },
    {
      role: "assistant",
      content: `Manual context:\n${context}`
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI chat failed:', response.status, errorText);
    throw new Error(`OpenAI chat failed: ${response.status}`);
  }
  
  const data = await response.json();
  const draftJson = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ Parsed draft JSON response:', JSON.stringify(draftJson).substring(0, 200) + '...');
  
  // Run reviewer pass to ensure quality and accuracy
  console.log('🔍 Running reviewer pass...');
  const reviewerMessages = [
    {
      role: "system",
      content: `You are a strict reviewer. Your job is to edit the JSON response to ensure:
1. All claims are present in the provided context (no hallucinations)
2. Steps are atomic and properly ordered
3. Page citations are included in sources array
4. Generic fluff is removed

CRITICAL: Do NOT add facts that are not in the context. Only edit, refine, and cite properly.
Return the edited JSON in the same structure.`
    },
    {
      role: "user",
      content: `QUESTION:\n${query}\n\nCONTEXT:\n${context}\n\nDRAFT_JSON:\n${JSON.stringify(draftJson)}`
    }
  ];

  const reviewResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages: reviewerMessages
    }),
  });
  
  if (!reviewResponse.ok) {
    const errorText = await reviewResponse.text();
    console.error('❌ Reviewer pass failed:', reviewResponse.status, errorText);
    console.log('⚠️ Falling back to draft response');
    return draftJson;
  }
  
  const reviewData = await reviewResponse.json();
  const finalJson = JSON.parse(reviewData.choices[0].message.content);
  
  console.log('✅ Reviewer pass complete:', JSON.stringify(finalJson).substring(0, 200) + '...');
  
  return finalJson;
}

// Grade the answer using a rubric
async function gradeAnswerWithRubric(params: {
  question: string;
  answer: any;
  passages: any[];
  openaiApiKey: string;
  openaiProjectId?: string;
}): Promise<any> {
  const systemPrompt = `You are an expert grader for technical support answers. Grade answers using this rubric:

**citation_fidelity**: Are all facts cited with specific pages/figures from passages?
- PASS: Every claim has a page/figure cite
- PARTIAL: Most claims cited, 1-2 missing
- FAIL: Many claims lack citations

**specificity**: Are part numbers, voltages, torque values, error codes given when in passages?
- PASS: All specific details included
- PARTIAL: Some details missing
- FAIL: Generic answer when specifics available

**procedure_completeness**: For multi-step procedures, are all steps from passages included in order?
- PASS: All steps present and ordered
- PARTIAL: Minor steps missing
- FAIL: Major steps missing or out of order

**tooling_context**: If passages mention required tools, are they listed?
- PASS: All tools listed
- PARTIAL: Some tools missing
- FAIL: Tools not mentioned when required

**escalation_outcome**: If passages say "contact service", is that preserved?
- PASS: Escalation properly included
- PARTIAL: Escalation mentioned but unclear
- FAIL: Missing escalation when required

**safety_accuracy**: Are safety warnings from passages included accurately?
- PASS: All warnings present
- PARTIAL: Some warnings missing
- FAIL: Safety info omitted or incorrect

Return JSON:
{
  "score": {
    "citation_fidelity": "PASS"|"PARTIAL"|"FAIL",
    "specificity": "PASS"|"PARTIAL"|"FAIL",
    "procedure_completeness": "PASS"|"PARTIAL"|"FAIL",
    "tooling_context": "PASS"|"PARTIAL"|"FAIL",
    "escalation_outcome": "PASS"|"PARTIAL"|"FAIL",
    "safety_accuracy": "PASS"|"PARTIAL"|"FAIL"
  },
  "overall": "PASS"|"PARTIAL"|"FAIL",
  "missing_keywords": ["keyword1", "keyword2"],
  "evidence_pages": ["p8", "fig 12"],
  "rationale": "brief explanation"
}`;

  const passagesBlock = params.passages.map(p => {
    const tags = [];
    if (p.page_start) tags.push(`p${p.page_start}`);
    if (p.page_end && p.page_end !== p.page_start) tags.push(`-${p.page_end}`);
    const tag = tags.join('');
    return `${tag ? `[${tag}] ` : ""}${p.content}`;
  }).join("\n---\n");

  const answerText = typeof params.answer === 'string' 
    ? params.answer 
    : JSON.stringify(params.answer);

  const userPrompt = `
QUESTION:
${params.question}

ASSISTANT_ANSWER:
${answerText}

RETRIEVED_PASSAGES (verbatim; include page/figure if you have them):
${passagesBlock}

Now grade according to the rubric and return JSON only.
  `.trim();

  const gradeResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${params.openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(params.openaiProjectId && { "OpenAI-Project": params.openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }),
  });

  if (!gradeResponse.ok) {
    const errorText = await gradeResponse.text();
    console.error('❌ Grading failed:', gradeResponse.status, errorText);
    return null;
  }

  const gradeData = await gradeResponse.json();
  return JSON.parse(gradeData.choices[0].message.content);
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, manual_id } = await req.json();
    
    if (!query) {
      throw new Error("Query is required");
    }

    console.log("\n=================================");
    console.log("🔍 NEW CHAT REQUEST");
    console.log("Query:", query);
    console.log("Manual ID:", manual_id || "All manuals");
    console.log("=================================\n");

    // Extract tenant from auth header if available
    const authHeader = req.headers.get('authorization');
    let tenant_id: string | undefined;
    
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fec_tenant_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          tenant_id = profile.fec_tenant_id;
          await supabase.rpc('set_tenant_context', { tenant_id });
          console.log('👤 Tenant ID:', tenant_id);
        }
      }
    }

    // Search for relevant chunks with hybrid approach
    const { results: chunks, strategy } = await searchChunks(query, manual_id, tenant_id);
    
    console.log('\n📚 RETRIEVED CHUNKS:');
    console.log('Strategy used:', strategy);
    console.log('Total chunks:', chunks.length);
    chunks.forEach((chunk: any, idx: number) => {
      console.log(`\n[Chunk ${idx + 1}]`);
      console.log('  Manual:', chunk.manual_id);
      console.log('  Pages:', chunk.page_start, '-', chunk.page_end);
      console.log('  Menu Path:', chunk.menu_path || 'N/A');
      console.log('  Original Score:', chunk.original_score?.toFixed(3) || chunk.score?.toFixed(3) || 'N/A');
      if (chunk.rerank_score !== undefined) {
        console.log('  Rerank Score:', chunk.rerank_score.toFixed(3));
      }
      console.log('  Content preview:', chunk.content.substring(0, 150) + '...');
    });
    console.log('\n=================================\n');

    if (chunks.length === 0) {
      console.log('⚠️ No relevant chunks found');
      return new Response(JSON.stringify({ 
        response: "I couldn't find any relevant information in the manual for your question. Please try rephrasing or ask about a different topic.",
        sources: [],
        strategy: 'none'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check answerability score before calling GPT
    const weak = (chunks.length < 3) || 
                 (chunks.every(c => (c.score ?? 0) < 0.3) && 
                  chunks.every(c => (c.rerank_score ?? 0) < 0.45));
    
    if (weak) {
      console.log('⚠️ Low answerability score - returning early without GPT call');
      console.log('  Chunk count:', chunks.length);
      console.log('  Max score:', Math.max(...chunks.map(c => c.score ?? 0)));
      console.log('  Max rerank score:', Math.max(...chunks.map(c => c.rerank_score ?? 0)));
      
      return new Response(JSON.stringify({ 
        response: "I don't find this information in the manual for this question. The retrieved content may not be relevant enough to provide a reliable answer.",
        sources: chunks.map((chunk: any) => ({
          manual_id: chunk.manual_id,
          content: chunk.content.substring(0, 200) + "...",
          page_start: chunk.page_start,
          page_end: chunk.page_end,
          menu_path: chunk.menu_path,
          score: chunk.score,
          rerank_score: chunk.rerank_score
        })),
        strategy
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate AI response with context
    const aiResponse = await generateResponse(query, chunks);

    console.log("🤖 Generated response");
    console.log("Response preview:", JSON.stringify(aiResponse).substring(0, 200) + "...");

    // Grade the answer
    console.log("📊 Grading answer quality...");
    const grading = await gradeAnswerWithRubric({
      question: query,
      answer: aiResponse,
      passages: chunks,
      openaiApiKey,
      openaiProjectId
    });

    if (grading) {
      console.log('✅ Grading complete:', grading.overall);
      console.log('   Scores:', Object.entries(grading.score).map(([k, v]) => `${k}:${v}`).join(', '));
    }

    // Build metadata for logging and transparency
    const metadata = {
      manual_id: manual_id || "all_manuals",
      embedding_model: "text-embedding-3-small",
      retrieval_strategy: strategy,
      candidate_count: chunks.length,
      rerank_scores: chunks.slice(0, 10).map(c => c.rerank_score ?? null),
      answerability_passed: !weak,
      sources_used: chunks.map(c => ({
        manual_id: c.manual_id,
        pages: `${c.page_start}${c.page_end && c.page_end !== c.page_start ? `-${c.page_end}` : ''}`,
        menu_path: c.menu_path,
        score: c.score,
        rerank_score: c.rerank_score
      }))
    };

    // Build the context that GPT saw
    const contextSeen = chunks.map(chunk => {
      const pageInfo = chunk.page_start 
        ? `[Pages ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}]`
        : '';
      const pathInfo = chunk.menu_path ? `[${chunk.menu_path}]` : '';
      return `${pageInfo}${pathInfo ? ' ' + pathInfo : ''}\n${chunk.content}`;
    }).join('\n\n---\n\n');

    console.log("📋 Metadata:", JSON.stringify(metadata, null, 2));
    console.log("\n=================================\n");

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: chunks.map((chunk: any) => ({
        manual_id: chunk.manual_id,
        content: chunk.content.substring(0, 200) + "...",
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        menu_path: chunk.menu_path,
        score: chunk.score
      })),
      strategy,
      grading,
      metadata,
      context_seen: contextSeen
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ CHAT ERROR:", error);
    console.error("Stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      sources: [],
      strategy: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
