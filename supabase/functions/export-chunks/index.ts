import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Collapse "H Y P E R  B O W L I N G", "H\n * Y\n * P\n * E\n * R", and mixed cases into normal words. */
function collapseSpacedLetters(s: string) {
  // join single letters separated by spaces: H Y P E R → HYPER
  s = s.replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ""));

  // join single letters separated by newlines: H\nY\nP\nE\nR → HYPER
  s = s.replace(/\b(?:[A-Z]\s*(?:\r?\n|\r)\s*){2,}[A-Z]\b/g, (m) =>
    m.replace(/[\s\r\n]+/g, "")
  );

  // handle mixed case/accidentally spaced words like i n s t a l l a t i o n
  s = s.replace(/\b([a-z])(?:\s+([a-z])){3,}\b/g, (m) => m.replace(/\s+/g, ""));

  return s;
}

/** Final pass that removes page marks, HTML comments, duplicates and squashes whitespace. */
function normalizeGist(raw: string) {
  let s = String(raw ?? "");

  // Remove HTML comments like <!-- Page 4 End --> etc.
  s = s.replace(/<!--[\s\S]{0,500}?-->/g, " ");

  // Remove pure page headers/footers like "Page 12", "Page II", "#" etc., but
  // DO NOT remove the word "page" in normal sentences.
  s = s.replace(/\bPage\s+(?:[0-9IVX]+)\b/gi, " ");
  s = s.replace(/^\s*#\s*Page\s+[0-9IVX]+\s*$/gim, " ");

  // Remove P/N and REV lines only when they actually look like codes
  s = s.replace(/\bP\/N\s*[:#]?\s*[A-Z0-9\-\.]{3,}\b/gi, " ");
  s = s.replace(/\bREV\.?\s*[A-Z]?(?:,\s*)?\d{1,2}\/\d{2}\b/gi, " ");

  // Turn hard line breaks into spaces early so we can collapse letter-per-line
  s = s.replace(/[\r\n]+/g, " ");

  // Now fix the spaced-letter artifacts
  s = collapseSpacedLetters(s);

  // Kill leftover "single-letter parade" runs (>=5 letters): H Y P E R … → HYPER
  s = s.replace(
    /\b(?:[A-Za-z]\s+){4,}[A-Za-z]\b/g,
    (m) => m.replace(/\s+/g, "")
  );

  // Un-hyphenate line-break splits like "elec-\ntronics"
  s = s.replace(/(\w)[-–]\s+(\w)/g, "$1$2");

  // Collapse excessive spacing
  s = s.replace(/[·•●▪︎◦_]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

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
        menu_path: chunk.menu_path,
        content: normalizeGist(chunk.content),
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

