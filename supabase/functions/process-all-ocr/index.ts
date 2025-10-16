import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Processing OCR for all images in manual: ${manual_id}`);

    // Get all figures with pending OCR status (includes both missing OCR and explicitly pending)
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, manual_id, page_number, llama_asset_name, storage_path, ocr_status')
      .eq('manual_id', manual_id)
      .eq('ocr_status', 'pending')
      .not('storage_path', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${figures?.length || 0} figures with pending OCR status`);

    let processedCount = 0;
    let successCount = 0;
    const errors: string[] = [];

    for (const figure of figures || []) {
      try {
        console.log(`\n🖼️  Processing figure ${processedCount + 1}/${figures.length}: ${figure.llama_asset_name}`);
        
        // Update status to processing
        await supabase
          .from('figures')
          .update({ ocr_status: 'processing' })
          .eq('id', figure.id);

        // Download image from storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('postparse')
          .download(figure.storage_path);

        if (downloadError) {
          throw new Error(`Download failed: ${downloadError.message}`);
        }

        // Convert to base64
        const arrayBuffer = await imageData.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        console.log(`📦 Image downloaded: ${arrayBuffer.byteLength} bytes`);

        // Call GPT-4 Vision for OCR
        console.log(`👁️  Calling GPT-4 Vision for OCR...`);
        const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            ...(openaiProjectId ? { 'OpenAI-Project': openaiProjectId } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            max_completion_tokens: 2000,
            messages: [
              {
                role: 'system',
                content: 'You are an OCR expert. Extract ALL text visible in the image with high accuracy. Preserve formatting, tables, and structure. Return ONLY the extracted text, nothing else.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract all text from this image. Include everything you can read - labels, numbers, part names, table contents, diagrams text, etc. Preserve the structure and layout as much as possible.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`,
                      detail: 'high'
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!visionResponse.ok) {
          const errorText = await visionResponse.text();
          throw new Error(`Vision API error: ${visionResponse.status} - ${errorText}`);
        }

        const visionData = await visionResponse.json();
        const extractedText = visionData.choices[0].message.content?.trim() || '';

        console.log(`📄 Extracted text (${extractedText.length} chars): ${extractedText.substring(0, 100)}...`);

        // Generate embedding for the OCR text
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            ...(openaiProjectId ? { 'OpenAI-Project': openaiProjectId } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: extractedText,
          }),
        });

        let embedding = null;
        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.data[0].embedding;
          console.log(`🔢 Generated embedding`);
        }

        // Update figure with OCR text and mark as completed
        const { error: updateError } = await supabase
          .from('figures')
          .update({
            ocr_text: extractedText,
            ocr_confidence: null, // GPT-4 Vision doesn't provide confidence scores
            ocr_status: 'completed', // Changed from 'success' to 'completed'
            ocr_updated_at: new Date().toISOString(),
            ...(embedding ? { embedding_text: embedding } : {})
          })
          .eq('id', figure.id);

        if (updateError) {
          console.error(`❌ Error updating figure ${figure.id}:`, updateError);
          errors.push(`${figure.llama_asset_name}: ${updateError.message}`);
          continue;
        }

        console.log(`✅ Successfully processed ${figure.llama_asset_name}`);
        successCount++;
        
        // Update processing_status with progress
        if (processedCount % 5 === 0) {
          const { data: statusData } = await supabase
            .from('processing_status')
            .select('total_figures')
            .eq('manual_id', manual_id)
            .single();
          
          const totalFigures = statusData?.total_figures || figures.length;
          const progressPercent = 90 + Math.round((successCount / totalFigures) * 10);
          
          await supabase
            .from('processing_status')
            .update({
              figures_processed: successCount,
              progress_percent: Math.min(progressPercent, 99), // Keep at 99 until fully done
              current_task: `Processing OCR: ${successCount}/${totalFigures} figures completed`
            })
            .eq('manual_id', manual_id);
        }

      } catch (error) {
        console.error(`❌ Error processing figure ${figure.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('figures')
          .update({
            ocr_status: 'failed',
            ocr_error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', figure.id);
          
        errors.push(`${figure.llama_asset_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      processedCount++;
      
      // Add a small delay to avoid rate limits
      if (processedCount % 10 === 0) {
        console.log(`⏸️  Processed ${processedCount} images, pausing briefly...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Processing complete: ${successCount}/${processedCount} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        manual_id,
        total_figures: figures?.length || 0,
        processed: processedCount,
        successful: successCount,
        failed: processedCount - successCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-all-ocr function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
