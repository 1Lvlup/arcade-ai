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
                content: `You are an expert technical documentation analyzer. Extract comprehensive metadata from images.

Return JSON with these fields:
{
  "ocr_text": "all readable text...",
  "figure_type": "diagram|photo|table|chart|circuit|schematic|wiring_diagram|flowchart|exploded_view|illustration|mixed",
  "text_confidence": "high|medium|low|none",
  "detected_components": {
    "part_numbers": ["R12", "IC555", "J5"],
    "component_types": ["resistor", "capacitor", "connector", "IC"],
    "measurements": ["12V", "5A", "3.3kΩ"],
    "callout_labels": ["A", "B", "C"],
    "wire_colors": ["red", "black"],
    "connectors": ["J1", "P2"],
    "safety_symbols": ["warning", "high_voltage"]
  },
  "semantic_tags": ["electrical", "troubleshooting", "assembly"],
  "entities": {
    "part_numbers": ["555-TIMER-IC"],
    "model_numbers": ["XYZ-2000"],
    "measurements": ["12V DC", "500mA"]
  },
  "technical_complexity": "simple|moderate|complex",
  "image_quality": "sharp|acceptable|blurry|damaged",
  "has_table": boolean,
  "table_dimensions": "3x5 rows/cols" (if table),
  "language": "en|es|fr|multi",
  "notes": "any special observations"
}`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Analyze this technical image comprehensively. Extract ALL text, identify components, classify the image type, detect entities, and provide quality assessment.'
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
        const visionResult = JSON.parse(visionData.choices[0].message.content || '{}');
        const extractedText = visionResult.ocr_text?.trim() || '';
        const hasNoText = visionResult.text_confidence === 'none' || extractedText.length < 5;

        console.log(`📄 Extracted text (${extractedText.length} chars): ${extractedText.substring(0, 100)}...`);

        // Calculate quality score (0-1)
        const qualityScore = 
          visionResult.image_quality === 'sharp' ? 1.0 :
          visionResult.image_quality === 'acceptable' ? 0.75 :
          visionResult.image_quality === 'blurry' ? 0.5 : 0.25;

        // Generate embedding for the extracted text if we have meaningful text
        let embedding = null;
        if (!hasNoText && extractedText.length > 10) {
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

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.data[0].embedding;
            console.log(`🔢 Generated embedding`);
          }
        }

        // Update the figure with comprehensive metadata
        const { error: updateError } = await supabase
          .from('figures')
          .update({
            ocr_text: hasNoText ? null : extractedText,
            ocr_confidence: hasNoText ? null : (
              visionResult.text_confidence === 'high' ? 0.95 : 
              visionResult.text_confidence === 'medium' ? 0.75 : 0.50
            ),
            ocr_status: 'success',
            ocr_updated_at: new Date().toISOString(),
            
            // Comprehensive metadata from GPT-4 Vision
            figure_type: visionResult.figure_type,
            detected_components: visionResult.detected_components,
            semantic_tags: visionResult.semantic_tags || [],
            entities: visionResult.entities || {},
            quality_score: qualityScore,
            vision_metadata: {
              technical_complexity: visionResult.technical_complexity,
              image_quality: visionResult.image_quality,
              has_table: visionResult.has_table,
              table_dimensions: visionResult.table_dimensions,
              language: visionResult.language,
              notes: visionResult.notes,
              processed_at: new Date().toISOString(),
              processed_by: 'gpt-4.1-vision'
            },
            
            ...(embedding && !hasNoText ? { embedding_text: embedding } : {})
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
