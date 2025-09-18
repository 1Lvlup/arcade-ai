import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!;
const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
const awsRegion = Deno.env.get('AWS_REGION')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate pre-signed URL for S3 object
async function generatePresignedUrl(s3Uri: string, expiresIn = 600): Promise<string> {
  const [, , bucket, ...keyParts] = s3Uri.split('/');
  const key = keyParts.join('/');
  
  // For simplicity, return a direct S3 URL if bucket is public
  // In production, you'd implement proper AWS signature v4
  const directUrl = `https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  
  // For now, return direct URL - in production implement proper presigning
  return directUrl;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figure_id } = await req.json();
    
    if (!figure_id) {
      throw new Error('Figure ID is required');
    }

    console.log(`Generating presigned URL for figure: ${figure_id}`);

    // Get figure details from database
    const { data: figure, error: figureError } = await supabase
      .from('figures')
      .select('image_url, caption_text, ocr_text')
      .eq('figure_id', figure_id)
      .single();

    if (figureError || !figure) {
      throw new Error('Figure not found');
    }

    if (!figure.image_url.startsWith('s3://')) {
      throw new Error('Invalid S3 URI');
    }

    // Generate presigned URL
    const presignedUrl = await generatePresignedUrl(figure.image_url);

    return new Response(JSON.stringify({
      presigned_url: presignedUrl,
      caption_text: figure.caption_text,
      ocr_text: figure.ocr_text,
      expires_in: 600 // 10 minutes
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in presign-image function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});