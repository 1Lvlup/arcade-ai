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

    // Get tenant context
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const tenantId = profile.fec_tenant_id;
    await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId });

    const { manual, chunks, figures, qa } = await req.json();

    console.log(`📦 Starting structured import for: ${manual.title}`);

    // 1. Create manual in documents table
    const manualId = `${manual.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    const { error: docError } = await supabase
      .from('documents')
      .insert({
        manual_id: manualId,
        title: manual.title,
        source_filename: `${manual.title} ${manual.version}.pdf`,
        fec_tenant_id: tenantId
      });

    if (docError) throw docError;

    // 2. Create manual metadata
    const { error: metaError } = await supabase.rpc('upsert_manual_metadata', {
      p_metadata: {
        manual_id: manualId,
        canonical_title: manual.title,
        manufacturer: manual.vendor,
        version: manual.version,
        platform: manual.vendor,
        doc_type: 'service_manual',
        notes: manual.notes,
        upload_date: new Date().toISOString()
      }
    });

    if (metaError) throw metaError;

    // 3. Grant tenant access
    const { error: accessError } = await supabase
      .from('tenant_manual_access')
      .insert({
        fec_tenant_id: tenantId,
        manual_id: manualId,
        access_level: 'full'
      });

    if (accessError) throw accessError;

    let chunksCount = 0;
    let figuresCount = 0;
    let qaCount = 0;

    // 4. Import chunks with rich metadata
    if (chunks && chunks.length > 0) {
      for (const chunk of chunks) {
        // Parse arrays from PostgreSQL format {item1,item2}
        const parseArray = (str: string) => {
          if (!str || str === '{}') return [];
          return str.replace(/[{}]/g, '').split(',').filter(s => s.trim());
        };

        const metadata = {
          component: chunk.component || '',
          subcomponent: chunk.subcomponent || '',
          symptom: parseArray(chunk.symptom),
          action: parseArray(chunk.action),
          connectors: parseArray(chunk.connectors),
          voltages: parseArray(chunk.voltages),
          torque: parseArray(chunk.torque),
          figure_labels: parseArray(chunk.figure_labels),
          tags: parseArray(chunk.tags),
          game_title: manual.title,
          version: manual.version
        };

        const { error: chunkError } = await supabase
          .from('chunks_text')
          .insert({
            manual_id: manualId,
            content: chunk.content,
            page_start: parseInt(chunk.page_number) || null,
            page_end: parseInt(chunk.page_number) || null,
            menu_path: chunk.section_title || null,
            metadata,
            fec_tenant_id: tenantId
          });

        if (chunkError) {
          console.error('Chunk insert error:', chunkError);
        } else {
          chunksCount++;
        }
      }
    }

    // 5. Import figures
    if (figures && figures.length > 0) {
      for (const figure of figures) {
        const parseArray = (str: string) => {
          if (!str || str === '{}') return [];
          return str.replace(/[{}]/g, '').split(',').filter(s => s.trim());
        };

        const { error: figError } = await supabase
          .from('figures')
          .insert({
            manual_id: manualId,
            page_number: parseInt(figure.page_number) || null,
            figure_label: figure.figure_label || null,
            caption_text: figure.caption || null,
            component: figure.component || null,
            topics: parseArray(figure.topics),
            file_path: figure.file_path,
            ocr_text: figure.ocr_text || null,
            detected_components: figure.detected_components || {},
            storage_path: `${manualId}/${figure.file_path.split('/').pop()}`,
            fec_tenant_id: tenantId
          });

        if (figError) {
          console.error('Figure insert error:', figError);
        } else {
          figuresCount++;
        }
      }
    }

    // 6. Import QA pairs into golden_questions
    if (qa && qa.length > 0) {
      for (const pair of qa) {
        const parseArray = (str: string) => {
          if (!str || str === '{}') return [];
          return str.replace(/[{}]/g, '').split(',').filter(s => s.trim());
        };

        const { error: qaError } = await supabase
          .from('golden_questions')
          .insert({
            manual_id: manualId,
            question: pair.question,
            category: 'troubleshooting',
            question_type: 'technical',
            importance: 'high',
            expected_keywords: parseArray(pair.tags),
            explanation: pair.answer,
            fec_tenant_id: tenantId
          });

        if (qaError) {
          console.error('QA insert error:', qaError);
        } else {
          qaCount++;
        }
      }
    }

    console.log(`✅ Import complete: ${chunksCount} chunks, ${figuresCount} figures, ${qaCount} QA pairs`);
    
    // 7. Trigger OCR processing for all figures if any were imported
    if (figuresCount > 0) {
      console.log(`🔍 Triggering OCR processing for ${figuresCount} figures...`);
      
      // Invoke OCR processing in background (don't wait for it)
      supabase.functions.invoke('process-all-ocr', {
        body: { manual_id: manualId }
      }).then(({ data: ocrData, error: ocrError }) => {
        if (ocrError) {
          console.error('OCR trigger error:', ocrError);
        } else {
          console.log('✅ OCR processing started:', ocrData);
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        manual_id: manualId,
        chunks_count: chunksCount,
        figures_count: figuresCount,
        qa_count: qaCount,
        ocr_triggered: figuresCount > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
