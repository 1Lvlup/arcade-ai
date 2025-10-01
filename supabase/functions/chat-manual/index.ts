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
      const relevanceScore = candidate.score || 0;

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
  console.log('🔍 Starting hybrid search for query:', query.substring(0, 100));
  
  const queryEmbedding = await createEmbedding(query);
  console.log('✅ Created query embedding');

  // Strategy 1: Vector search
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_chunks_improved', {
    query_embedding: queryEmbedding,
    top_k: 20,
    min_score: 0.25,
    manual: manual_id,
    tenant_id: tenant_id
  });

  if (vectorError) {
    console.error('❌ Vector search error:', vectorError);
  }

  console.log(`📊 Vector search found ${vectorResults?.length || 0} results`);

  // Strategy 2: Text search fallback
  let textResults = [];
  if (!vectorResults || vectorResults.length < 5) {
    const { data: textData, error: textError } = await supabase.rpc('match_chunks_text', {
      query_text: query,
      top_k: 20,
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
      search_limit: 12
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

  // Choose best results
  let finalResults = [];
  let strategy = 'none';
  if (vectorResults && vectorResults.length > 0) {
    finalResults = vectorResults;
    strategy = 'vector';
  } else if (textResults.length > 0) {
    finalResults = textResults;
    strategy = 'text';
  } else {
    finalResults = simpleResults;
    strategy = 'simple';
  }

  console.log(`✅ Using ${strategy} search strategy`);

  // Apply MMR for diversity if we have enough results
  if (finalResults.length > 10) {
    finalResults = applyMMR(finalResults, 0.7, 10);
    console.log('✅ Applied MMR for result diversity');
  } else {
    finalResults = finalResults.slice(0, 10);
  }

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);

  return { results: finalResults, strategy };
}

// Generate AI response
async function generateResponse(query: string, chunks: any[]) {
  // Format context with detailed information
  const context = chunks.map((chunk: any, idx: number) => {
    const pageInfo = chunk.page_start 
      ? `Pages ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}`
      : 'Page unknown';
    const menuPath = chunk.menu_path ? `Section: ${chunk.menu_path}` : '';
    const score = chunk.score ? `(Score: ${chunk.score.toFixed(3)})` : '';
    
    return `[Chunk ${idx + 1}] ${pageInfo} ${menuPath} ${score}\n${chunk.content}`;
  }).join('\n\n---\n\n');

  console.log('📝 Formatted context with', chunks.length, 'chunks');
  console.log('📄 Context preview:', context.substring(0, 200) + '...');

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json",
      ...(openaiProjectId && { "OpenAI-Project": openaiProjectId }),
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that helps technicians troubleshoot arcade game issues using technical manuals.

CRITICAL INSTRUCTIONS:
- ONLY use information from the manual content provided below
- If the answer is in the manual, cite the specific page numbers when you reference information
- If the information is NOT in the provided manual content, clearly state: "I don't find this information in the manual"
- Keep your answers practical and focused on troubleshooting
- Do NOT make up information or guess if it's not in the manual content
- When referring to figures, diagrams, or specific sections, mention the page numbers

RELEVANT MANUAL CONTENT:
${context}`
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI chat failed:', response.status, errorText);
    throw new Error(`OpenAI chat failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
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
      console.log('  Score:', chunk.score?.toFixed(3) || 'N/A');
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

    // Generate AI response with context
    const aiResponse = await generateResponse(query, chunks);

    console.log("🤖 Generated response");
    console.log("Response preview:", aiResponse.substring(0, 200) + "...");
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
      strategy
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
