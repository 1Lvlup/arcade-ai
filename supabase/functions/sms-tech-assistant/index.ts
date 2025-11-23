import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Twilio SMS Webhook Handler
 * 
 * This edge function receives SMS messages from Twilio and responds with AI-generated
 * troubleshooting answers for arcade technicians.
 * 
 * Twilio sends POST requests with application/x-www-form-urlencoded data containing:
 * - Body: the text message from the technician
 * - From: the sender's phone number
 * - (and other fields we can use later)
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received Twilio webhook request");

    // Parse Twilio's form data
    const formData = await req.formData();
    const messageBody = formData.get("Body")?.toString() || "";
    const fromNumber = formData.get("From")?.toString() || "";

    console.log(`SMS from ${fromNumber}: ${messageBody}`);

    // Check for STOP/START keywords
    const normalizedBody = messageBody.trim().toUpperCase();
    if (normalizedBody === "STOP") {
      await handleOptOut(fromNumber);
      return createTwiMLResponse("You've been unsubscribed from Level Up AI SMS. Text START to re-subscribe.");
    }
    
    if (normalizedBody === "START") {
      await handleOptIn(fromNumber);
      return createTwiMLResponse("You've been re-subscribed to Level Up AI SMS support. Send your troubleshooting questions anytime!");
    }

    // Validate we have a message
    if (!messageBody.trim()) {
      return createTwiMLResponse("Please send a question about your arcade game and I'll help troubleshoot it.");
    }

    // Check if user has opted in
    const hasOptedIn = await checkOptInStatus(fromNumber);
    if (!hasOptedIn) {
      return createTwiMLResponse(
        "Welcome to Level Up AI! To receive SMS support, please enable SMS notifications in your account settings at levelupai.com. Contact support if you need assistance."
      );
    }

    // Get AI answer
    const aiAnswer = await askLevelUpAI(messageBody);
    
    // Return TwiML response
    return createTwiMLResponse(aiAnswer);

  } catch (error) {
    console.error("Error processing SMS:", error);
    return createTwiMLResponse(
      "Sorry, I couldn't process that right now. Please try again or use the web dashboard at your facility."
    );
  }
});

/**
 * Helper function to get AI answer from Level Up
 * 
 * Current implementation: Uses Lovable AI with a simple prompt
 * 
 * TO SWAP TO EXISTING RAG SYSTEM LATER:
 * 1. Replace this function to call your existing chat-manual edge function
 * 2. You'll need to pass manual_id if you want specific game context
 * 3. The chat-manual function expects: { query, manual_id?, conversation_id? }
 * 4. Example call:
 *    const { data } = await supabase.functions.invoke('chat-manual', {
 *      body: { query: question, manual_id: 'some-game-id' }
 *    });
 *    return data.answer;
 */
async function askLevelUpAI(question: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // System prompt optimized for SMS - short, actionable responses
  const systemPrompt = `You are an arcade game technician assistant responding via SMS. 
Keep answers SHORT and ACTIONABLE (max 160 characters if possible, 300 max).
Focus on immediate next steps the tech can try right now.
Use simple language, bullet points with dashes, no fancy formatting.
If the question is unclear, ask ONE clarifying question.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tech question via SMS: ${question}` }
      ],
      temperature: 0.7,
      max_tokens: 200, // Keep responses short for SMS
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    throw new Error("AI service unavailable");
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error("No answer from AI");
  }

  return answer.trim();
}

/**
 * Check if a phone number has opted in to SMS notifications
 */
async function checkOptInStatus(phoneNumber: string): Promise<boolean> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=sms_opt_in&phone_number=eq.${encodeURIComponent(phoneNumber)}`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const data = await response.json();
    return data?.[0]?.sms_opt_in === true;
  } catch (error) {
    console.error("Error checking opt-in status:", error);
    return false;
  }
}

/**
 * Handle SMS opt-out (STOP keyword)
 */
async function handleOptOut(phoneNumber: string): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?phone_number=eq.${encodeURIComponent(phoneNumber)}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        sms_opt_in: false,
        sms_opt_out_date: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Error handling opt-out:", error);
  }
}

/**
 * Handle SMS opt-in (START keyword)
 */
async function handleOptIn(phoneNumber: string): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?phone_number=eq.${encodeURIComponent(phoneNumber)}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        sms_opt_in: true,
        sms_opt_in_date: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Error handling opt-in:", error);
  }
}

/**
 * Creates a TwiML XML response for Twilio
 * Properly escapes XML characters to prevent breaking the response
 */
function createTwiMLResponse(message: string): Response {
  // Escape XML special characters
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml",
      ...corsHeaders,
    },
  });
}
