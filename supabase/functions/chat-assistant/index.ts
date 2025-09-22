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
  console.log("Starting chatWithTools with manual_id:", manual_id);
  
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
    console.log(`Loop iteration ${i + 1}/4`);
    
    const requestPayload = {
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
      
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");
      
      console.log(`Executing tool: ${name} with args:`, args);
      
      try {
        let result;
        if (name === "search_manuals") {
          console.log("Calling search_manuals tool");
          // Force manual scope if your UI passes it
          result = await tool_search_manuals({
            query: args.query,
            manual_id: manual_id ?? args.manual_id ?? null,
            max_results: args.max_results ?? 20
          });
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
              ...result.results || [],
              ...fallback.results || []
            ];
          }
        } else if (name === "presign_image") {
          console.log("Calling presign_image tool");
          result = await tool_presign_image({
            figure_id: args.figure_id
          });
          console.log("Presign image result:", JSON.stringify(result, null, 2));
        } else {
          console.error("Unknown tool name:", name);
          result = {
            error: `Unknown tool ${name}`
          };
        }
        
        const toolMessage = {
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result)
        };
        
        console.log("Adding tool message:", JSON.stringify(toolMessage, null, 2));
        toolMsgs.push(toolMessage);
        continue; // loop again so the model can use the tool output
      } catch (e) {
        console.error("Tool execution error:", e);
        const errorMessage = {
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({
            error: String(e)
          })
        };
        console.log("Adding error tool message:", JSON.stringify(errorMessage, null, 2));
        toolMsgs.push(errorMessage);
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
    
    return finalContent;
  }
  
  console.error("Exceeded maximum tool call iterations");
  return "I couldn't complete the tool sequence. Try rephrasing or narrowing the manual.";
}
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: corsHeaders
  });
  try {
    console.log("Chat assistant function called");
    
    // Validate environment variables
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      throw new Error("OpenAI API key is not configured");
    }
    if (!SUPABASE_URL) {
      console.error("SUPABASE_URL is missing");
      throw new Error("Supabase URL is not configured");
    }
    if (!SERVICE_KEY) {
      console.error("SERVICE_KEY is missing");
      throw new Error("Supabase service key is not configured");
    }
    
    console.log("Environment variables validated");
    
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    const { messages, manual_id } = body; // messages = [{ role: "user", content: "..." }, ...]
    if (!Array.isArray(messages)) {
      console.error("Invalid messages format:", typeof messages);
      throw new Error("messages[] required");
    }
    
    console.log(`Processing ${messages.length} messages with manual_id: ${manual_id}`);
    
    const answer = await chatWithTools(messages, manual_id);
    console.log("Chat response generated:", answer);
    
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
    console.error("Error stack:", err.stack);
    return new Response(JSON.stringify({
      error: `Chat assistant error: ${String(err)}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});