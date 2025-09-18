import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const llamaCloudApiKey = Deno.env.get("LLAMACLOUD_API_KEY")!;

// Environment variable logging
console.log("🔑 Environment variables check:");
console.log(`SUPABASE_URL: ${supabaseUrl ? "✅ Present" : "❌ Missing"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "✅ Present" : "❌ Missing"}`);
console.log(`LLAMACLOUD_API_KEY: ${llamaCloudApiKey ? "✅ Present" : "❌ Missing"}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("Starting manual upload (multipart path)");
    const { title, storagePath } = await req.json();
    if (!title || !storagePath) throw new Error("Title and storagePath are required");

    const manual_id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    console.log(`manual_id: ${manual_id}`);

    // 1) Download the PDF bytes from Supabase Storage
    const { data: fileBlob, error: dlErr } = await supabase.storage.from("manuals").download(storagePath);
    if (dlErr || !fileBlob) throw new Error(`Download failed for ${storagePath}: ${dlErr?.message}`);

    // 2) Build your config (keep your choices)
    const config = {
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
      take_screenshot: false,
      is_formatting_instruction: true,
      premium_mode: false,
      continuous_mode: false,
      auto_mode: false,
      auto_mode_trigger_on_table_in_page: false,
      auto_mode_trigger_on_image_in_page: false,
      structured_output: false,
      max_pages: null,
      max_pages_enforced: null,
      extract_charts: true,
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
      markdown_table_multiline_header_separator: null,
    };

    // 3) Build multipart form (file + config + webhook + metadata)
    const form = new FormData();
    form.append(
      "file",
      new Blob([await fileBlob.arrayBuffer()], { type: "application/pdf" }),
      storagePath.split("/").pop() || "manual.pdf",
    );
    form.append("config", new Blob([JSON.stringify(config)], { type: "application/json" }), "config.json");
    form.append("webhook_url", `${supabaseUrl}/functions/v1/llama-webhook?manual_id=${encodeURIComponent(manual_id)}`);
    form.append("metadata", JSON.stringify({ manual_id, title, storage_path: storagePath }));

    // 4) Post to LlamaCloud
    const llamaRes = await fetch("https://api.cloud.llamaindex.ai/api/v1/parsing/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${llamaCloudApiKey}` },
      body: form, // don't set Content-Type manually
    });

    const llamaText = await llamaRes.text();
    console.log(`LlamaCloud: ${llamaRes.status} ${llamaRes.statusText}`, llamaText.slice(0, 4000));
    if (!llamaRes.ok) throw new Error(`LlamaCloud upload failed: ${llamaText}`);

    const result = JSON.parse(llamaText);

    // 5) Create initial document row
    const { error: docError } = await supabase.from("documents").insert({
      manual_id,
      title,
      source_filename: storagePath.split("/").pop() || "unknown.pdf",
      storage_path: storagePath,
      fec_tenant_id: "00000000-0000-0000-0000-000000000001",
      job_id: result.id ?? null,
    });
    if (docError) throw docError;

    return new Response(JSON.stringify({
      success: true,
      job_id: result.id,
      manual_id,
      message: "Upload started; processing will complete via webhook.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("upload-manual error:", error);
    return new Response(JSON.stringify({ error: error.message, details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
