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

// Simple embedding function
async function createEmbedding(text: string) {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input 
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Simple chunking function
function chunkMarkdown(markdown: string): Array<{content: string}> {
  const chunks: Array<{content: string}> = [];
  
  // Split by headers and create chunks
  const sections = markdown.split(/^#{1,3}\s+(.+)$/gm);
  
  for (let i = 1; i < sections.length; i += 2) {
    const title = sections[i];
    const content = sections[i + 1]?.trim();
    
    if (content && content.length > 50) {
      chunks.push({
        content: `${title}\n\n${content}`
      });
    }
  }
  
  // If no headers found, split by paragraphs
  if (chunks.length === 0) {
    const paragraphs = markdown.split('\n\n').filter(p => p.trim().length > 50);
    paragraphs.forEach(paragraph => {
      chunks.push({ content: paragraph });
    });
  }
  
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔄 Webhook called");

  try {
    const body = await req.json();
    console.log("📥 Body keys:", Object.keys(body));

    // Get job_id from webhook
    const job_id = body.jobId || body.job_id;
    if (!job_id) {
      throw new Error("No job_id in webhook");
    }

    console.log("📋 Processing job:", job_id);

    // Find the document by job_id
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("job_id", job_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found for job ${job_id}`);
    }

    console.log("📄 Found document:", doc.manual_id);

    // Set tenant context
    await supabase.rpc('set_tenant_context', { tenant_id: doc.fec_tenant_id });

    // Get markdown content from webhook or fetch it
    let markdown = body.md || body.markdown;
    
    if (!markdown && job_id) {
      console.log("🔄 Fetching content from LlamaCloud");
      const llamaApiKey = Deno.env.get("LLAMACLOUD_API_KEY");
      if (llamaApiKey) {
        const resp = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${job_id}/result/markdown`, {
          headers: { "Authorization": `Bearer ${llamaApiKey}` }
        });
        if (resp.ok) {
          markdown = await resp.text();
        }
      }
    }

    if (!markdown) {
      throw new Error("No markdown content found");
    }

    console.log("📝 Processing markdown content");

    // Chunk the content
    const chunks = chunkMarkdown(markdown);
    console.log(`📚 Created ${chunks.length} chunks`);

    // Process chunks with embeddings
    let processedCount = 0;
    for (const chunk of chunks) {
      try {
        const embedding = await createEmbedding(chunk.content);
        
        await supabase.from("chunks_text").insert({
          manual_id: doc.manual_id,
          content: chunk.content,
          embedding,
          fec_tenant_id: doc.fec_tenant_id,
        });
        
        processedCount++;
        console.log(`✅ Processed chunk ${processedCount}/${chunks.length}`);
      } catch (error) {
        console.error(`❌ Failed to process chunk ${processedCount + 1}:`, error);
      }
    }

    console.log(`🎉 Completed processing: ${processedCount} chunks saved`);

    return new Response(JSON.stringify({ 
      success: true, 
      chunks_processed: processedCount,
      manual_id: doc.manual_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});