import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const llamaCloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting manual upload process');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    
    if (!file || !title) {
      throw new Error('File and title are required');
    }

    // Generate manual_id as slug
    const manual_id = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    console.log(`Processing manual: ${title} with ID: ${manual_id}`);

    // Convert file to base64 for LlamaCloud
    const fileBuffer = await file.arrayBuffer();
    
    // Convert to base64 using chunk-based approach to avoid stack overflow
    const uint8Array = new Uint8Array(fileBuffer);
    const chunkSize = 8192; // Process in 8KB chunks
    let binaryString = '';
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Content = btoa(binaryString);

    // LlamaCloud parse configuration matching your setup
    const parseConfig = {
      parsing_instruction: "",
      disable_ocr: false,
      annotate_links: false,
      adaptive_long_table: true,
      compact_markdown_table: false,
      disable_reconstruction: false,
      disable_image_extraction: false,
      invalidate_cache: false,
      outlined_table_extraction: true,
      merge_tables_across_pages_in_markdown: true,
      output_pdf_of_document: false,
      do_not_cache: false,
      fast_mode: false,
      skip_diagonal_text: false,
      preserve_layout_alignment_across_pages: false,
      preserve_very_small_text: true,
      gpt4o_mode: false,
      do_not_unroll_columns: false,
      extract_layout: true,
      high_res_ocr: true,
      html_make_all_elements_visible: false,
      layout_aware: true,
      specialized_chart_parsing_agentic: false,
      specialized_chart_parsing_plus: false,
      specialized_chart_parsing_efficient: false,
      specialized_image_parsing: true,
      precise_bounding_box: true,
      html_remove_navigation_elements: false,
      html_remove_fixed_elements: true,
      guess_xlsx_sheet_name: false,
      page_separator: null,
      bounding_box: null,
      bbox_top: null,
      bbox_right: null,
      bbox_bottom: null,
      bbox_left: null,
      target_pages: null,
      use_vendor_multimodal_model: false,
      vendor_multimodal_model_name: null,
      model: null,
      vendor_multimodal_api_key: null,
      page_prefix: null,
      page_suffix: null,
      webhook_url: `${supabaseUrl}/functions/v1/llama-webhook`,
      preset: null,
      take_screenshot: false,
      is_formatting_instruction: true,
      premium_mode: false,
      continuous_mode: false,
      input_s3_path: null,
      input_s3_region: null,
      output_s3_path_prefix: null,
      output_s3_region: null,
      project_id: null,
      azure_openai_deployment_name: null,
      azure_openai_endpoint: null,
      azure_openai_api_version: null,
      azure_openai_key: null,
      input_url: null,
      http_proxy: null,
      auto_mode: false,
      auto_mode_trigger_on_regexp_in_page: null,
      auto_mode_trigger_on_text_in_page: null,
      auto_mode_trigger_on_table_in_page: false,
      auto_mode_trigger_on_image_in_page: false,
      auto_mode_configuration_json: null,
      structured_output: false,
      structured_output_json_schema: null,
      structured_output_json_schema_name: null,
      max_pages: null,
      max_pages_enforced: null,
      extract_charts: true,
      formatting_instruction: null,
      complemental_formatting_instruction: null,
      content_guideline_instruction: null,
      spreadsheet_extract_sub_tables: false,
      spreadsheet_force_formula_computation: false,
      inline_images_in_markdown: false,
      job_timeout_in_seconds: null,
      job_timeout_extra_time_per_page_in_seconds: null,
      strict_mode_image_extraction: false,
      strict_mode_image_ocr: true,
      strict_mode_reconstruction: false,
      strict_mode_buggy_font: false,
      save_images: true,
      hide_headers: true,
      hide_footers: true,
      page_header_prefix: null,
      page_header_suffix: null,
      page_footer_prefix: null,
      page_footer_suffix: null,
      ignore_document_elements_for_layout_detection: false,
      output_tables_as_HTML: false,
      internal_is_screenshot_job: false,
      parse_mode: "parse_document_with_agent",
      system_prompt: null,
      system_prompt_append: `Output policy (strict, do not ignore):

Merge titles with their body. If an element is just a heading (e.g., "Main Menu", "Diagnostics"), merge it with the immediately following paragraph/list/table so the chunk is semantically whole.

Deduplicate repeated headings on the same page. Keep the longest variant (the one with the body).

Omit recurring legal boilerplate. Include it once; otherwise drop it.

Normalize tables/menus from images into clean text lists: Label: Value or bullets. Drop stray layout characters.

No title-only chunks. Every chunk must contain explanatory content, not just a section name.

Keep all technical values (fuse ratings, voltages, menu defaults) verbatim.

For every image/diagram/figure, also emit a structured FIGURE block (in the output stream next to normal text):
FIGURE:
- page_number: <int>
- figure_id: <stable id like MANUAL-<page>-<index>>
- figure_title: <if present>
- caption_text: <exact caption>
- ocr_text: <OCR from inside the image>
- callouts: [{"label":"1", "text":"coil mount bracket"}, ...]
- image_url: <TEMP asset URL provided by this job>
- bbox_pdf_coords: <optional normalized [x1,y1,x2,y2]>`,
      user_prompt: `This is an arcade game operator's manual. Prioritize fidelity for:
1) Fuse charts/power specs/dimensions (keep as tables).
2) Diagnostic/System menus (capture full path like "Main Menu > Diagnostics > Light Tests"; keep options one per line).
3) Troubleshooting tables (Problem | Possible Cause | Solution).
4) Parts/assembly drawings & callouts (item #, part #, description, qty; include figure notes).
For menu screenshots and wiring diagrams, transcribe every visible label/value. For figures, emit the FIGURE block with OCR and callouts.`,
      page_error_tolerance: 0.05,
      replace_failed_page_mode: "raw_text",
      replace_failed_page_with_error_message_prefix: null,
      replace_failed_page_with_error_message_suffix: null,
      markdown_table_multiline_header_separator: null
    };

    // Submit to LlamaCloud
    const llamaResponse = await fetch('https://api.cloud.llamaindex.ai/api/v1/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llamaCloudApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64_content: base64Content,
        filename: file.name,
        ...parseConfig,
        // Add manual_id as metadata if supported
        metadata: { manual_id, title }
      }),
    });

    if (!llamaResponse.ok) {
      const errorText = await llamaResponse.text();
      console.error('LlamaCloud error:', errorText);
      throw new Error(`LlamaCloud upload failed: ${errorText}`);
    }

    const result = await llamaResponse.json();
    console.log('LlamaCloud job submitted:', result);

    // Create initial document record
    const { error: docError } = await supabase
      .from('documents')
      .insert({
        manual_id,
        title,
        source_filename: file.name,
        fec_tenant_id: '00000000-0000-0000-0000-000000000001'
      });

    if (docError) {
      console.error('Error creating document record:', docError);
      throw docError;
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: result.id,
      manual_id,
      message: 'Manual upload started. Processing will complete via webhook.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upload-manual function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});