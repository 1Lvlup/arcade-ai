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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create embedding for search
async function createEmbedding(text: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json" 
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

// Search for relevant chunks
async function searchChunks(query: string, manual_id?: string, tenant_id?: string) {
  const queryEmbedding = await createEmbedding(query);
  
  const { data, error } = await supabase.rpc('match_chunks_improved', {
    query_embedding: queryEmbedding,
    top_k: 5,
    min_score: 0.3,
    manual: manual_id,
    tenant_id: tenant_id
  });

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}

// Generate AI response
async function generateResponse(query: string, context: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that helps technicians troubleshoot arcade game issues. 
          Use the provided manual content to answer questions accurately. 
          If you don't know something based on the manual content, say so.
          Keep your answers practical and focused on troubleshooting.`
        },
        {
          role: "user",
          content: `Manual content:\n${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }),
  });
  
  if (!response.ok) {
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

    console.log("🔍 Chat query:", query);

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
        }
      }
    }

    // Search for relevant chunks
    const chunks = await searchChunks(query, manual_id, tenant_id);
    console.log(`📚 Found ${chunks.length} relevant chunks`);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ 
        response: "I couldn't find any relevant information in the manual for your question. Please try rephrasing or ask about a different topic."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Combine chunk content for context
    const context = chunks.map((chunk: any) => chunk.content).join('\n\n');

    // Generate AI response
    const aiResponse = await generateResponse(query, context);

    console.log("🤖 Generated response");

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: chunks.map((chunk: any) => ({
        manual_id: chunk.manual_id,
        content: chunk.content.substring(0, 200) + "...",
        score: chunk.score
      }))
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});