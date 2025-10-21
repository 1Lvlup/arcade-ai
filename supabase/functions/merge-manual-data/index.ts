import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { source_manual_id, target_manual_id } = await req.json();

    console.log(`🔄 Merging manual ${source_manual_id} into ${target_manual_id}`);

    // Get tenant context
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const tenantId = profile.fec_tenant_id;

    let mergedChunks = 0;
    let mergedFigures = 0;
    let addedQA = 0;

    // 1. Merge chunks - deduplicate by content similarity
    console.log('📝 Merging text chunks...');
    const { data: sourceChunks } = await supabase
      .from('chunks_text')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    const { data: targetChunks } = await supabase
      .from('chunks_text')
      .select('id, content, page_start, page_end')
      .eq('manual_id', target_manual_id)
      .eq('fec_tenant_id', tenantId);

    for (const sourceChunk of sourceChunks || []) {
      // Check if similar chunk exists (same page range or similar content)
      const isDuplicate = targetChunks?.some(tc => 
        (tc.page_start === sourceChunk.page_start && tc.page_end === sourceChunk.page_end) ||
        (tc.content === sourceChunk.content)
      );

      if (!isDuplicate) {
        // Insert new chunk with target manual_id
        await supabase
          .from('chunks_text')
          .insert({
            ...sourceChunk,
            id: undefined,
            manual_id: target_manual_id,
            created_at: undefined,
          });
        mergedChunks++;
      } else {
        // Update existing chunk with richer metadata if source has more
        const existingChunk = targetChunks?.find(tc => 
          tc.page_start === sourceChunk.page_start && tc.page_end === sourceChunk.page_end
        );
        
        if (existingChunk && sourceChunk.metadata && Object.keys(sourceChunk.metadata).length > 0) {
          await supabase
            .from('chunks_text')
            .update({
              metadata: {
                ...(existingChunk.metadata || {}),
                ...sourceChunk.metadata
              }
            })
            .eq('id', existingChunk.id);
        }
      }
    }

    // 2. Merge figures - combine metadata for same page/label
    console.log('🖼️  Merging figures...');
    const { data: sourceFigures } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    const { data: targetFigures } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', target_manual_id)
      .eq('fec_tenant_id', tenantId);

    for (const sourceFigure of sourceFigures || []) {
      // Find matching figure by page and label
      const matchingFigure = targetFigures?.find(tf =>
        tf.page_number === sourceFigure.page_number &&
        (tf.figure_label === sourceFigure.figure_label || 
         tf.storage_path === sourceFigure.storage_path)
      );

      if (matchingFigure) {
        // Merge metadata
        await supabase
          .from('figures')
          .update({
            caption_text: sourceFigure.caption_text || matchingFigure.caption_text,
            component: sourceFigure.component || matchingFigure.component,
            topics: sourceFigure.topics || matchingFigure.topics,
            detected_components: {
              ...(matchingFigure.detected_components || {}),
              ...(sourceFigure.detected_components || {})
            },
            keywords: Array.from(new Set([
              ...(matchingFigure.keywords || []),
              ...(sourceFigure.keywords || [])
            ])),
            vision_metadata: {
              ...(matchingFigure.vision_metadata || {}),
              ...(sourceFigure.vision_metadata || {}),
              merged_from_csv: true
            }
          })
          .eq('id', matchingFigure.id);
        mergedFigures++;
      } else if (sourceFigure.storage_path) {
        // Add new figure
        await supabase
          .from('figures')
          .insert({
            ...sourceFigure,
            id: undefined,
            manual_id: target_manual_id,
            created_at: undefined,
          });
        mergedFigures++;
      }
    }

    // 3. Add QA pairs (unlikely to have duplicates)
    console.log('❓ Adding QA pairs...');
    const { data: sourceQA } = await supabase
      .from('golden_questions')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    for (const qa of sourceQA || []) {
      // Check for duplicate questions
      const { data: existing } = await supabase
        .from('golden_questions')
        .select('id')
        .eq('manual_id', target_manual_id)
        .eq('question', qa.question)
        .eq('fec_tenant_id', tenantId)
        .single();

      if (!existing) {
        await supabase
          .from('golden_questions')
          .insert({
            ...qa,
            id: undefined,
            manual_id: target_manual_id,
            created_at: undefined,
            updated_at: undefined,
          });
        addedQA++;
      }
    }

    // 4. Enrich target manual metadata
    console.log('📋 Enriching manual metadata...');
    const { data: sourceMeta } = await supabase
      .from('manual_metadata')
      .select('*')
      .eq('manual_id', source_manual_id)
      .single();

    const { data: targetMeta } = await supabase
      .from('manual_metadata')
      .select('*')
      .eq('manual_id', target_manual_id)
      .single();

    if (sourceMeta && targetMeta) {
      await supabase
        .from('manual_metadata')
        .update({
          manufacturer: sourceMeta.manufacturer || targetMeta.manufacturer,
          version: sourceMeta.version || targetMeta.version,
          platform: sourceMeta.platform || targetMeta.platform,
          notes: [targetMeta.notes, sourceMeta.notes].filter(Boolean).join('\n\n'),
          tags: Array.from(new Set([
            ...(targetMeta.tags || []),
            ...(sourceMeta.tags || [])
          ])),
          aliases: Array.from(new Set([
            ...(targetMeta.aliases || []),
            ...(sourceMeta.aliases || [])
          ]))
        })
        .eq('manual_id', target_manual_id);
    }

    // 5. Optionally delete source manual if merge is complete
    console.log('🗑️  Cleaning up source manual (optional)...');
    // Uncomment to delete source after merge:
    // await supabase.from('documents').delete().eq('manual_id', source_manual_id);
    // await supabase.from('chunks_text').delete().eq('manual_id', source_manual_id);
    // await supabase.from('figures').delete().eq('manual_id', source_manual_id);
    // await supabase.from('golden_questions').delete().eq('manual_id', source_manual_id);
    // await supabase.from('manual_metadata').delete().eq('manual_id', source_manual_id);

    console.log(`✅ Merge complete!`);
    
    return new Response(
      JSON.stringify({
        success: true,
        source_manual_id,
        target_manual_id,
        merged_chunks: mergedChunks,
        merged_figures: mergedFigures,
        added_qa: addedQA,
        message: 'Manual data merged successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Merge error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
