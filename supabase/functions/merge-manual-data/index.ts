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

    if (!source_manual_id || !target_manual_id) {
      throw new Error('Both source_manual_id and target_manual_id are required');
    }

    if (source_manual_id === target_manual_id) {
      throw new Error('Source and target cannot be the same manual');
    }

    console.log(`🔄 Starting merge: ${source_manual_id} -> ${target_manual_id}`);

    // Get tenant context
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const tenantId = profile.fec_tenant_id;

    // Verify both manuals exist
    const { data: sourceManual, error: sourceError } = await supabase
      .from('manual_metadata')
      .select('manual_id, canonical_title')
      .eq('manual_id', source_manual_id)
      .single();

    const { data: targetManual, error: targetError } = await supabase
      .from('manual_metadata')
      .select('manual_id, canonical_title')
      .eq('manual_id', target_manual_id)
      .single();

    if (sourceError || !sourceManual) {
      throw new Error(`Source manual "${source_manual_id}" not found`);
    }

    if (targetError || !targetManual) {
      throw new Error(`Target manual "${target_manual_id}" not found`);
    }

    // Tenant access is validated through chunks_text and figures queries below

    console.log(`📚 Merging "${sourceManual.canonical_title}" into "${targetManual.canonical_title}"`);

    let mergedChunks = 0;
    let skippedChunkDuplicates = 0;
    let mergedFigures = 0;
    let updatedFigures = 0;
    let skippedFigureDuplicates = 0;
    let addedQA = 0;
    let skippedQADuplicates = 0;

    // 1. MERGE TEXT CHUNKS - Enhanced deduplication
    console.log('📝 Merging text chunks...');
    const { data: sourceChunks, error: sourceChunksError } = await supabase
      .from('chunks_text')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    if (sourceChunksError) {
      console.error('Error fetching source chunks:', sourceChunksError);
      throw new Error('Failed to fetch source chunks');
    }

    const { data: targetChunks, error: targetChunksError } = await supabase
      .from('chunks_text')
      .select('id, content, page_start, page_end, menu_path, metadata')
      .eq('manual_id', target_manual_id)
      .eq('fec_tenant_id', tenantId);

    if (targetChunksError) {
      console.error('Error fetching target chunks:', targetChunksError);
      throw new Error('Failed to fetch target chunks');
    }

    console.log(`  Source: ${sourceChunks?.length || 0} chunks | Target: ${targetChunks?.length || 0} chunks`);

    for (const chunk of sourceChunks || []) {
      // Enhanced duplicate detection
      const isDuplicate = targetChunks?.some((tc) => {
        // Exact content match
        const exactMatch = tc.content.trim() === chunk.content.trim();
        
        // Page range overlap with similar content
        const pageOverlap = chunk.page_start && tc.page_start &&
                             chunk.page_end && tc.page_end &&
                             !(chunk.page_end < tc.page_start || chunk.page_start > tc.page_end);
        
        const contentStartSimilar = tc.content.substring(0, 200).trim() === 
                                     chunk.content.substring(0, 200).trim();
        
        return exactMatch || (pageOverlap && contentStartSimilar);
      });

      if (!isDuplicate) {
        const { error } = await supabase
          .from('chunks_text')
          .insert({
            manual_id: target_manual_id,
            fec_tenant_id: tenantId,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            menu_path: chunk.menu_path,
            embedding: chunk.embedding,
            metadata: { ...(chunk.metadata || {}), merged_from: source_manual_id },
            tags: chunk.tags,
          });

        if (error) {
          console.error('Error inserting chunk:', error);
        } else {
          mergedChunks++;
        }
      } else {
        // Update existing chunk with richer metadata if source has more
        const existingChunk = targetChunks?.find(tc => 
          tc.content.trim() === chunk.content.trim() ||
          (tc.page_start === chunk.page_start && tc.page_end === chunk.page_end)
        );
        
        if (existingChunk && chunk.metadata && Object.keys(chunk.metadata).length > 0) {
          await supabase
            .from('chunks_text')
            .update({
              metadata: {
                ...(existingChunk.metadata || {}),
                ...(chunk.metadata || {}),
                enriched_from: source_manual_id
              }
            })
            .eq('id', existingChunk.id);
        }
        skippedChunkDuplicates++;
      }
    }

    console.log(`  ✓ Added ${mergedChunks} new chunks, skipped ${skippedChunkDuplicates} duplicates`);

    // 2. MERGE FIGURES - Enhanced with storage path handling
    console.log('🖼️  Merging figures...');
    const { data: sourceFigures, error: sourceFiguresError } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    if (sourceFiguresError) {
      console.error('Error fetching source figures:', sourceFiguresError);
      throw new Error('Failed to fetch source figures');
    }

    const { data: targetFigures, error: targetFiguresError } = await supabase
      .from('figures')
      .select('*')
      .eq('manual_id', target_manual_id)
      .eq('fec_tenant_id', tenantId);

    if (targetFiguresError) {
      console.error('Error fetching target figures:', targetFiguresError);
      throw new Error('Failed to fetch target figures');
    }

    console.log(`  Source: ${sourceFigures?.length || 0} figures | Target: ${targetFigures?.length || 0} figures`);

    for (const fig of sourceFigures || []) {
      // Enhanced matching by page, label, and storage path
      const matchingFig = targetFigures?.find((tf) => {
        const pageMatch = tf.page_number === fig.page_number;
        const labelMatch = tf.figure_label && fig.figure_label && 
                            tf.figure_label === fig.figure_label;
        const pathSimilar = tf.storage_path && fig.storage_path &&
                             (tf.storage_path === fig.storage_path ||
                              tf.storage_path.split('/').pop() === fig.storage_path.split('/').pop());
        
        return pageMatch && (labelMatch || pathSimilar);
      });

      if (matchingFig) {
        // Merge/enrich existing figure if source has better data
        const needsUpdate = (fig.ocr_text && !matchingFig.ocr_text) ||
                             (fig.caption_text && !matchingFig.caption_text) ||
                             (fig.component && !matchingFig.component) ||
                             (fig.detected_components && Object.keys(fig.detected_components || {}).length > 0);

        if (needsUpdate) {
          const { error } = await supabase
            .from('figures')
            .update({
              caption_text: fig.caption_text || matchingFig.caption_text,
              ocr_text: fig.ocr_text || matchingFig.ocr_text,
              component: fig.component || matchingFig.component,
              topics: fig.topics || matchingFig.topics,
              detected_components: {
                ...(matchingFig.detected_components || {}),
                ...(fig.detected_components || {})
              },
              keywords: Array.from(new Set([
                ...(matchingFig.keywords || []),
                ...(fig.keywords || [])
              ])),
              vision_metadata: {
                ...(matchingFig.vision_metadata || {}),
                ...(fig.vision_metadata || {}),
                merged_from_csv: true
              },
              ocr_status: fig.ocr_text ? 'success' : matchingFig.ocr_status,
            })
            .eq('id', matchingFig.id);

          if (!error) {
            updatedFigures++;
          } else {
            console.error('Error updating figure:', error);
          }
        } else {
          skippedFigureDuplicates++;
        }
      } else if (fig.storage_path) {
        // Insert new figure
        const { error } = await supabase
          .from('figures')
          .insert({
            manual_id: target_manual_id,
            fec_tenant_id: tenantId,
            page_number: fig.page_number,
            figure_label: fig.figure_label,
            storage_path: fig.storage_path,
            caption_text: fig.caption_text,
            ocr_text: fig.ocr_text,
            component: fig.component,
            topics: fig.topics,
            detected_components: fig.detected_components,
            keywords: fig.keywords,
            vision_metadata: { ...(fig.vision_metadata || {}), merged_from: source_manual_id },
            bounding_box: fig.bounding_box,
            ocr_status: fig.ocr_status || 'pending',
          });

        if (error) {
          console.error('Error inserting figure:', error);
        } else {
          mergedFigures++;
        }
      }
    }

    console.log(`  ✓ Added ${mergedFigures} new, updated ${updatedFigures}, skipped ${skippedFigureDuplicates} duplicates`);

    // 3. ADD QA PAIRS - Check both manual_qa and golden_questions tables
    console.log('❓ Adding QA pairs...');
    
    // Try manual_qa first
    const { data: sourceQA_manual, error: qaError1 } = await supabase
      .from('manual_qa')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    // Try golden_questions as fallback
    const { data: sourceQA_golden, error: qaError2 } = await supabase
      .from('golden_questions')
      .select('*')
      .eq('manual_id', source_manual_id)
      .eq('fec_tenant_id', tenantId);

    const sourceQA = sourceQA_manual || sourceQA_golden || [];
    const qaTable = sourceQA_manual ? 'manual_qa' : 'golden_questions';

    console.log(`  Source: ${sourceQA.length} QA pairs from ${qaTable}`);

    const { data: targetQA } = await supabase
      .from(qaTable)
      .select('question')
      .eq('manual_id', target_manual_id)
      .eq('fec_tenant_id', tenantId);

    const existingQuestions = new Set(
      targetQA?.map((q) => q.question.toLowerCase().trim().replace(/[^\w\s]/g, '')) || []
    );

    for (const qa of sourceQA) {
      const normalizedQuestion = qa.question.toLowerCase().trim().replace(/[^\w\s]/g, '');
      
      if (!existingQuestions.has(normalizedQuestion)) {
        const { error } = await supabase
          .from(qaTable)
          .insert({
            ...qa,
            id: undefined,
            manual_id: target_manual_id,
            created_at: undefined,
            updated_at: undefined,
          });

        if (error) {
          console.error('Error inserting QA pair:', error);
        } else {
          addedQA++;
          existingQuestions.add(normalizedQuestion);
        }
      } else {
        skippedQADuplicates++;
      }
    }

    console.log(`  ✓ Added ${addedQA} new pairs, skipped ${skippedQADuplicates} duplicates`);

    // 4. ENRICH MANUAL METADATA
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
      const mergedTags = Array.from(new Set([...(targetMeta.tags || []), ...(sourceMeta.tags || [])]));
      const mergedAliases = Array.from(new Set([...(targetMeta.aliases || []), ...(sourceMeta.aliases || [])]));
      const maxPageCount = Math.max(sourceMeta.page_count || 0, targetMeta.page_count || 0);
      const mergedNotes = [targetMeta.notes, `Merged from ${source_manual_id}`, sourceMeta.notes]
        .filter(Boolean)
        .join('\n\n');

      await supabase
        .from('manual_metadata')
        .update({
          manufacturer: sourceMeta.manufacturer || targetMeta.manufacturer,
          version: sourceMeta.version || targetMeta.version,
          platform: sourceMeta.platform || targetMeta.platform,
          tags: mergedTags,
          aliases: mergedAliases,
          page_count: maxPageCount,
          notes: mergedNotes,
          quality_score: Math.max(sourceMeta.quality_score || 0, targetMeta.quality_score || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('manual_id', target_manual_id);

      console.log('  ✓ Metadata enriched successfully');
    }

    const result = {
      success: true,
      source_manual_id,
      source_manual_title: sourceManual.canonical_title,
      target_manual_id,
      target_manual_title: targetManual.canonical_title,
      merged_chunks: mergedChunks,
      skipped_chunk_duplicates: skippedChunkDuplicates,
      merged_figures: mergedFigures,
      updated_figures: updatedFigures,
      skipped_figure_duplicates: skippedFigureDuplicates,
      added_qa: addedQA,
      skipped_qa_duplicates: skippedQADuplicates,
      total_items_merged: mergedChunks + mergedFigures + updatedFigures + addedQA,
      message: 'Manual data merged successfully'
    };

    console.log('✅ Merge complete:', result);
    
    return new Response(
      JSON.stringify(result),
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
