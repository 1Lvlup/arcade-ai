import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job_id');
    const figure = url.searchParams.get('figure');
    
    if (!jobId || !figure) {
      return new Response('Missing job_id or figure parameter', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY');
    if (!llamaApiKey) {
      return new Response('LlamaCloud API key not configured', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Fetch image from LlamaCloud with auth
    const imageUrl = `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/image/${figure}`;
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${llamaApiKey}`
      }
    });

    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageResponse.status}`);
      return new Response('Image not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Return the image with proper headers
    const imageBlob = await imageResponse.blob();
    
    return new Response(imageBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': imageResponse.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error serving image:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});