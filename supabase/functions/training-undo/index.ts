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
    const adminKey = req.headers.get('x-admin-key');
    const ADMIN_API_KEY = Deno.env.get('ADMIN_API_KEY');

    if (!adminKey || adminKey !== ADMIN_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action_type, action_data } = await req.json();

    if (!action_type || !action_data) {
      return new Response(JSON.stringify({ error: 'action_type and action_data required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`⏪ Undo action: ${action_type}`);

    let result;

    switch (action_type) {
      case 'create_example':
        // Delete the training example that was just created
        const { error: deleteError } = await supabase
          .from('training_examples')
          .delete()
          .eq('id', action_data.example_id);

        if (deleteError) {
          throw new Error(`Failed to undo: ${deleteError.message}`);
        }

        result = { success: true, message: 'Training example deleted' };
        break;

      case 'accept':
        // Same as above
        const { error: acceptUndoError } = await supabase
          .from('training_examples')
          .delete()
          .eq('source_query_id', action_data.query_id);

        if (acceptUndoError) {
          throw new Error(`Failed to undo: ${acceptUndoError.message}`);
        }

        result = { success: true, message: 'Accept action reversed' };
        break;

      case 'reject':
        // Delete the feedback entry
        const { error: rejectUndoError } = await supabase
          .from('feedback')
          .delete()
          .eq('query_log_id', action_data.query_id)
          .eq('note', 'Rejected by admin');

        if (rejectUndoError) {
          throw new Error(`Failed to undo: ${rejectUndoError.message}`);
        }

        result = { success: true, message: 'Reject action reversed' };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`✅ Undo complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in undo:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
