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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 Resetting stuck OCR statuses for manual: ${manual_id}`);

    // Reset all figures that are stuck in 'processing' or 'failed' back to 'pending'
    const { data: resetData, error: resetError } = await supabase
      .from('figures')
      .update({ 
        ocr_status: 'pending',
        ocr_updated_at: new Date().toISOString()
      })
      .eq('manual_id', manual_id)
      .in('ocr_status', ['processing', 'failed'])
      .select();

    if (resetError) throw resetError;

    console.log(`✅ Reset ${resetData?.length || 0} figures to pending status`);

    return new Response(
      JSON.stringify({
        success: true,
        reset_count: resetData?.length || 0,
        message: `Reset ${resetData?.length || 0} figures to pending status`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
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
