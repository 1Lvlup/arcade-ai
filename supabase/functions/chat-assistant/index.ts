// supabase/functions/chat-assistant/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL");
const ANON_KEY       = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("PUBLISHABLE_KEY");
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// 🔧 REQUIRED: set these to your existing function URLs (they're usually {SUPABASE_URL}/functions/v1/<name>)
const SEARCH_MANUALS_URL = `${SUPABASE_URL}/functions/v1/search-manuals`;
const PRESIGN_IMAGE_URL  = `${SUPABASE_URL}/functions/v1/presign-image`;

// ---- tool calls (forward user authentication) ----
async function tool_search_manuals(args: { query: string; manual_id?: string | null; max_results?: number }, authHeader: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  
  if (authHeader) {
    headers["Authorization"] = authHeader;
    headers["apikey"] = ANON_KEY;
  }
  
  const res = await fetch(SEARCH_MANUALS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: args.query,
      manual_id: args.manual_id ?? null,
      max_results: args.max_results ?? 20
    })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`search-manuals failed: ${res.status} ${text}`);
    throw new Error(`search-manuals failed: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

async function tool_presign_image(args: { figure_id: string }) {
  const res = await fetch(PRESIGN_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY
    },
    body: JSON.stringify({ figure_id: args.figure_id })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`presign-image failed: ${res.status} ${text}`);
    throw new Error(`presign-image failed: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

async function secondPassPolish(draft: string, userQuestion: string) {
  const messages = [
    {
      role: "system",
      content:
        "You are a strict editor. Rewrite the assistant's draft to be clearer for a 5th-grader, enforce the required sections (CITE, DIAGNOSE, TOOLS, TIME, DO NEXT, EXPECTED, IF NOT, EXTRA, SAFETY, SUMMARY, FOLLOW-UP), replace vague nouns with exact labels present in the draft, remove fluff, keep steps short and actionable, and keep all safety notes."
    },
    {
      role: "user",
      content:
        `USER QUESTION:\n${userQuestion}\n\nASSISTANT DRAFT (improve this, do not invent specs that weren't stated):\n${draft}`
    }
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("secondPassPolish error:", t);
    return draft; // fallback to original
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || draft;
}

// ---- system prompt (the “CITE → DIAGNOSE → DO NEXT → EXPECTED → IF NOT → EXTRA” one) ----
const SYSTEM_PROMPT = `
You are “Dream Technician Assistant,” an expert arcade/bowling tech coach. Converse naturally (ChatGPT-like), but ground answers in retrieved manuals, error codes, and prior chat context. Use plain language at a 5th-grade reading level: short sentences, no jargon unless you explain it.

OUTPUT FORMAT (ALWAYS, IN THIS ORDER):
1) CITE — exact sources used: manual title + section/page or chunk ID. If none, write “No manual evidence found” and ask ONE targeted multiple-choice question (A/B/C).
2) DIAGNOSE — likely root cause(s) in simple words.
3) TOOLS — bullet list of tools required (what + why). Keep it short. Include multimeter if voltage/resistance is involved.
4) TIME — rough total minutes for the DO NEXT steps (range is okay).
5) DO NEXT — numbered, safe, on-site steps. Each step must include the exact HOW:
   - Use precise labels from sources (connector IDs like J2-1/J2-2, fuse IDs, input names, menu paths).
   - If you say “check X,” either PROVIDE the value/ID/page OR explain exactly where to look (sticker text, menu path, figure/page).
6) EXPECTED — what they should see after each step.
7) IF NOT — what to try next or how to escalate (include part numbers if available).
8) EXTRA (beyond the manual) — practical tips. Never invent specific values; if a spec wasn’t retrieved, write “spec not captured”.
9) SAFETY — include when power, motion, or sharp parts are involved (default to power off for resistance checks).
10) SUMMARY — one-sentence recap in plain language.
11) FOLLOW-UP — ask ONE targeted multiple-choice question (A/B/C) if anything is still ambiguous.

TOOL USE RULES:
- Always call \`search_manuals\` first for technical questions. Prefer troubleshooting tables, fuse/power tables, wiring/connector IDs, error-code pages, and parts lists.
- If a figure helps, call \`presign_image\` and OFFER the diagram by name (e.g., “Figure 4-B Gate Assembly”).
- If retrieval returns <2 solid snippets, do NOT dump generic steps; ask ONE targeted multiple-choice question and stop.

CLARITY RULES (“Explain or Provide”):
- If you tell the user to “check” something, you must either:
  a) PROVIDE the specific info (e.g., “Gate Solenoid ≈ 18–22 Ω, Figure 4-B, p. 25”), OR
  b) EXPLAIN EXACTLY HOW to find it (sticker text, menu path, or manual page/figure).
- Replace vague nouns (“sensor/solenoid”) with exact labels from results (“Gate/0-Count Opto,” “Fuse F3 24V,” “J2-1/J2-2”).
- Only state precise specs (ball counts, ohms, voltages) if retrieved; cite inline (e.g., “≈ 20 Ω, p. 24”). If not retrieved, write “spec not captured.”

SELF-AUDIT BEFORE SENDING:
- Remove vague phrases like “check revision” unless you provided the exact method.
- Ensure steps are executable with basic tools (multimeter, wipes, compressed air).
- Prefer short, clear instructions; no paragraphs longer than 5 lines.

Never claim you “can’t access manuals” without (1) attempting retrieval twice and (2) stating exactly what you tried. If still no evidence, ask ONE precise multiple-choice question and stop.
`;

// ---- OpenAI call loop with tool use ----
async function chatWithTools(messages: any[], manual_id: string | null, authHeader: string | null) {
  console.log("Starting chatWithTools with manual_id:", manual_id);

  const tools = [
    {
      type: "function",
      function: {
        name: "search_manuals",
        description: "Semantic + keyword search over parsed manuals.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            manual_id: { type: "string", nullable: true },
            max_results: { type: "integer", default: 20 }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "presign_image",
        description: "Get a temporary URL for a figure image to show in chat.",
        parameters: {
          type: "object",
          properties: { figure_id: { type: "string" } },
          required: ["figure_id"]
        }
      }
    }
  ];

  // Only keep user and assistant messages from history
  const cleanMessages = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');

  let currentMessages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...cleanMessages
  ];

  for (let i = 0; i < 4; i++) {
    console.log(`Loop iteration ${i + 1}/4`);

    const requestPayload = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: currentMessages,
      tools
    };

    console.log("Making OpenAI API call with payload:", JSON.stringify(requestPayload, null, 2));

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    console.log("OpenAI API response status:", resp.status);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("OpenAI API error:", resp.status, errorText);
      return `OpenAI API error: ${resp.status} ${errorText}`;
    }

    const data = await resp.json();
    console.log("OpenAI API response data:", JSON.stringify(data, null, 2));

    const msg = data?.choices?.[0]?.message;
    console.log("Extracted message:", JSON.stringify(msg, null, 2));

    const toolCall = msg?.tool_calls?.[0];

    if (toolCall) {
      console.log("Processing tool call:", JSON.stringify(toolCall, null, 2));

      // Add assistant message with tool_calls
      currentMessages.push(msg);

      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");

      console.log(`Executing tool: ${name} with args:`, args);

      try {
        let result: any;
        if (name === "search_manuals") {
          console.log("Calling search_manuals tool");
          result = await tool_search_manuals({
            query: args.query,
            manual_id: manual_id ?? args.manual_id ?? null,
            max_results: args.max_results ?? 20
          }, authHeader);
          console.log("Search manuals result:", JSON.stringify(result, null, 2));

          // simple fallback: expand keywords if too few hits
          if (!result?.results || result.results.length < 3) {
            console.log("Performing fallback search with expanded keywords");
            const fallback = await tool_search_manuals({
              query: `${args.query} release|eject|lift|kicker|gate|hopper|jam|opto|microswitch|sensor|coil|solenoid|motor|fuse`,
              manual_id: manual_id ?? args.manual_id ?? null,
              max_results: 20
            });
            console.log("Fallback search result:", JSON.stringify(fallback, null, 2));
            result.results = [
              ...(result.results || []),
              ...(fallback.results || [])
            ];
          }
        } else if (name === "presign_image") {
          console.log("Calling presign_image tool");
          result = await tool_presign_image({ figure_id: args.figure_id });
          console.log("Presign image result:", JSON.stringify(result, null, 2));
        } else {
          console.error("Unknown tool name:", name);
          result = { error: `Unknown tool ${name}` };
        }

        // Add the tool response tied to the tool_call id
        const toolMessage = {
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result)
        };

        console.log("Adding tool message:", JSON.stringify(toolMessage, null, 2));
        currentMessages.push(toolMessage);
        continue; // loop so the model can consume tool output
      } catch (e) {
        console.error("Tool execution error:", e);
        const errorMessage = {
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({ error: String(e) })
        };
        console.log("Adding error tool message:", JSON.stringify(errorMessage, null, 2));
        currentMessages.push(errorMessage);
        continue;
      }
    }

        // no tool call => final answer
    const finalContent = msg?.content;
    console.log("Final message content:", finalContent);

    if (!finalContent) {
      console.error("No content in final message, full message:", JSON.stringify(msg, null, 2));
      return "I received an empty response from the AI model. Please try your question again.";
    }

    // NEW: run a quick clarity pass before returning
    const lastUser = [...currentMessages].reverse().find(m => m.role === "user")?.content || "";
    const polished = await secondPassPolish(finalContent, lastUser);
    return polished;

  } // <-- end of for (let i = 0; i < 4; i++)

  console.error("Exceeded maximum tool call iterations");
  return "I couldn't complete the tool sequence. Try rephrasing or narrowing the manual.";

} // <-- end of async function chatWithTools


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    console.log("Chat assistant function called");

    // Validate environment variables
    if (!OPENAI_API_KEY) throw new Error("OpenAI API key is not configured");
    if (!SUPABASE_URL)   throw new Error("Supabase URL is not configured");
    if (!SERVICE_KEY)    throw new Error("Supabase service key is not configured");
    if (!ANON_KEY)       throw new Error("Anon/Publishable key is not configured");

    console.log("Environment variables validated");

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const { messages, manual_id } = body; // messages = [{ role: "user", content: "..." }, ...]
    if (!Array.isArray(messages)) throw new Error("messages[] required");

    console.log(`Processing ${messages.length} messages with manual_id: ${manual_id}`);

    // Get the authorization header to forward to other functions
    const authHeader = req.headers.get('authorization');
    
    const answer = await chatWithTools(messages, manual_id ?? null, authHeader);
    console.log("Chat response generated:", answer);

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("chat-assistant error:", err);
    console.error("Error stack:", err.stack);
    return new Response(JSON.stringify({
      error: `Chat assistant error: ${String(err.message || err)}`
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
