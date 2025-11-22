import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { messages, codebaseContext } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Initialize Supabase client to fetch AI config
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's tenant from auth header
    const authHeader = req.headers.get('authorization');
    let tenantId = '00000000-0000-0000-0000-000000000001'; // Default tenant
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fec_tenant_id')
          .eq('user_id', user.id)
          .single();
          
        if (profile?.fec_tenant_id) {
          tenantId = profile.fec_tenant_id;
        }
      }
    }

    // Fetch configured model from ai_config
    const { data: modelConfig } = await supabase
      .from('ai_config')
      .select('config_value')
      .eq('config_key', 'code_assistant_model')
      .eq('fec_tenant_id', tenantId)
      .single();

    const model = (modelConfig?.config_value as string) || 'gpt-5-mini-2025-08-07';
    console.log(`🤖 Using Code Assistant model: ${model} for tenant: ${tenantId}`);

    // Limit codebase context to ~200k characters (~50k tokens) to stay within model limits
    const MAX_CONTEXT_CHARS = 200000;
    let limitedContext = codebaseContext || 'No specific context provided';
    
    if (limitedContext.length > MAX_CONTEXT_CHARS) {
      console.log(`⚠️ Codebase context truncated from ${limitedContext.length} to ${MAX_CONTEXT_CHARS} chars`);
      limitedContext = limitedContext.substring(0, MAX_CONTEXT_CHARS) + '\n\n[... context truncated due to size limits. Consider loading fewer files for better results.]';
    }

    const systemPrompt = `You are an expert React/TypeScript coding assistant helping with a Supabase-powered web application.

CODEBASE CONTEXT:
${limitedContext}

YOUR CAPABILITIES:
- Analyze existing code and suggest improvements
- Generate new React components with TypeScript
- Help debug issues and fix errors
- Suggest best practices for React, Supabase, and TypeScript
- Create edge functions for backend logic
- Help with database queries and RLS policies

CRITICAL RESPONSE FORMAT:
You MUST follow this exact format when providing code suggestions:

1. For creating or modifying files, use this EXACT format:
📄 **File: \`path/to/file.tsx\`** [CREATE] or [EDIT]
\`\`\`typescript
// Full file content or code changes
\`\`\`

2. For multiple code blocks, separate them clearly:
📄 **File: \`src/components/Component.tsx\`** [CREATE]
\`\`\`typescript
// Component code
\`\`\`

📄 **File: \`src/hooks/useHook.tsx\`** [CREATE]
\`\`\`typescript
// Hook code
\`\`\`

3. For explanations without code, just write normally.

4. Always specify:
   - Full file path (e.g., src/components/MyComponent.tsx)
   - Action type: [CREATE] for new files, [EDIT] for modifications
   - The language after \`\`\` (typescript, tsx, javascript, css, etc.)

Be concise but thorough. Focus on practical, working solutions.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_output_tokens: 16000,
        store: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait a moment and try again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Parse error message for better user feedback
      let userMessage = `AI API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          userMessage = errorData.error.message;
        }
      } catch {
        // Use default message if parsing fails
      }
      
      return new Response(JSON.stringify({ 
        error: userMessage 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('📦 Raw API Response:', JSON.stringify(data, null, 2));
    
    // Check for incomplete response
    if (data.status === 'incomplete') {
      console.warn('⚠️ Response incomplete:', data.incomplete_details?.reason);
    }
    
    // Parse Responses API format - look for message-type output
    let assistantMessage = '';
    
    try {
      // Try different response structures
      if (typeof data === 'string') {
        assistantMessage = data;
      } else if (data.output_text) {
        assistantMessage = data.output_text;
      } else if (data.output) {
        if (Array.isArray(data.output) && data.output.length > 0) {
          // Look specifically for message-type output (not reasoning)
          const messageOutput = data.output.find((item: any) => item.type === 'message');
          if (messageOutput) {
            assistantMessage = messageOutput.output_text || messageOutput.content || messageOutput.text || '';
          } else {
            // Fallback: try first output if no message type found
            const firstOutput = data.output[0];
            assistantMessage = firstOutput.output_text || firstOutput.content || firstOutput.text || '';
          }
        } else if (typeof data.output === 'string') {
          assistantMessage = data.output;
        }
      } else if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        // Fallback to Chat Completions format
        const choice = data.choices[0];
        assistantMessage = choice.message?.content || choice.text || '';
      } else if (data.message?.content) {
        assistantMessage = data.message.content;
      }
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError);
      console.error('📦 Response data:', JSON.stringify(data, null, 2));
    }
    
    if (!assistantMessage || assistantMessage.trim() === '') {
      console.error('❌ Could not extract message from response');
      console.error('📦 Response structure:', JSON.stringify(data, null, 2));
      throw new Error('AI response was empty or in unexpected format');
    }
    
    console.log('✅ Successfully extracted message, length:', assistantMessage.length);

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-code-assistant:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
