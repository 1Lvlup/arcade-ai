import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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

    const { query_ids, action, user_id } = await req.json();

    if (!query_ids || !Array.isArray(query_ids) || query_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'query_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['accept', 'reject', 'flag'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    console.log(`📦 Bulk ${action} for ${query_ids.length} items`);

    // Fetch the queries
    const { data: queries, error: fetchError } = await supabase
      .from('query_logs')
      .select('*')
      .in('id', query_ids);

    if (fetchError) {
      console.error('Error fetching queries:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch queries' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (action === 'accept') {
      // Validate all items before accepting
      for (const query of queries || []) {
        const hasNumbers = query.numeric_flags && 
          (Array.isArray(query.numeric_flags) ? query.numeric_flags.length > 0 : 
           typeof query.numeric_flags === 'string' && JSON.parse(query.numeric_flags).length > 0);
        
        if (hasNumbers) {
          results.errors.push(`Query ${query.id.substring(0, 8)} has unverified numbers`);
          results.failed++;
          continue;
        }

        // Create training example
        try {
          const { error: insertError } = await supabase
            .from('training_examples')
            .insert({
              question: query.query_text,
              expected_answer: query.response_text,
              context: '', // Would need to fetch from citations
              model_type: 'troubleshooting',
              user_id: user_id || '00000000-0000-0000-0000-000000000000',
              source_query_id: query.id,
              is_approved: true,
              verified_at: new Date().toISOString(),
              verified_by: 'admin_bulk',
            });

          if (insertError) {
            results.errors.push(`Failed to create example for ${query.id.substring(0, 8)}`);
            results.failed++;
          } else {
            results.succeeded++;
          }
        } catch (err) {
          results.errors.push(`Exception for ${query.id.substring(0, 8)}: ${err}`);
          results.failed++;
        }
        
        results.processed++;
      }
    } else if (action === 'reject') {
      // Mark as rejected in feedback table
      for (const query of queries || []) {
        try {
          const { error: feedbackError } = await supabase
            .from('feedback')
            .insert({
              query_log_id: query.id,
              rating: 'negative',
              note: 'Bulk rejected by admin',
              converted_to_training: false,
            });

          if (feedbackError) {
            results.errors.push(`Failed to reject ${query.id.substring(0, 8)}`);
            results.failed++;
          } else {
            results.succeeded++;
          }
        } catch (err) {
          results.errors.push(`Exception for ${query.id.substring(0, 8)}: ${err}`);
          results.failed++;
        }
        
        results.processed++;
      }
    } else if (action === 'flag') {
      // Flag for review
      for (const query of queries || []) {
        try {
          const { error: feedbackError } = await supabase
            .from('feedback')
            .insert({
              query_log_id: query.id,
              rating: 'neutral',
              note: 'Flagged for further review by admin',
              converted_to_training: false,
            });

          if (feedbackError) {
            results.errors.push(`Failed to flag ${query.id.substring(0, 8)}`);
            results.failed++;
          } else {
            results.succeeded++;
          }
        } catch (err) {
          results.errors.push(`Exception for ${query.id.substring(0, 8)}: ${err}`);
          results.failed++;
        }
        
        results.processed++;
      }
    }

    console.log(`✅ Bulk action complete:`, results);

    return new Response(JSON.stringify({
      success: true,
      action,
      total: query_ids.length,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bulk action:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
