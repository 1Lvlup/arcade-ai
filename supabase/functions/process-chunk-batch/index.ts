import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BATCH_SIZE = Number(Deno.env.get('CHUNK_BATCH_SIZE') ?? 30);
const MAX_CONCURRENCY = 5;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

interface QueueItem {
  id: string;
  chunk_id: string;
  content: string;
  manual_id: string;
  chunk_index: number;
  token_count: number;
  content_hash: string;
  metadata?: {
    page_start?: number;
    page_end?: number;
    menu_path?: string;
    chunk_type?: string;
    section_heading?: string;
    quality_score?: number;
    doc_id?: string;
    start_char?: number;
    end_char?: number;
    source_filename?: string;
  };
}

interface ProcessResult {
  processed: number;
  failed: number;
  remaining: number;
}

// Create embedding using OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${openaiApiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: text.substring(0, 8000)
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Process a single chunk
async function processChunk(chunk: QueueItem, tenantId: string): Promise<void> {
  console.log(`📝 Processing chunk ${chunk.chunk_index} for manual ${chunk.manual_id}`);
  
  // Extract metadata from queue item
  const meta = chunk.metadata || {};
  
  // Generate embedding
  const embedding = await createEmbedding(chunk.content);
  
  // Build enriched metadata
  const chunkMetadata = {
    chunk_type: meta.chunk_type || 'content',
    chunk_strategy: 'hierarchical',
    chunk_index: chunk.chunk_index,
    chunk_length: chunk.content.length,
    word_count: chunk.token_count,
    has_tables: /[\|<].*[\|>]|^\s*\|/m.test(chunk.content),
    has_lists: /^\s*[-*•]\s+/m.test(chunk.content) || /^\s*\d+\.\s+/m.test(chunk.content),
    has_code_numbers: /\b\d{3,}\b|\b[A-Z]{2,}\d+\b/.test(chunk.content),
    section_type: meta.menu_path?.toLowerCase().includes('troubleshoot') ? 'troubleshooting' :
                 meta.menu_path?.toLowerCase().includes('parts') ? 'parts_list' :
                 meta.menu_path?.toLowerCase().includes('specification') ? 'specifications' :
                 meta.menu_path?.toLowerCase().includes('installation') ? 'installation' :
                 meta.menu_path?.toLowerCase().includes('maintenance') ? 'maintenance' :
                 meta.menu_path?.toLowerCase().includes('warranty') ? 'warranty' : 'general'
  };
  
  // Upsert into chunks_text with full metadata
  const { error } = await supabase
    .from('chunks_text')
    .upsert({
      manual_id: chunk.manual_id,
      chunk_id: chunk.chunk_id,
      content: chunk.content,
      content_hash: chunk.content_hash,
      embedding: embedding,
      embedding_model: 'text-embedding-3-small',
      fec_tenant_id: tenantId,
      metadata: chunkMetadata,
      page_start: meta.page_start,
      page_end: meta.page_end,
      menu_path: meta.menu_path,
      doc_id: meta.doc_id || chunk.manual_id,
      doc_version: 'v1',
      start_char: meta.start_char || 0,
      end_char: meta.end_char || chunk.content.length,
      section_heading: meta.section_heading,
      quality_score: meta.quality_score || 0.8,
      human_reviewed: false,
      usage_count: 0,
      source_filename: meta.source_filename,
      ingest_date: new Date().toISOString()
    }, { 
      onConflict: 'manual_id,content_hash',
      ignoreDuplicates: false 
    });
  
  if (error) {
    throw new Error(`Failed to upsert chunk: ${error.message}`);
  }
  
  // Mark as done in queue
  await supabase
    .from('manual_chunk_queue')
    .update({ 
      status: 'done', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', chunk.id);
}

// Process a chunk with retry handling
async function processChunkWithRetry(chunk: QueueItem, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await processChunk(chunk, tenantId);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Chunk ${chunk.id} failed:`, errorMsg);
    
    // Mark as failed and increment retry count
    await supabase.rpc('manual_chunk_queue_increment_retry', { p_queue_id: chunk.id });
    await supabase
      .from('manual_chunk_queue')
      .update({ 
        status: 'failed', 
        error: errorMsg,
        updated_at: new Date().toISOString() 
      })
      .eq('id', chunk.id);
    
    return { success: false, error: errorMsg };
  }
}

// Queue next batch processing
function queueNextBatch(manualId: string): void {
  const url = `${supabaseUrl}/functions/v1/process-chunk-batch`;
  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
  const body = JSON.stringify({ manualId });
  
  // Fire and forget
  fetch(url, { method: 'POST', headers, body })
    .catch(err => console.error('Failed to queue next batch:', err));
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { manualId } = await req.json();
    
    if (!manualId) {
      return new Response(JSON.stringify({ error: 'manualId required' }), { status: 400 });
    }

    console.log(`🎯 Processing batch for manual: ${manualId}`);

    // Get tenant ID from documents table
    const { data: doc } = await supabase
      .from('documents')
      .select('fec_tenant_id')
      .eq('manual_id', manualId)
      .single();
    
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 });
    }
    
    const tenantId = doc.fec_tenant_id;

    // Lock a batch of pending chunks
    const { data: pending, error: lockError } = await supabase.rpc(
      'manual_chunk_queue_lock_batch',
      { p_manual_id: manualId, p_limit: BATCH_SIZE }
    );

    if (lockError) {
      console.error('Failed to lock batch:', lockError);
      await supabase
        .from('manual_processing_jobs')
        .update({ 
          status: 'failed', 
          last_error: lockError.message,
          updated_at: new Date().toISOString() 
        })
        .eq('manual_id', manualId);
      return new Response(JSON.stringify({ error: 'Failed to lock batch' }), { status: 500 });
    }

    // If no pending chunks, mark job as complete
    if (!pending || pending.length === 0) {
      console.log(`✅ No more pending chunks for ${manualId}`);
      await supabase
        .from('manual_processing_jobs')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString() 
        })
        .eq('manual_id', manualId);
      return new Response(JSON.stringify({ done: true }), { status: 200 });
    }

    console.log(`📦 Processing ${pending.length} chunks`);

    // Update job status to running
    await supabase
      .from('manual_processing_jobs')
      .update({ 
        status: 'running', 
        updated_at: new Date().toISOString() 
      })
      .eq('manual_id', manualId);

    // Process chunks with controlled concurrency
    const results: Array<{ success: boolean; error?: string }> = [];
    
    // Simple concurrency control using Promise.all with slicing
    for (let i = 0; i < pending.length; i += MAX_CONCURRENCY) {
      const batch = pending.slice(i, i + MAX_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(chunk => processChunkWithRetry(chunk, tenantId))
      );
      results.push(...batchResults);
    }

    // Calculate stats
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📊 Batch complete: ${succeeded} succeeded, ${failed} failed`);

    // Update processed count
    if (succeeded > 0) {
      await supabase.rpc('increment_processed_chunks', {
        p_manual_id: manualId,
        p_increment: succeeded
      });
    }

    // Check for remaining work
    const { count: remainingCount } = await supabase
      .from('manual_chunk_queue')
      .select('id', { count: 'exact', head: true })
      .eq('manual_id', manualId)
      .eq('status', 'pending');

    console.log(`📋 Remaining chunks: ${remainingCount || 0}`);

    // Queue next batch if work remains
    if (remainingCount && remainingCount > 0) {
      queueNextBatch(manualId);
      console.log(`🔄 Queued next batch for ${manualId}`);
    } else if (failed === 0) {
      // All done and no failures
      await supabase
        .from('manual_processing_jobs')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString() 
        })
        .eq('manual_id', manualId);
      console.log(`🎉 Job complete for ${manualId}`);
    }

    const result: ProcessResult = {
      processed: succeeded,
      failed: failed,
      remaining: remainingCount || 0
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
