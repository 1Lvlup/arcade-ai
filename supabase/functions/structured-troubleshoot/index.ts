import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// System prompt for structured troubleshooting
const STRUCTURED_SYSTEM_PROMPT = `You are an expert arcade game technician providing structured troubleshooting guidance. You MUST respond ONLY with valid JSON following this exact structure:

{
  "summary": "Brief summary of current diagnostic state (1-2 sentences)",
  "next_actions": ["Action 1", "Action 2", "Action 3"],
  "questions_for_tech": ["Question 1?", "Question 2?"],
  "status": "continue|probably_fixed|escalate|need_manual|done",
  "escalation": {
    "reason": "Why escalation is needed",
    "recommended_target": "manufacturer|distributor|specialist",
    "info_to_pass_on": "Critical info for next support tier"
  },
  "log_step": {
    "step_label": "Brief label for this step",
    "assumptions": ["Assumption 1", "Assumption 2"],
    "checks_performed": ["Check 1", "Check 2"],
    "results_expected": ["Expected result 1", "Expected result 2"],
    "branch_logic": "What to do based on results"
  }
}

CRITICAL RULES:
1. ALWAYS respond with valid JSON only - no markdown, no explanations outside JSON
2. Use retrieved manual context when available - cite page numbers in actions
3. Keep next_actions specific, numbered, and actionable (3-5 actions max)
4. Ask clarifying questions when needed
5. Escalate when: electrical work needed, board replacement, safety issues
6. Use "probably_fixed" when symptoms should be resolved - ask for confirmation
7. Use "done" only when tech confirms issue is resolved
8. Track diagnostic progress in log_step for analytics

Response Status Guide:
- "continue": Normal troubleshooting, need more info or tests
- "probably_fixed": Solution attempted, awaiting confirmation
- "escalate": Beyond AI/tech capability, needs expert
- "need_manual": AI lacks specific info, manual review required
- "done": Confirmed resolution, session complete`;

interface TroubleshootingRequest {
  session_id?: string;
  user_message: string;
  game_id?: string;
  manual_id?: string;
  symptom?: string;
  location_name?: string;
  user_id?: string;
  tenant_id?: string;
}

interface TroubleshootingResponse {
  summary: string;
  next_actions: string[];
  questions_for_tech: string[];
  status: "continue" | "probably_fixed" | "escalate" | "need_manual" | "done";
  escalation?: {
    reason: string;
    recommended_target: string;
    info_to_pass_on: string;
  };
  log_step: {
    step_label: string;
    assumptions: string[];
    checks_performed: string[];
    results_expected: string[];
    branch_logic: string;
  };
}

async function fetchContextFromSearch(query: string, manual_id?: string, tenant_id?: string) {
  console.log("🔍 Fetching context for query:", query.substring(0, 100));
  
  try {
    const searchResponse = await supabase.functions.invoke('search-unified', {
      body: {
        query: query,
        manual_id: manual_id,
        tenant_id: tenant_id,
        top_k: 15, // Smaller context for faster responses
      },
    });

    if (searchResponse.error) {
      console.error("❌ Search error:", searchResponse.error);
      return [];
    }

    const { textResults = [], figureResults = [] } = searchResponse.data || {};
    console.log(`✅ Retrieved ${textResults.length} text, ${figureResults.length} figures`);
    
    return [...textResults, ...figureResults].slice(0, 10);
  } catch (error) {
    console.error("❌ Context fetch error:", error);
    return [];
  }
}

async function loadSession(session_id: string) {
  const { data: session, error } = await supabase
    .from('troubleshooting_sessions')
    .select('*')
    .eq('session_id', session_id)
    .single();

  if (error) {
    console.error("❌ Session load error:", error);
    return null;
  }

  // Load previous steps
  const { data: steps } = await supabase
    .from('troubleshooting_steps')
    .select('*')
    .eq('session_id', session.id)
    .order('step_number', { ascending: true });

  return { session, steps: steps || [] };
}

async function createSession(req: TroubleshootingRequest) {
  const session_id = crypto.randomUUID();
  
  const { data: session, error } = await supabase
    .from('troubleshooting_sessions')
    .insert({
      session_id,
      game_id: req.game_id,
      game_name: req.game_id, // TODO: Look up game name from manual_metadata
      symptom: req.symptom || req.user_message,
      status: 'in_progress',
      location_name: req.location_name,
      user_id: req.user_id,
      fec_tenant_id: req.tenant_id || '00000000-0000-0000-0000-000000000000',
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Session creation error:", error);
    throw new Error("Failed to create session");
  }

  return { session, steps: [] };
}

async function updateSession(sessionId: string, status: string, escalation_info?: any) {
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'done') {
    updates.completed_at = new Date().toISOString();
  }

  if (escalation_info) {
    updates.escalation_info = escalation_info;
  }

  await supabase
    .from('troubleshooting_sessions')
    .update(updates)
    .eq('id', sessionId);
}

async function logStep(sessionId: string, stepNumber: number, response: TroubleshootingResponse, userMessage: string) {
  await supabase
    .from('troubleshooting_steps')
    .insert({
      session_id: sessionId,
      step_number: stepNumber,
      step_label: response.log_step.step_label,
      summary: response.summary,
      next_actions: response.next_actions,
      questions_for_tech: response.questions_for_tech,
      assumptions: response.log_step.assumptions,
      checks_performed: response.log_step.checks_performed,
      results_expected: response.log_step.results_expected,
      branch_logic: response.log_step.branch_logic,
      status: response.status,
      tech_response: userMessage,
    });
}

async function callOpenAI(messages: any[], model: string = "gpt-5-2025-08-07") {
  const isGpt5 = model.includes("gpt-5");
  
  const payload: any = {
    model,
    messages,
    [isGpt5 ? "max_completion_tokens" : "max_tokens"]: 2000,
    stream: true,
  };

  // GPT-5 doesn't support temperature
  if (!isGpt5) {
    payload.temperature = 0.3;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TroubleshootingRequest = await req.json();
    console.log("📥 Structured troubleshoot request:", {
      session_id: body.session_id,
      has_game_id: !!body.game_id,
      message_length: body.user_message?.length,
    });

    // Load or create session
    let sessionData = body.session_id 
      ? await loadSession(body.session_id)
      : null;

    if (!sessionData && !body.session_id) {
      // New session
      sessionData = await createSession(body);
      console.log("✅ Created new session:", sessionData.session.session_id);
    }

    if (!sessionData) {
      throw new Error("Session not found");
    }

    const { session, steps } = sessionData;

    // Fetch relevant context from manuals
    const contextChunks = await fetchContextFromSearch(
      body.user_message,
      body.manual_id || session.game_id,
      body.tenant_id || session.fec_tenant_id
    );

    // Build context string
    let contextString = "";
    if (contextChunks.length > 0) {
      contextString = "\n\nRelevant Manual Context:\n" + 
        contextChunks.map((chunk: any, idx: number) => 
          `[${idx + 1}] Page ${chunk.page_start || '?'}: ${chunk.content?.substring(0, 300)}...`
        ).join("\n\n");
    }

    // Build conversation history
    const conversationHistory = steps.map((step: any) => [
      { role: "assistant", content: JSON.stringify({
        summary: step.summary,
        next_actions: step.next_actions,
        questions_for_tech: step.questions_for_tech,
      })},
      { role: "user", content: step.tech_response || "No response provided" }
    ]).flat();

    // Build messages for OpenAI
    const messages = [
      { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
      { 
        role: "user", 
        content: `Game: ${session.game_name || 'Unknown'}\nInitial Symptom: ${session.symptom}\n\nSession History:\n${conversationHistory.length > 0 ? JSON.stringify(conversationHistory) : 'New session'}${contextString}\n\nTechnician Message: ${body.user_message}` 
      },
    ];

    console.log("🤖 Calling OpenAI with structured prompt...");
    const aiResponse = await callOpenAI(messages);

    // Stream response back to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    buffer += content;
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Parse complete response and log step
          try {
            const parsedResponse: TroubleshootingResponse = JSON.parse(buffer);
            
            // Log this step to database
            await logStep(session.id, steps.length + 1, parsedResponse, body.user_message);
            
            // Update session status
            await updateSession(
              session.id, 
              parsedResponse.status,
              parsedResponse.escalation
            );

            console.log("✅ Logged step", steps.length + 1, "with status:", parsedResponse.status);
          } catch (e) {
            console.error("❌ Failed to parse final response:", e);
          }

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error("❌ Stream error:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("❌ Structured troubleshoot error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
