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

    const { manual_id } = await req.json();
    console.log('🧠 Generating golden questions for manual:', manual_id);

    if (!manual_id) {
      throw new Error('Manual ID is required');
    }

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

    // Get manual information
    const { data: manual, error: manualError } = await supabase
      .from('documents')
      .select('title, source_filename')
      .eq('manual_id', manual_id)
      .single();

    if (manualError || !manual) {
      throw new Error('Manual not found');
    }

    // Get a sample of chunks for context
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks_text')
      .select('content, menu_path')
      .eq('manual_id', manual_id)
      .limit(10);

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
      throw new Error('Failed to fetch manual content');
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No content found for this manual');
    }

    // Prepare content for AI analysis
    const contentSample = chunks
      .map(chunk => `Section: ${chunk.menu_path || 'General'}\nContent: ${chunk.content}`)
      .join('\n\n---\n\n');

    console.log('📝 Analyzing content with AI...');

    // Generate golden questions using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert technical documentation analyst. Your task is to generate "Golden Questions" - the most valuable, frequently needed questions that users would ask about this arcade game manual.

Golden Questions should be:
1. Practical and actionable
2. Cover the most common troubleshooting scenarios
3. Address setup and maintenance procedures
4. Include safety and specification inquiries
5. Be specific to this particular manual

Focus on questions that would save users time and provide immediate value. Categorize each question and assign importance level.

Return your response as a JSON array with this structure:
[
  {
    "question": "How do I reset the game when it freezes during gameplay?",
    "category": "troubleshooting",
    "importance": "high"
  }
]

Categories should be: troubleshooting, setup, maintenance, safety, specifications
Importance levels: high, medium, low`
          },
          {
            role: 'user',
            content: `Generate 8-12 golden questions for this arcade game manual:

MANUAL: ${manual.title} (${manual.source_filename})

CONTENT SAMPLE:
${contentSample.substring(0, 4000)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('✅ AI response received');

    let questions;
    try {
      questions = JSON.parse(aiResponse.choices[0].message.content);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    if (!Array.isArray(questions)) {
      throw new Error('Invalid AI response format');
    }

    console.log(`📋 Generated ${questions.length} golden questions`);

    // TODO: Store questions in database when golden_questions table is created
    // For now, return the questions
    
    return new Response(JSON.stringify({ 
      success: true, 
      questions,
      manual_id,
      count: questions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error generating golden questions:', error);
    
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