import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔍 Extracting OCR for manual: ${manual_id}`);

    // Get all figures with raw_image_metadata.ocr but no ocr_text
    const { data: figures, error: fetchError } = await supabase
      .from('figures')
      .select('id, manual_id, page_number, llama_asset_name, raw_image_metadata')
      .eq('manual_id', manual_id)
      .is('ocr_text', null)
      .not('raw_image_metadata', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${figures?.length || 0} figures to process`);

    let processedCount = 0;
    let extractedCount = 0;
    const errors: string[] = [];

    for (const figure of figures || []) {
      try {
        const metadata = figure.raw_image_metadata as any;
        
        // Check if OCR data exists
        if (!metadata?.ocr || !Array.isArray(metadata.ocr) || metadata.ocr.length === 0) {
          console.log(`⏭️  Skipping ${figure.llama_asset_name} - no OCR data in metadata`);
          continue;
        }

        // Extract OCR text
        const extractedOcrText = metadata.ocr
          .map((item: any) => item.text)
          .filter(Boolean)
          .join(' ');

        // Calculate average confidence
        const confidences = metadata.ocr
          .map((item: any) => item.confidence)
          .filter((c: any) => typeof c === 'number');

        let extractedOcrConfidence = null;
        if (confidences.length > 0) {
          extractedOcrConfidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
        }

        console.log(`✅ Extracted OCR from ${figure.llama_asset_name}: ${extractedOcrText.substring(0, 50)}... (confidence: ${extractedOcrConfidence?.toFixed(4)})`);

        // Update figure with extracted OCR - use 'success' to match the constraint
        const { error: updateError } = await supabase
          .from('figures')
          .update({
            ocr_text: extractedOcrText,
            ocr_confidence: extractedOcrConfidence,
            ocr_status: 'success',
            ocr_updated_at: new Date().toISOString()
          })
          .eq('id', figure.id);

        if (updateError) {
          console.error(`❌ Error updating figure ${figure.id}:`, updateError);
          errors.push(`${figure.llama_asset_name}: ${updateError.message}`);
          continue;
        }

        extractedCount++;
      } catch (error) {
        console.error(`❌ Error processing figure ${figure.id}:`, error);
        errors.push(`${figure.llama_asset_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      processedCount++;
    }

    console.log(`✅ Processed ${processedCount} figures, extracted OCR from ${extractedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        manual_id,
        total_figures: figures?.length || 0,
        processed: processedCount,
        extracted: extractedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in extract-existing-ocr function:', error);
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
