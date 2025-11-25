import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the Authorization header (passed automatically by supabase.functions.invoke)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client bound to the caller's JWT for permission checks / RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Service-role client for actually mutating user_roles
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if caller is admin using the RPC that relies on auth.uid()
    const { data: statusRows, error: statusError } = await supabaseClient.rpc('check_my_admin_status');

    if (statusError) {
      console.error('check_my_admin_status error:', statusError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: statusError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = statusRows && statusRows[0];
    if (!status || !status.has_admin_role) {
      console.error('User is not admin for manage-user-role');
      return new Response(
        JSON.stringify({ error: 'Not authorized - admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin caller:', status.user_email);

    const { userId, action } = await req.json();

    if (action === 'promote') {
      // Add admin role
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' })
        .select()
        .single();

      if (error && !error.message.includes('duplicate key')) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User promoted to admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'demote') {
      // Remove admin role
      const { error } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Admin role removed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error managing role:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
