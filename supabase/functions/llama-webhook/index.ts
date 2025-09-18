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
const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!;
const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
const awsRegion = Deno.env.get('AWS_REGION')!;
const s3Bucket = Deno.env.get('S3_BUCKET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// S3 utilities
async function uploadToS3(buffer: Uint8Array, key: string, contentType = "image/png"): Promise<string> {
  const url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  
  // Create AWS signature
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'x-amz-date': time,
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.statusText}`);
  }

  return `s3://${s3Bucket}/${key}`;
}

// Create embeddings using OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: input
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Chunk text into manageable pieces
function chunkText(text: string, chunkSize = 600, overlap = 100): Array<{content: string, page_start?: number, page_end?: number, menu_path?: string}> {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let currentPageStart: number | undefined;
  let currentPageEnd: number | undefined;
  let currentMenuPath: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect page markers
    const pageMatch = line.match(/Page (\d+)/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1]);
      if (!currentPageStart) currentPageStart = pageNum;
      currentPageEnd = pageNum;
    }

    // Detect menu paths
    if (line.includes(' > ') && line.length < 100) {
      currentMenuPath = line.trim();
    }

    currentChunk += line + '\n';

    // Check if we should create a chunk
    if (currentChunk.length >= chunkSize || i === lines.length - 1) {
      if (currentChunk.trim().length > 50) { // Only create chunks with meaningful content
        chunks.push({
          content: currentChunk.trim(),
          page_start: currentPageStart,
          page_end: currentPageEnd,
          menu_path: currentMenuPath
        });
      }

      // Prepare next chunk with overlap
      if (i < lines.length - 1) {
        const overlapLines = lines.slice(Math.max(0, i - Math.floor(overlap / 20)), i + 1);
        currentChunk = overlapLines.join('\n') + '\n';
      } else {
        currentChunk = '';
      }
    }
  }

  return chunks;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('LlamaCloud webhook received');
    
    const payload = await req.json();
    console.log('Webhook payload status:', payload.status);

    if (payload.status !== 'SUCCESS') {
      console.error('LlamaCloud job failed:', payload);
      return new Response(JSON.stringify({ error: 'Job failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text_markdown, figures } = payload;
    const manual_id = payload.metadata?.manual_id;

    if (!manual_id) {
      throw new Error('No manual_id in payload metadata');
    }

    console.log(`Processing results for manual: ${manual_id}`);
    console.log(`Text length: ${text_markdown?.length || 0}, Figures: ${figures?.length || 0}`);

    // Process figures first - download images and upload to S3
    const processedFigures = [];
    if (figures && figures.length > 0) {
      for (const figure of figures) {
        try {
          console.log(`Processing figure: ${figure.figure_id}`);
          
          // Download image from LlamaCloud temp URL
          const imageResponse = await fetch(figure.image_url);
          if (!imageResponse.ok) {
            console.warn(`Failed to download figure ${figure.figure_id}: ${imageResponse.statusText}`);
            continue;
          }

          const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
          
          // Upload to S3
          const s3Key = `manuals/${manual_id}/${figure.figure_id}.png`;
          const s3Uri = await uploadToS3(imageBuffer, s3Key, 'image/png');
          
          // Create embedding for figure content
          const figureContent = [
            figure.caption_text || '',
            figure.ocr_text || '',
            JSON.stringify(figure.callouts || [])
          ].filter(Boolean).join('\n');

          const embedding = figureContent.length > 10 ? await createEmbedding(figureContent) : null;

          // Store figure in database
          const { error: figureError } = await supabase
            .from('figures')
            .insert({
              manual_id,
              page_number: figure.page_number,
              figure_id: figure.figure_id,
              image_url: s3Uri,
              caption_text: figure.caption_text,
              ocr_text: figure.ocr_text,
              callouts_json: figure.callouts,
              bbox_pdf_coords: figure.bbox_pdf_coords,
              embedding_text: embedding,
              fec_tenant_id: '00000000-0000-0000-0000-000000000001'
            });

          if (figureError) {
            console.error(`Error storing figure ${figure.figure_id}:`, figureError);
          } else {
            processedFigures.push(figure.figure_id);
          }

        } catch (error) {
          console.error(`Error processing figure ${figure.figure_id}:`, error);
        }
      }
    }

    // Process text content - chunk and create embeddings
    let processedChunks = 0;
    if (text_markdown && text_markdown.length > 0) {
      const chunks = chunkText(text_markdown);
      console.log(`Created ${chunks.length} text chunks`);

      for (const chunk of chunks) {
        try {
          const embedding = await createEmbedding(chunk.content);

          const { error: chunkError } = await supabase
            .from('chunks_text')
            .insert({
              manual_id,
              page_start: chunk.page_start,
              page_end: chunk.page_end,
              menu_path: chunk.menu_path,
              content: chunk.content,
              embedding,
              fec_tenant_id: '00000000-0000-0000-0000-000000000001'
            });

          if (chunkError) {
            console.error('Error storing chunk:', chunkError);
          } else {
            processedChunks++;
          }

        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      }
    }

    // Update document status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id);

    if (updateError) {
      console.error('Error updating document:', updateError);
    }

    console.log(`Processing complete for ${manual_id}: ${processedChunks} chunks, ${processedFigures.length} figures`);

    return new Response(JSON.stringify({
      success: true,
      manual_id,
      processed_chunks: processedChunks,
      processed_figures: processedFigures.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in llama-webhook function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});