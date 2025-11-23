import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Categorize questions based on keywords for analytics
function categorizeQuestion(question: string): string {
  const lower = question.toLowerCase();
  
  if (/(power|electric|voltage|plug|cord|outlet|fuse|breaker)/i.test(lower)) return 'power';
  if (/(button|joystick|control|stick|trackball|trigger)/i.test(lower)) return 'controls';
  if (/(sound|audio|speaker|volume|noise|music)/i.test(lower)) return 'audio';
  if (/(screen|monitor|display|video|picture|crt)/i.test(lower)) return 'display';
  if (/(coin|quarter|credit|token|acceptor)/i.test(lower)) return 'coin_mechanism';
  if (/(network|wifi|internet|connection|online|ethernet)/i.test(lower)) return 'network';
  if (/(error|code|fault|diagnostic)/i.test(lower)) return 'error_code';
  
  return 'other';
}

/**
 * Twilio SMS Webhook Handler with Analytics Logging
 * 
 * This edge function receives SMS messages from Twilio and responds with AI-generated
 * troubleshooting answers for arcade technicians. All interactions are logged for analytics.
 */
serve(async (req) => {
  const requestStartTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("=== Twilio webhook request received ===");

    // Parse Twilio's form data
    const formData = await req.formData();
    const messageBody = formData.get("Body")?.toString() || "";
    const fromNumber = formData.get("From")?.toString() || "";
    const messageSid = formData.get("MessageSid")?.toString() || "";

    console.log(`📱 From: ${fromNumber} | SID: ${messageSid}`);
    console.log(`💬 Body: "${messageBody}"`);

    // Get user profile for tenant context (needed for all operations including logging)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, fec_tenant_id, facility_name, sms_opt_in')
      .eq('phone_number', fromNumber)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("⚠️ Profile lookup error:", profileError);
    }
    
    console.log(`👤 Profile found: ${profile ? 'YES' : 'NO'} | Opted in: ${profile?.sms_opt_in ? 'YES' : 'NO'}`);

    // Check if this is the user's first message
    const { data: previousMessages } = await supabase
      .from('sms_logs')
      .select('id')
      .eq('phone_number', fromNumber)
      .eq('event_type', 'message')
      .limit(1);

    const isFirstMessage = !previousMessages || previousMessages.length === 0;

    // Check for PING command (for testing webhook connectivity)
    const normalizedBody = messageBody.trim().toUpperCase();
    if (normalizedBody === "PING") {
      console.log("🏓 PING command received");
      
      // Log ping event
      if (profile) {
        await supabase.from('sms_logs').insert({
          fec_tenant_id: profile.fec_tenant_id,
          user_id: profile.user_id,
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: 'ping',
          message_body: messageBody,
          facility_name: profile.facility_name,
          twilio_message_sid: messageSid,
        });
      }
      
      return createTwiMLResponse(`PONG - SMS webhook is reachable. Your phone: ${fromNumber}`);
    }
    
    // Check for STOP/START keywords
    if (normalizedBody === "STOP") {
      console.log("🛑 STOP command received");
      await handleOptOut(fromNumber);
      
      // Log opt-out event
      if (profile) {
        await supabase.from('sms_logs').insert({
          fec_tenant_id: profile.fec_tenant_id,
          user_id: profile.user_id,
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: 'opt_out',
          message_body: messageBody,
          facility_name: profile.facility_name,
          twilio_message_sid: messageSid,
        });
      }
      
      return createTwiMLResponse("You've been unsubscribed from Level Up AI SMS. Text START to re-subscribe.");
    }
    
    if (normalizedBody === "START") {
      console.log("▶️ START command received");
      await handleOptIn(fromNumber);
      
      // Log opt-in event
      if (profile) {
        await supabase.from('sms_logs').insert({
          fec_tenant_id: profile.fec_tenant_id,
          user_id: profile.user_id,
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: 'opt_in',
          message_body: messageBody,
          facility_name: profile.facility_name,
          twilio_message_sid: messageSid,
        });
        
        // Send welcome message on opt-in
        await sendWelcomeMessageIfEnabled(supabase, profile.fec_tenant_id, fromNumber, true);
      }
      
      return createTwiMLResponse("You've been re-subscribed to Level Up AI SMS support. Send your troubleshooting questions anytime!");
    }

    // Validate we have a message
    if (!messageBody.trim()) {
      return createTwiMLResponse("Please send a question about your arcade game and I'll help troubleshoot it.");
    }

    // Check if user has opted in
    const hasOptedIn = await checkOptInStatus(supabase, fromNumber);
    console.log(`✅ Opt-in status check result: ${hasOptedIn}`);
    
    if (!hasOptedIn) {
      console.log("❌ User not opted in or not found");
      
      // Log event - differentiate between unknown number and not opted in
      const eventType = profile ? 'not_opted_in' : 'unknown_number';
      
      if (profile) {
        await supabase.from('sms_logs').insert({
          fec_tenant_id: profile.fec_tenant_id,
          user_id: profile.user_id,
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: eventType,
          message_body: messageBody,
          error_message: profile ? 'User not opted in to SMS notifications' : 'Unknown phone number',
          facility_name: profile.facility_name,
          twilio_message_sid: messageSid,
        });
      } else {
        // Log even for unknown numbers (without tenant context)
        await supabase.from('sms_logs').insert({
          fec_tenant_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: eventType,
          message_body: messageBody,
          error_message: 'Unknown phone number - not in profiles table',
          twilio_message_sid: messageSid,
        });
      }
      
      return createTwiMLResponse(
        "Welcome to Level Up AI! To receive SMS support, please opt in at https://1levelup.ai/account-settings or contact support for help."
      );
    }

    // Send welcome message on first message if enabled
    if (isFirstMessage && profile) {
      await sendWelcomeMessageIfEnabled(supabase, profile.fec_tenant_id, fromNumber, false);
    }

    // Get AI answer from RAG system
    console.log("🤖 Calling RAG system...");
    const aiAnswer = await askLevelUpAI(messageBody, fromNumber);
    const responseTime = Date.now() - requestStartTime;
    console.log(`⏱️ Response generated in ${responseTime}ms`);
    
    // Log successful message interaction
    if (profile) {
      await supabase.from('sms_logs').insert({
        fec_tenant_id: profile.fec_tenant_id,
        user_id: profile.user_id,
        phone_number: fromNumber,
        direction: 'inbound',
        event_type: 'message',
        message_body: messageBody,
        question_text: messageBody,
        ai_response: aiAnswer,
        response_time_ms: responseTime,
        truncated: aiAnswer.length === 280,
        facility_name: profile.facility_name,
        topic_category: categorizeQuestion(messageBody),
        twilio_message_sid: messageSid,
      });
    }
    
    // Return TwiML response
    return createTwiMLResponse(aiAnswer);

  } catch (error) {
    console.error("❌ Error processing SMS:", error);
    
    // ALWAYS return a valid TwiML response, even on error
    // Try to log error, but don't let logging failures break the response
    try {
      const formData = await req.formData();
      const fromNumber = formData.get("From")?.toString() || "";
      const messageBody = formData.get("Body")?.toString() || "";
      const messageSid = formData.get("MessageSid")?.toString() || "";
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, fec_tenant_id, facility_name')
        .eq('phone_number', fromNumber)
        .single();
        
      if (profile) {
        await supabase.from('sms_logs').insert({
          fec_tenant_id: profile.fec_tenant_id,
          user_id: profile.user_id,
          phone_number: fromNumber,
          direction: 'inbound',
          event_type: 'error',
          message_body: messageBody,
          error_message: error.message || 'Unknown error processing SMS',
          facility_name: profile.facility_name,
          twilio_message_sid: messageSid,
        });
      }
    } catch (logError) {
      console.error("⚠️ Failed to log error (non-fatal):", logError);
    }
    
    // Return friendly error message - ALWAYS return TwiML
    return createTwiMLResponse(
      "Sorry, I couldn't process that right now. Please try again or visit https://1levelup.ai for support."
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
 * Send welcome message if enabled for the tenant
 */
async function sendWelcomeMessageIfEnabled(
  db: any,
  tenantId: string,
  phoneNumber: string,
  isOptIn: boolean
): Promise<void> {
  try {
    // Get SMS config for tenant
    const { data: config } = await db
      .from('sms_config')
      .select('*')
      .eq('fec_tenant_id', tenantId)
      .single();

    if (!config) {
      console.log('No SMS config found for tenant');
      return;
    }

    // Check if welcome messages are enabled
    if (!config.welcome_message_enabled) {
      console.log('Welcome messages disabled');
      return;
    }

    // For opt-in, always send. For first message, check auto_send setting
    if (!isOptIn && !config.auto_send_on_first_message) {
      console.log('Auto-send on first message disabled');
      return;
    }

    // Log welcome message send (note: this only logs, doesn't actually send via Twilio)
    await db.from('sms_logs').insert({
      phone_number: phoneNumber,
      direction: 'outbound',
      event_type: 'welcome_sent',
      message_body: config.welcome_message_template,
      fec_tenant_id: tenantId,
      metadata: { trigger: isOptIn ? 'opt_in' : 'first_message' },
    });

    console.log(`Welcome message logged for ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

/**
 * Check if a phone number has opted in to SMS notifications
 * Now uses Supabase client for better error handling and logging
 */
async function checkOptInStatus(supabaseClient: any, phoneNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('sms_opt_in')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - unknown number
        console.log(`📞 Phone number ${phoneNumber} not found in profiles`);
        return false;
      }
      console.error("⚠️ Error checking opt-in status:", error);
      return false;
    }

    const isOptedIn = data?.sms_opt_in === true;
    console.log(`🔍 Opt-in check for ${phoneNumber}: ${isOptedIn}`);
    return isOptedIn;
  } catch (error) {
    console.error("❌ Exception in checkOptInStatus:", error);
    // On any error, default to false (don't allow SMS)
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
