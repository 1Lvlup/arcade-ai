import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry text processing for a manual that had incomplete processing
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { manual_id } = await req.json();
    
    if (!manual_id) {
      throw new Error('manual_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 Retrying text processing for manual: ${manual_id}`);

    // Get the document and check if we have the job_id to re-fetch from LlamaCloud
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('manual_id', manual_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${manual_id}`);
    }

    console.log(`📄 Found document: ${doc.title}, Job ID: ${doc.job_id}`);

    // Check current chunk count
    const { count: currentChunks } = await supabase
      .from('chunks_text')
      .select('*', { count: 'exact' })
      .eq('manual_id', manual_id);

    console.log(`📊 Current chunks: ${currentChunks || 0}`);

    if (currentChunks && currentChunks > 0) {
      return new Response(JSON.stringify({ 
        message: `Manual ${manual_id} already has ${currentChunks} text chunks`,
        chunks_count: currentChunks 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to re-fetch the completed job from LlamaCloud
    const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    if (!llamaApiKey || !doc.job_id) {
      throw new Error('Cannot retry - missing LlamaCloud API key or job ID');
    }

    console.log(`🦙 Fetching completed job from LlamaCloud: ${doc.job_id}`);
    
    const jobResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${doc.job_id}`, {
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!jobResponse.ok) {
      throw new Error(`Failed to fetch job: ${jobResponse.status} ${jobResponse.statusText}`);
    }

    const jobData = await jobResponse.json();
    console.log(`📋 Job status: ${jobData.status}`);

    if (jobData.status !== 'SUCCESS') {
      throw new Error(`Job not completed: ${jobData.status}`);
    }

    // Fetch the result
    const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${doc.job_id}/result/json`, {
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`,
      },
    });

    if (!resultResponse.ok) {
      throw new Error(`Failed to fetch result: ${resultResponse.status}`);
    }

    const payload = await resultResponse.json();
    console.log(`📦 Retrieved payload with JSON pages: ${payload.pages?.length || 0}`);

    // Set tenant context
    let tenantId = '00000000-0000-0000-0000-000000000001'; // default
    
    // Try to get the tenant from the document's fec_tenant_id
    if (doc.fec_tenant_id) {
      tenantId = doc.fec_tenant_id;
    }
    
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    // Extract chunks using the same logic as the webhook
    let chunks: any[] = [];
    
    if (payload.pages && Array.isArray(payload.pages)) {
      chunks = extractSemanticChunks(payload.pages);
      console.log(`✨ Extracted ${chunks.length} semantic chunks from JSON`);
    }

    if (chunks.length === 0 && payload.markdown) {
      chunks = extractChunksFromMarkdown(payload.markdown);
      console.log(`📝 Fallback: Extracted ${chunks.length} chunks from markdown`);
    }

    // Create embeddings and insert chunks
    let processedChunks = 0;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (chunks.length > 0 && openaiApiKey) {
      console.log(`🔄 Processing ${chunks.length} chunks with embeddings...`);
      
      for (const chunk of chunks) {
        try {
          // Create embedding
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: chunk.content,
            }),
          });

          if (!embeddingResponse.ok) {
            throw new Error(`Embedding failed: ${embeddingResponse.status}`);
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Insert chunk
          const { error: insertError } = await supabase
            .from('chunks_text')
            .insert({
              manual_id,
              page_start: chunk.page_start || null,
              page_end: chunk.page_end || null,
              menu_path: chunk.menu_path || null,
              content: chunk.content,
              embedding,
              fec_tenant_id: tenantId,
            });

          if (insertError) {
            console.error('❌ Chunk insert error:', insertError);
          } else {
            processedChunks++;
            if (processedChunks % 10 === 0) {
              console.log(`📈 Processed ${processedChunks}/${chunks.length} chunks`);
            }
          }
        } catch (error) {
          console.error('❌ Chunk processing error:', error);
        }
      }
    } else {
      console.warn('⚠️ No chunks extracted or OpenAI API key missing');
    }

    // Update processing status
    await supabase
      .from('processing_status')
      .update({
        chunks_processed: processedChunks,
        total_chunks: chunks.length,
        status: processedChunks > 0 ? 'completed' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('manual_id', manual_id);

    console.log(`✅ Text processing retry completed: ${processedChunks}/${chunks.length} chunks`);

    return new Response(JSON.stringify({ 
      message: `Successfully processed ${processedChunks} text chunks for ${manual_id}`,
      chunks_processed: processedChunks,
      total_chunks: chunks.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Retry text processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions (copied from webhook)
function extractSemanticChunks(jsonData: any[]): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];

  for (const page of jsonData) {
    if (!page.blocks || !Array.isArray(page.blocks)) continue;

    let currentSection = "";
    let currentSubsection = "";
    let currentContent = "";
    const pageNum = page.page || null;

    for (const block of page.blocks) {
      if (block.type === 'heading') {
        // Save previous content
        if (currentContent.trim()) {
          chunks.push({
            content: currentContent.trim(),
            page_start: pageNum,
            page_end: pageNum,
            menu_path: [currentSection, currentSubsection].filter(Boolean).join(' > '),
          });
          currentContent = "";
        }

        const headingText = block.text || '';
        if (block.level <= 2) {
          currentSection = headingText;
          currentSubsection = "";
        } else {
          currentSubsection = headingText;
        }
      } else if (block.type === 'text' && block.text) {
        currentContent += block.text + "\n";
      }
    }

    // Save remaining content
    if (currentContent.trim()) {
      chunks.push({
        content: currentContent.trim(),
        page_start: pageNum,
        page_end: pageNum,
        menu_path: [currentSection, currentSubsection].filter(Boolean).join(' > '),
      });
    }
  }

  return chunks;
}

function extractChunksFromMarkdown(markdown: string): Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> {
  const chunks: Array<{content: string; page_start?: number; page_end?: number; menu_path?: string}> = [];
  const lines = markdown.split('\n');
  
  let currentContent = '';
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('#')) {
      // Save previous chunk
      if (currentContent.trim()) {
        chunks.push({
          content: currentContent.trim(),
          menu_path: currentSection,
        });
        currentContent = '';
      }
      
      currentSection = line.replace(/^#+\s*/, '');
    } else {
      currentContent += line + '\n';
    }
  }
  
  // Save final chunk
  if (currentContent.trim()) {
    chunks.push({
      content: currentContent.trim(),
      menu_path: currentSection,
    });
  }
  
  return chunks;
}