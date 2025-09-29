import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const llamacloudApiKey = Deno.env.get('LLAMACLOUD_API_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Manual test upload starting...');
    
    // Test with a simple file URL that we know works
    const testFileUrl = 'https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-file.pdf';
    
    const formData = new FormData();
    formData.append('input_url', testFileUrl);
    formData.append('parsing_instruction', 'Extract all text content from this document.');
    formData.append('result_type', 'markdown');
    formData.append('invalidate_cache', 'true');
    
    // Use test webhook for debugging
    const webhookUrl = `${supabaseUrl}/functions/v1/test-webhook`;
    formData.append('webhook_url', webhookUrl);
    
    console.log('🔗 Using webhook URL:', webhookUrl);
    console.log('📄 Using test file URL:', testFileUrl);

    // Submit to LlamaCloud
    const llamaResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llamacloudApiKey}`,
      },
      body: formData,
    });

    const responseText = await llamaResponse.text();
    console.log('📤 LlamaCloud response status:', llamaResponse.status);
    console.log('📤 LlamaCloud response headers:', Object.fromEntries(llamaResponse.headers.entries()));
    console.log('📤 LlamaCloud response body:', responseText);

    if (!llamaResponse.ok) {
      throw new Error(`LlamaCloud API error: ${llamaResponse.status} - ${responseText}`);
    }

    const llamaData = JSON.parse(responseText);
    
    return new Response(JSON.stringify({ 
      success: true, 
      job_id: llamaData.id,
      status: llamaData.status,
      webhook_url: webhookUrl,
      test_file_url: testFileUrl,
      message: 'Test upload submitted successfully. Check test-webhook logs for callback.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Manual test upload error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});