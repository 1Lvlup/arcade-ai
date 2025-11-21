import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const systemPrompt = `You are an expert React/TypeScript coding assistant helping with a Supabase-powered web application.

CODEBASE CONTEXT:
${codebaseContext || 'No specific context provided'}

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait a moment and try again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

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
