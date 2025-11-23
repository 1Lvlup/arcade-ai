import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

    // Get AI answer from RAG system
    const aiAnswer = await askLevelUpAI(messageBody, fromNumber);
    
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
 * Get AI answer from Level Up RAG system
 * Connects to chat-manual edge function with full RAG pipeline
 */
async function askLevelUpAI(question: string, fromNumber: string): Promise<string> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Look up user profile by phone number to get tenant context
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fec_tenant_id, user_id, facility_name')
      .eq('phone_number', fromNumber)
      .eq('sms_opt_in', true)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup error:", profileError);
      return "I couldn't find your account. Please make sure SMS notifications are enabled in your Level Up AI account settings.";
    }

    console.log(`SMS question from tenant ${profile.fec_tenant_id}: ${question}`);

    // Call chat-manual edge function with RAG pipeline
    const { data: chatData, error: chatError } = await supabase.functions.invoke('chat-manual', {
      body: {
        query: question,
        // Don't specify manual_id - let the system search all accessible manuals
        tenant_id: profile.fec_tenant_id,
        user_id: profile.user_id
      }
    });

    if (chatError) {
      console.error("Chat-manual error:", chatError);
      return "Sorry, I'm having trouble accessing the knowledge base right now. Please try again or use the web dashboard.";
    }

    // Extract the answer from the response
    let answer = chatData?.answer || chatData?.content || "I couldn't generate an answer for that question.";

    // Handle structured responses (if chat-manual returns JSON)
    if (typeof answer === 'object') {
      answer = answer.answer || answer.text || JSON.stringify(answer);
    }

    // Truncate for SMS if needed (max 300 chars, leave room for "... More at levelupai.com")
    if (answer.length > 280) {
      answer = answer.substring(0, 277) + "...";
    }

    return answer;

  } catch (error) {
    console.error("Error in askLevelUpAI:", error);
    return "Sorry, I encountered an error. Please try again or contact support.";
  }
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
