import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { figure_id, storage_path, manual_id } = await req.json();
    console.log('🖼️ Generating caption for figure:', figure_id);

    if (!figure_id || !storage_path || !manual_id) {
      throw new Error('Figure ID, storage path, and manual ID are required');
    }
    
    // Download the image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('postparse')
      .download(storage_path);
    
    if (downloadError || !imageData) {
      throw new Error(`Failed to download image: ${downloadError?.message}`);
    }

    // Convert blob to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const image_url = `data:image/png;base64,${base64}`;

    // Get user context for RLS
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    
    if (!user) {
      throw new Error('Invalid user');
    }

    // Get user's FEC tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('fec_tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id });

    // Get manual context
    const { data: manual, error: manualError } = await supabase
      .from('documents')
      .select('title, source_filename')
      .eq('manual_id', manual_id)
      .single();

    if (manualError || !manual) {
      throw new Error('Manual not found');
    }

    // Get figure details including any existing OCR text
    const { data: figure, error: figureError } = await supabase
      .from('figures')
      .select('figure_id, page_number, ocr_text, keywords')
      .eq('id', figure_id)
      .single();

    if (figureError || !figure) {
      throw new Error('Figure not found');
    }

    console.log('👁️ Analyzing image with GPT-4 Vision...');

    // Use GPT-4o Vision to analyze the image
    const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Project': openaiProjectId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an expert technical documentation analyst specializing in arcade game manuals. Your task is to create detailed, accurate captions for images from technical manuals.

For each image, provide:
1. A clear, descriptive caption that explains what the image shows
2. Technical analysis focusing on components, connections, or procedures visible
3. Context about how this image relates to troubleshooting or maintenance

Your captions should be:
- Technically accurate and specific
- Helpful for troubleshooting purposes
- Clear and professional
- Focused on actionable information

If the image shows electronic components, wiring, or mechanical parts, be specific about what's visible and how it relates to the arcade system.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image from an arcade game manual and provide a detailed technical caption.

CONTEXT:
- Manual: ${manual.title} (${manual.source_filename})
- Figure ID: ${figure.figure_id}
- Page: ${figure.page_number || 'Unknown'}
${figure.ocr_text ? `- Text in image: ${figure.ocr_text}` : ''}
${figure.keywords ? `- Keywords: ${figure.keywords.join(', ')}` : ''}

Please provide a detailed caption that would help technicians understand what they're looking at and how it relates to troubleshooting or maintenance.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: image_url
                }
              }
            ]
          }
        ],
        max_completion_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Vision API error:', response.status, errorText);
      throw new Error(`OpenAI Vision API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('✅ Vision analysis completed');

    const caption = aiResponse.choices[0].message.content;

    if (!caption) {
      throw new Error('No caption generated by AI');
    }

    console.log('📝 Generated caption:', caption.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      success: true, 
      caption,
      vision_analysis: caption, // Store full analysis in vision_text field
      figure_id,
      manual_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error generating image caption:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});