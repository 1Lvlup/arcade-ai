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

// Helper to get AI config
async function getModelConfig(supabase: any, tenant_id: string) {
  await supabase.rpc('set_tenant_context', { tenant_id });
  
  const { data: config } = await supabase
    .from('ai_config')
    .select('config_value')
    .eq('config_key', 'chat_model')
    .single();
  
  let model = 'gpt-5-2025-08-07'; // Default
  if (config?.config_value) {
    const value = config.config_value;
    // If it's already a string and looks like a model name, use it directly
    if (typeof value === 'string' && (value.startsWith('gpt-') || value.startsWith('claude-'))) {
      model = value;
    } else if (typeof value === 'string') {
      // Try to parse JSON-stringified values
      try {
        model = JSON.parse(value);
      } catch {
        model = value;
      }
    } else {
      model = value;
    }
  }
  
  const isGpt5 = model.includes('gpt-5');
  
  return {
    model,
    maxTokensParam: isGpt5 ? 'max_completion_tokens' : 'max_tokens',
    supportsTemperature: !isGpt5
  };
}

// Build structured summary from LlamaCloud parsed data
function buildStructuredSummary(
  manual: { title: string; source_filename: string },
  chunks: Array<{ content: string; menu_path: string | null; page_start: number | null; page_end: number | null }>,
  figures: Array<{ caption_text: string | null; keywords: string[] | null; page_number: number | null; vision_text: string | null }>
): string {
  const sections: string[] = [];

  // Manual metadata
  sections.push(`# MANUAL METADATA`);
  sections.push(`Title: ${manual.title}`);
  sections.push(`Source: ${manual.source_filename}`);
  sections.push(`Total Pages: ${Math.max(...chunks.map(c => c.page_end || 0))}`);
  sections.push('');

  // Extract unique section hierarchy
  const menuPaths = new Set<string>();
  chunks.forEach(chunk => {
    if (chunk.menu_path) {
      menuPaths.add(chunk.menu_path);
    }
  });

  sections.push(`# TABLE OF CONTENTS (${menuPaths.size} sections)`);
  Array.from(menuPaths)
    .sort()
    .forEach(path => sections.push(`  • ${path}`));
  sections.push('');

  // Figure captions and keywords
  if (figures.length > 0) {
    sections.push(`# FIGURES AND DIAGRAMS (${figures.length} total)`);
    figures.slice(0, 20).forEach((fig, idx) => {
      if (fig.caption_text || fig.keywords?.length) {
        sections.push(`Figure ${idx + 1} (Page ${fig.page_number}):`);
        if (fig.caption_text) sections.push(`  Caption: ${fig.caption_text}`);
        if (fig.keywords?.length) sections.push(`  Keywords: ${fig.keywords.join(', ')}`);
        if (fig.vision_text) sections.push(`  Description: ${fig.vision_text.substring(0, 150)}...`);
      }
    });
    sections.push('');
  }

  // Extract tables from content (look for table-like patterns)
  const tableChunks = chunks.filter(c => 
    c.content.toLowerCase().includes('table') || 
    c.content.includes('|') && c.content.split('|').length > 5
  );
  
  if (tableChunks.length > 0) {
    sections.push(`# TABLES AND SPECIFICATIONS (${tableChunks.length} found)`);
    tableChunks.slice(0, 5).forEach(chunk => {
      const preview = chunk.content.substring(0, 200).replace(/\n/g, ' ');
      sections.push(`  • ${chunk.menu_path || 'General'}: ${preview}...`);
    });
    sections.push('');
  }

  // Sample content from key sections
  sections.push(`# CONTENT SAMPLES`);
  const keywordSections = ['troubleshooting', 'maintenance', 'installation', 'setup', 'safety', 'specifications', 'error'];
  const relevantChunks = chunks.filter(c => 
    keywordSections.some(keyword => 
      c.menu_path?.toLowerCase().includes(keyword) || 
      c.content.toLowerCase().includes(keyword)
    )
  );

  relevantChunks.slice(0, 8).forEach(chunk => {
    sections.push(`## ${chunk.menu_path || 'General Section'} (Pages ${chunk.page_start}-${chunk.page_end})`);
    sections.push(chunk.content.substring(0, 400));
    sections.push('...\n');
  });

  return sections.join('\n');
}

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

    console.log('📊 Building comprehensive manual summary...');

    // Get all chunks to extract section hierarchy
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks_text')
      .select('content, menu_path, page_start, page_end')
      .eq('manual_id', manual_id)
      .order('page_start', { ascending: true });

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
      throw new Error('Failed to fetch manual content');
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No content found for this manual');
    }

    // Get all figures for captions and keywords
    const { data: figures } = await supabase
      .from('figures')
      .select('caption_text, keywords, page_number, vision_text')
      .eq('manual_id', manual_id)
      .order('page_number', { ascending: true });

    // Build structured summary
    const summary = buildStructuredSummary(manual, chunks, figures || []);
    
    console.log('📝 Analyzing content with AI...');
    
    // Get model config
    const modelConfig = await getModelConfig(supabase, profile.fec_tenant_id);
    console.log(`🤖 Using model: ${modelConfig.model}`);

    // Generate golden questions using OpenAI
    const requestBody: any = {
      model: modelConfig.model,
      response_format: { type: "json_object" },
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

IMPORTANT: You must respond with valid JSON only. Return a JSON object with a "questions" array like this:
{
  "questions": [
    {
      "question": "How do I reset the game when it freezes during gameplay?",
      "category": "troubleshooting",
      "importance": "high"
    }
  ]
}

Categories should be: troubleshooting, setup, maintenance, safety, specifications
Importance levels: high, medium, low`
        },
        {
          role: 'user',
          content: `Generate 8-12 golden questions for this technical manual using the comprehensive summary below:

${summary.substring(0, 8000)}`
        }
      ],
      [modelConfig.maxTokensParam]: 2000
    };
    
    if (modelConfig.supportsTemperature) {
      requestBody.temperature = 0.2;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('✅ AI response received');
    console.log('📦 Full response:', JSON.stringify(aiResponse, null, 2));

    let questions;
    try {
      const content = aiResponse.choices?.[0]?.message?.content;
      
      console.log('📝 Content received:', content);
      
      if (!content || content.trim() === '') {
        console.error('❌ Empty content received from OpenAI');
        console.error('Full API response:', JSON.stringify(aiResponse, null, 2));
        throw new Error('Empty response from AI - try using GPT-4o instead of GPT-5');
      }
      
      // Strip markdown code blocks if present
      const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      // Handle both array format and object with questions array
      questions = Array.isArray(parsed) ? parsed : parsed.questions;
      
      if (!questions || !Array.isArray(questions)) {
        throw new Error('Response does not contain a questions array');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      console.error('Raw content:', aiResponse.choices?.[0]?.message?.content);
      throw new Error('Failed to parse AI response - try using GPT-4o instead of GPT-5');
    }

    if (!Array.isArray(questions)) {
      throw new Error('Invalid AI response format');
    }

    console.log(`📋 Generated ${questions.length} golden questions`);

    // Store questions in database
    const questionsToInsert = questions.map((q: any) => ({
      manual_id,
      fec_tenant_id: profile.fec_tenant_id,
      question: q.question,
      question_type: q.type || q.category || 'general',
      category: q.category,
      importance: q.importance,
      expected_keywords: q.expected_keywords || [],
      filters: q.filters || null
    }));

    const { error: insertError } = await supabase
      .from('golden_questions')
      .insert(questionsToInsert);

    if (insertError) {
      console.error('Error storing questions:', insertError);
      throw new Error('Failed to store questions');
    }

    console.log('✅ Questions stored successfully');
    
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