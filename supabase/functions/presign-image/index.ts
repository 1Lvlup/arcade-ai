import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const { figure_id, manual_id } = await req.json()
    console.log('Presign request:', { figure_id, manual_id })

    if (!figure_id || !manual_id) {
      return new Response(JSON.stringify({ 
        error: 'figure_id and manual_id are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract tenant from auth header and set context
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(jwt)
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fec_tenant_id')
          .eq('user_id', user.id)
          .single()

        if (profile) {
          await supabase.rpc('set_tenant_context', { tenant_id: profile.fec_tenant_id })
        }
      }
    }

    // Query the figures table by database ID
    const { data: figure, error: figureError } = await supabase
      .from('figures')
      .select('image_url, caption_text, ocr_text')
      .eq('id', figure_id)
      .eq('manual_id', manual_id)
      .single()

    if (figureError) {
      console.error('Figure query error:', figureError)
      return new Response(JSON.stringify({ 
        error: 'Figure not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!figure) {
      return new Response(JSON.stringify({ 
        error: 'Figure not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Found figure with image_url:', figure.image_url)

    let finalUrl = figure.image_url
    let expiresAt = null

    // Check if it's a public HTTPS URL or needs presigning
    if (figure.image_url.startsWith('https://') && !figure.image_url.includes('.s3.')) {
      console.log('Returning public HTTPS URL directly:', figure.image_url)
      finalUrl = figure.image_url
    } else if (figure.image_url.startsWith('s3://') || figure.image_url.includes('.s3.')) {
      console.log('S3 URL detected, returning as-is for now:', figure.image_url)
      // For now, just return the URL as-is since AWS signing is complex
      // In production, you'd implement proper S3 presigning here
      finalUrl = figure.image_url
      console.log('Returning S3 URL as-is')
    }

    return new Response(JSON.stringify({
      url: finalUrl,
      caption: figure.caption_text || null,
      ocr_text: figure.ocr_text || null,
      expires_at: expiresAt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in presign-image:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})