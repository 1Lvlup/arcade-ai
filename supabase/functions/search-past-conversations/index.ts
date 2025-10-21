import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, user_id } = await req.json();

    if (!query || !user_id) {
      return new Response(
        JSON.stringify({ error: 'query and user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's past conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (convError) throw convError;
    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all messages from those conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds);

    if (msgError) throw msgError;

    // Simple keyword matching (you could upgrade to embeddings later)
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ').filter(w => w.length > 3);

    const matches = conversations
      .map(conv => {
        const convMessages = messages?.filter(m => m.conversation_id === conv.id) || [];
        const userMessages = convMessages.filter(m => m.role === 'user');
        const assistantMessages = convMessages.filter(m => m.role === 'assistant');

        // Calculate relevance score
        let score = 0;
        const allText = [...userMessages, ...assistantMessages]
          .map(m => m.content.toLowerCase())
          .join(' ');

        keywords.forEach(keyword => {
          if (allText.includes(keyword)) score += 1;
        });

        if (score === 0) return null;

        return {
          conversation_id: conv.id,
          title: conv.title,
          date: conv.created_at,
          relevance_score: score,
          preview: userMessages[0]?.content.slice(0, 150) || '',
          solution: assistantMessages[0]?.content.slice(0, 200) || ''
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.relevance_score - a!.relevance_score)
      .slice(0, 3);

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
