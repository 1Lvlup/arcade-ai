// supabase/functions/chat-assistant/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// 🔧 REQUIRED: set these to your existing function URLs (they're usually {SUPABASE_URL}/functions/v1/<name>)
const SEARCH_MANUALS_URL = `${SUPABASE_URL}/functions/v1/search-manuals`;
const PRESIGN_IMAGE_URL = `${SUPABASE_URL}/functions/v1/presign-image`;
// ---- tool shims ----
async function tool_search_manuals(args) {
  const res = await fetch(SEARCH_MANUALS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({
      query: args.query,
      manual_id: args.manual_id ?? null,
      max_results: args.max_results ?? 20
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`search-manuals failed: ${res.status} ${text}`);
  return JSON.parse(text);
}
async function tool_presign_image(args) {
  const res = await fetch(PRESIGN_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({
      figure_id: args.figure_id
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`presign-image failed: ${res.status} ${text}`);
  return JSON.parse(text);
}
// ---- system prompt ----
const SYSTEM_PROMPT = `
You are a senior arcade service technician. Be concise, specific, and grounded in the user's uploaded manuals.

CRITICAL RULES
- Always call the search_manuals tool FIRST for technical questions.
- Prefer content with explicit menu paths, troubleshooting tables, fuse/power tables, and parts/connectors.
- If figures are relevant, call presign_image and offer to show the diagram.
- Do not invent page numbers or values. If missing, say so and give the menu path/measurement to obtain them.
- If retrieval returns < 2 strong snippets, ask one short clarifying question or give the next diagnostic step (do NOT guess).

OUTPUT
1) Direct answer (1 sentence).
2) 90-second triage steps (bullets).
3) If/Then decision tree with menu paths, connector/fuse IDs, voltages.
4) Safety warnings.
5) Citations: Manual name + page(s). If page missing, say "(page not captured)".
`;
// ---- OpenAI call loop with tool use ----
async function chatWithTools(messages, manual_id) {
  // OpenAI tool schema
  const tools = [
    {
      type: "function",
      function: {
        name: "search_manuals",
        description: "Semantic + keyword search over parsed manuals.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string"
            },
            manual_id: {
              type: "string",
              nullable: true
            },
            max_results: {
              type: "integer",
              default: 20
            }
          },
          required: [
            "query"
          ]
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
          properties: {
            figure_id: {
              type: "string"
            }
          },
          required: [
            "figure_id"
          ]
        }
      }
    }
  ];
  let toolMsgs = [];
  for(let i = 0; i < 4; i++){
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          ...messages,
          ...toolMsgs
        ],
        tools
      })
    });
    const data = await resp.json();
    const msg = data?.choices?.[0]?.message;
    const toolCall = msg?.tool_calls?.[0];
    if (toolCall) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");
      try {
        let result;
        if (name === "search_manuals") {
          // Force manual scope if your UI passes it
          result = await tool_search_manuals({
            query: args.query,
            manual_id: manual_id ?? args.manual_id ?? null,
            max_results: args.max_results ?? 20
          });
          // simple fallback: expand keywords if too few hits
          if (!result?.results || result.results.length < 3) {
            const fallback = await tool_search_manuals({
              query: `${args.query} release|eject|lift|kicker|gate|hopper|jam|opto|microswitch|sensor|coil|solenoid|motor|fuse`,
              manual_id: manual_id ?? args.manual_id ?? null,
              max_results: 20
            });
            result.results = [
              ...result.results || [],
              ...fallback.results || []
            ];
          }
        } else if (name === "presign_image") {
          result = await tool_presign_image({
            figure_id: args.figure_id
          });
        } else {
          result = {
            error: `Unknown tool ${name}`
          };
        }
        toolMsgs.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result)
        });
        continue; // loop again so the model can use the tool output
      } catch (e) {
        toolMsgs.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({
            error: String(e)
          })
        });
        continue;
      }
    }
    // no tool call => final answer
    return msg?.content ?? "No response.";
  }
  return "I couldn't complete the tool sequence. Try rephrasing or narrowing the manual.";
}
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: corsHeaders
  });
  try {
    const body = await req.json();
    const { messages, manual_id } = body; // messages = [{ role: "user", content: "..." }, ...]
    if (!Array.isArray(messages)) throw new Error("messages[] required");
    const answer = await chatWithTools(messages, manual_id);
    return new Response(JSON.stringify({
      answer
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("chat-assistant error:", err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});