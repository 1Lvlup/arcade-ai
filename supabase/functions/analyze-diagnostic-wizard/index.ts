import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WizardCompletionData {
  scenario: string;
  results: Record<string, string>;
  device_context?: {
    manual_id?: string;
    device_type?: string;
    model?: string;
  };
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  steps: string[];
  estimated_time: string;
  required_items: string[];
  manual_sections?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const backendModel = Deno.env.get('BACKEND_MODEL') || 'gpt-5-2025-08-07';
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { scenario, results, device_context }: WizardCompletionData = await req.json();

    if (!scenario || !results) {
      return new Response(
        JSON.stringify({ error: 'scenario and results are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build diagnostic context from wizard answers
    const diagnosticPath = Object.entries(results)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Build AI prompt based on scenario
    const systemPrompt = buildSystemPrompt(scenario);
    const userPrompt = `
Analyze this diagnostic session:

Scenario: ${scenario}
Device: ${device_context?.device_type || 'Unknown'}
${device_context?.model ? `Model: ${device_context.model}` : ''}

Diagnostic Path:
${diagnosticPath}

Provide a detailed troubleshooting analysis with prioritized recommendations.
`;

    // Optional: Retrieve relevant manual content if manual_id provided
    let manualContext = '';
    if (device_context?.manual_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Search for relevant troubleshooting content
        const searchTerms = extractSearchTerms(scenario, results);
        const { data: chunks } = await supabase
          .from('chunks_text')
          .select('content, page_start, page_end')
          .eq('manual_id', device_context.manual_id)
          .textSearch('content', searchTerms)
          .limit(3);

        if (chunks && chunks.length > 0) {
          manualContext = '\n\nRelevant Manual Content:\n' + 
            chunks.map(c => `Pages ${c.page_start}-${c.page_end}: ${c.content}`).join('\n\n');
        }
      } catch (error) {
        console.error('Error fetching manual context:', error);
      }
    }

    // Call OpenAI for analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: backendModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + manualContext }
        ],
        max_completion_tokens: 2000,
        tools: [{
          type: "function",
          function: {
            name: "generate_troubleshooting_recommendations",
            description: "Generate structured troubleshooting recommendations",
            parameters: {
              type: "object",
              properties: {
                diagnosis_summary: {
                  type: "string",
                  description: "Brief summary of the diagnosis"
                },
                likely_cause: {
                  type: "string",
                  description: "Most likely cause of the issue"
                },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Confidence level in the diagnosis"
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      priority: {
                        type: "string",
                        enum: ["critical", "high", "medium", "low"]
                      },
                      steps: {
                        type: "array",
                        items: { type: "string" }
                      },
                      estimated_time: { type: "string" },
                      required_items: {
                        type: "array",
                        items: { type: "string" }
                      },
                      manual_sections: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["id", "title", "description", "priority", "steps", "estimated_time", "required_items"]
                  }
                },
                follow_up_questions: {
                  type: "array",
                  items: { type: "string" }
                },
                escalation_needed: {
                  type: "boolean",
                  description: "Whether professional support is recommended"
                },
                safety_warnings: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["diagnosis_summary", "likely_cause", "confidence", "recommendations", "escalation_needed"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_troubleshooting_recommendations" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in analyze-diagnostic-wizard:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        diagnosis_summary: 'Analysis failed - please try again or contact support',
        likely_cause: 'Unable to complete analysis',
        confidence: 'low',
        recommendations: [],
        escalation_needed: true
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function buildSystemPrompt(scenario: string): string {
  const basePrompt = `You are an expert technician analyzing diagnostic wizard results. 
Your goal is to provide clear, actionable troubleshooting recommendations based on the diagnostic path the user took.

Guidelines:
- Prioritize safety first - flag any dangerous situations
- Start with simple, non-invasive solutions
- Progress to more complex solutions only if necessary
- Be specific with steps - avoid vague instructions
- Estimate realistic time requirements
- List any tools or parts needed
- Indicate confidence level honestly
- Recommend escalation if hardware repair is likely needed
`;

  const scenarioSpecific: Record<string, string> = {
    power: `
Focus on power-related issues:
- Power supply failures
- Cable/connection problems
- Internal hardware issues (PSU, motherboard)
- Power button failures
- Safety warnings about electrical work
`,
    display: `
Focus on display-related issues:
- Cable and connection problems
- Monitor/screen failures
- Graphics card issues
- Display settings and drivers
- Input source selection
`,
    audio: `
Focus on audio-related issues:
- Volume and mute settings
- Audio device selection
- Driver problems
- Hardware failures
- Cable/connection issues
`,
    network: `
Focus on network connectivity:
- Router/modem issues
- Cable connections
- WiFi signal problems
- Network configuration
- ISP-related issues
`
  };

  return basePrompt + (scenarioSpecific[scenario] || '');
}

function extractSearchTerms(scenario: string, results: Record<string, string>): string {
  const terms: string[] = [scenario];
  
  for (const [key, value] of Object.entries(results)) {
    if (value && value.length > 2) {
      terms.push(value);
    }
  }
  
  return terms.join(' | ');
}
