import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { manualId } = await req.json();

    if (!manualId) {
      return new Response(
        JSON.stringify({ error: 'manualId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Exporting chunks for manual:', manualId);

    // Fetch all chunks for this manual from chunks_text table
    const { data: chunks, error } = await supabase
      .from('chunks_text')
      .select('*')
      .eq('manual_id', manualId)
      .order('page_start', { ascending: true });

    if (error) {
      console.error('Error fetching chunks:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${chunks?.length || 0} chunks`);

    // Format chunks for export (remove embedding vectors to keep file size manageable)
    const exportData = {
      manual_id: manualId,
      exported_at: new Date().toISOString(),
      total_chunks: chunks?.length || 0,
      chunks: chunks?.map(chunk => ({
        id: chunk.id,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        section_path: chunk.section_path,
        text: chunk.text,
        features: chunk.features,
        created_at: chunk.created_at,
      })) || []
    };

    return new Response(
      JSON.stringify(exportData, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="chunks-${manualId}.json"`
        } 
      }
    );
  } catch (error) {
    console.error('Error in export-chunks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

