import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Lead {
  id: string;
  company_id: string;
  stage: string;
  priority_tier: string | null;
  last_contacted: string | null;
  momentum_score: number | null;
  momentum_trend: string | null;
}

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  timestamp: string;
  content: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { lead_id } = body;

    console.log('Recalculate momentum request:', { lead_id: lead_id || 'all active leads' });

    // Fetch leads to process
    let leadsQuery = supabase
      .from('leads')
      .select('id, company_id, stage, priority_tier, last_contacted, momentum_score, momentum_trend');

    if (lead_id) {
      leadsQuery = leadsQuery.eq('id', lead_id);
    } else {
      leadsQuery = leadsQuery.not('stage', 'in', '("Won","Lost")');
    }

    const { data: leads, error: leadsError } = await leadsQuery;

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads', details: leadsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${leads.length} lead(s)`);

    const results = [];

    for (const lead of leads as Lead[]) {
      console.log(`Processing lead ${lead.id}`);

      // Calculate momentum score
      let score = 50;
      const previousScore = lead.momentum_score;

      // 1. Priority tier adjustment
      if (lead.priority_tier === 'A') {
        score += 20;
      } else if (lead.priority_tier === 'B') {
        score += 10;
      }
      // C or null = +0

      // 2. Stage weight
      switch (lead.stage) {
        case 'New':
          score -= 5;
          break;
        case 'Researching':
        case 'Contacted':
          score += 0;
          break;
        case 'Discovery':
          score += 5;
          break;
        case 'Demo':
        case 'Eval':
          score += 10;
          break;
        case 'Won':
          score = 100;
          break;
        case 'Lost':
          score = 0;
          break;
      }

      // 3. Time since last_contacted
      if (lead.last_contacted === null) {
        score -= 10;
      } else {
        const lastContactedDate = new Date(lead.last_contacted);
        const now = new Date();
        const daysSinceLastContacted = Math.floor(
          (now.getTime() - lastContactedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastContacted <= 2) {
          score += 10;
        } else if (daysSinceLastContacted <= 7) {
          score += 5;
        } else if (daysSinceLastContacted <= 14) {
          score += 0;
        } else {
          score -= 10;
        }
      }

      // 4. Activity volume (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentActivities, error: activitiesError } = await supabase
        .from('activities')
        .select('id')
        .eq('lead_id', lead.id)
        .gte('timestamp', sevenDaysAgo.toISOString());

      if (activitiesError) {
        console.error(`Error fetching activities for lead ${lead.id}:`, activitiesError);
      } else {
        const activityCount7d = recentActivities?.length || 0;

        if (activityCount7d === 0) {
          score -= 10;
        } else if (activityCount7d <= 3) {
          score += 5;
        } else if (activityCount7d <= 10) {
          score += 10;
        } else {
          score += 5; // diminishing returns
        }
      }

      // 5. Recent demo planning (last 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: demoActivities, error: demoError } = await supabase
        .from('activities')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('activity_type', 'demo_plan')
        .gte('timestamp', fourteenDaysAgo.toISOString())
        .limit(1);

      if (demoError) {
        console.error(`Error fetching demo activities for lead ${lead.id}:`, demoError);
      } else if (demoActivities && demoActivities.length > 0) {
        score += 10;
      }

      // 6. Clamp score to 0-100
      score = Math.max(0, Math.min(100, score));

      // 7. Calculate momentum trend
      let trend = 'flat';
      if (previousScore === null || previousScore === undefined) {
        trend = 'flat';
      } else if (score >= previousScore + 5) {
        trend = 'rising';
      } else if (score <= previousScore - 5) {
        trend = 'falling';
      }

      // 8. Update the lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          momentum_score: score,
          momentum_trend: trend,
          momentum_last_calculated: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Error updating lead ${lead.id}:`, updateError);
      } else {
        console.log(`Updated lead ${lead.id}: score=${score}, trend=${trend}`);
        results.push({
          lead_id: lead.id,
          momentum_score: score,
          momentum_trend: trend,
          previous_score: previousScore,
        });
      }
    }

    // Return response
    if (lead_id) {
      const result = results[0];
      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'single',
          lead_id: result.lead_id,
          momentum_score: result.momentum_score,
          momentum_trend: result.momentum_trend,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'bulk',
          processed_leads: results.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in recalculate-lead-momentum function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
