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
    
    console.log(`📦 Image size: ${arrayBuffer.byteLength} bytes, base64 length: ${base64.length}`);

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
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    if (!openaiProjectId) {
      console.warn('⚠️ OPENAI_PROJECT_ID is not set - API call may fail');
    }
    
    console.log('🔑 Using OpenAI Project ID:', openaiProjectId ? 'SET' : 'NOT SET');
    
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
            content: `You are a technical documentation specialist. Create brief, accurate captions for arcade manual images.

Your captions should be:
- CONCISE (2-3 sentences maximum)
- Describe only what's actually visible
- Technically accurate but brief
- Focus on the primary purpose

Avoid lengthy explanations or troubleshooting guides - just describe what the image shows.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Provide a concise caption for this image from "${manual.title}".

Context:
- Page: ${figure.page_number || 'Unknown'}
${figure.ocr_text ? `- Text visible: ${figure.ocr_text}` : ''}

Keep the caption brief (2-3 sentences) - just describe what's shown and its main purpose.`
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
        max_completion_tokens: 2000  // Increased to allow for reasoning tokens + actual output
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, response.statusText);
      console.error('❌ Error details:', errorText);
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('✅ Vision analysis completed');
    console.log('📄 Full OpenAI response:', JSON.stringify(aiResponse, null, 2));

    // Check response structure
    if (!aiResponse.choices || aiResponse.choices.length === 0) {
      console.error('❌ No choices in OpenAI response');
      throw new Error('OpenAI returned no choices in response');
    }

    const caption = aiResponse.choices[0]?.message?.content;

    if (!caption) {
      console.error('❌ No caption in message:', JSON.stringify(aiResponse.choices[0], null, 2));
      throw new Error('No caption generated by AI - message.content is empty');
    }

    console.log('📝 Generated caption:', caption.substring(0, 100) + '...');

    // Update the figure in the database
    const { error: updateError } = await supabase
      .from('figures')
      .update({
        caption_text: caption,
        vision_text: caption
      })
      .eq('id', figure_id);

    if (updateError) {
      console.error('❌ Failed to update figure:', updateError);
      throw new Error(`Failed to save caption: ${updateError.message}`);
    }

    console.log('✅ Caption saved to database');

    return new Response(JSON.stringify({ 
      success: true, 
      caption,
      vision_analysis: caption,
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