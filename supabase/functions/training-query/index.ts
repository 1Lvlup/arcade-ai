import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user from JWT
    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query_text, manual_id, response_text, user_id, admin_user } = await req.json();

    // Extract claims (simple sentence split)
    const claims = response_text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    
    // Detect numbers using regex
    const numericMatches = [...response_text.matchAll(/(\d+\.?\d*)\s*([a-zA-Z]+)?/g)];
    const numeric_flags = numericMatches.map(m => ({
      value: m[1],
      unit: m[2] || '',
      context: response_text.substring(
        Math.max(0, m.index! - 20),
        Math.min(response_text.length, m.index! + m[0].length + 40)
      )
    }));

    // Simple claim coverage calculation (placeholder)
    const claim_coverage = 0.5;
    
    // Auto-flag if has unverified numbers
    const needs_verification = numeric_flags.length > 0;
    
    // Calculate quality score
    const quality_score = claim_coverage * 0.7 + (needs_verification ? 0.0 : 0.3);
    
    // Determine quality tier
    let quality_tier = 'low';
    if (quality_score >= 0.7) quality_tier = 'high';
    else if (quality_score >= 0.4) quality_tier = 'medium';

    // Insert query log
    const { data, error } = await supabase
      .from('query_logs')
      .insert({
        query_text,
        manual_id,
        response_text,
        user_id,
        admin_user,
        numeric_flags: JSON.stringify(numeric_flags),
        claim_coverage,
        quality_score,
        quality_tier,
        normalized_query: query_text.toLowerCase().trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting query log:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Query logged:', data.id, 'Quality:', quality_tier, 'Needs verification:', needs_verification);

    return new Response(JSON.stringify({ 
      query_id: data.id, 
      quality_tier,
      needs_verification,
      numeric_flags,
      quality_score
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in training-query:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
