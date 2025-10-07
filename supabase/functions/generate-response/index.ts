/**
 * @deprecated This function provides generic OpenAI chat without RAG context.
 * 
 * For manual-based Q&A, use the `chat-manual` function with RAG_PIPELINE_V2 instead,
 * which provides:
 * - Hybrid retrieval with Cohere reranking
 * - 3-stage pipeline (draft → expert → review)
 * - Proper citations and source tracking
 * - Quality grading
 * 
 * This function may still be used for:
 * - Simple chat UI interactions (greetings, small talk)
 * - Generic text generation without manual context
 * - Legacy integrations that don't need RAG
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const openaiProjectId = Deno.env.get('OPENAI_PROJECT_ID');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 [GENERATE] Function invoked:', {
      timestamp: new Date().toISOString()
    });

    if (!openaiApiKey) {
      console.error('❌ [GENERATE] OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    console.log('✅ [GENERATE] OpenAI API key found');

    const requestBody = await req.json();
    const { system_prompt, user_message } = requestBody;
    
    console.log('📝 [GENERATE] Request parsed:', {
      has_system_prompt: !!system_prompt,
      system_prompt_length: system_prompt?.length || 0,
      user_message_length: user_message?.length || 0,
      user_message_preview: user_message?.slice(0, 100) + (user_message?.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });

    if (!user_message) {
      console.error('❌ [GENERATE] User message is required');
      throw new Error('User message is required');
    }

    // Use GPT-5 mini as default for this generic function
    const requestPayload: any = {
      model: 'gpt-5-mini',
      messages: [
        ...(system_prompt ? [{ role: 'system', content: system_prompt }] : []),
        { role: 'user', content: user_message }
      ],
      max_completion_tokens: 1000,
    };

    console.log('📤 [GENERATE] Calling OpenAI API:', {
      model: requestPayload.model,
      messages_count: requestPayload.messages.length,
      max_tokens: requestPayload.max_tokens,
      temperature: requestPayload.temperature,
      timestamp: new Date().toISOString()
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        ...(openaiProjectId && { 'OpenAI-Project': openaiProjectId }),
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('📥 [GENERATE] OpenAI API response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      timestamp: new Date().toISOString()
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ [GENERATE] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        timestamp: new Date().toISOString()
      });
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedResponse = data.choices[0].message.content;

    console.log('✅ [GENERATE] Response generated successfully:', {
      response_length: generatedResponse?.length || 0,
      response_preview: generatedResponse?.slice(0, 100) + (generatedResponse?.length > 100 ? '...' : ''),
      usage: data.usage,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({ response: generatedResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-response function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});