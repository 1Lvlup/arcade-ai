import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsSignatureV4 } from "https://deno.land/x/aws_sign_v4@1.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!
const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!
const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-2'

// Generate presigned URL for S3 object
async function generatePresignedUrl(imageUrl: string, expiresIn = 600): Promise<string> {
  // Parse S3 URL to extract bucket and key
  let bucket: string
  let key: string
  
  if (imageUrl.startsWith('s3://')) {
    const s3Parts = imageUrl.substring(5).split('/')
    bucket = s3Parts[0]
    key = s3Parts.slice(1).join('/')
  } else if (imageUrl.includes('.s3.') || imageUrl.includes('.amazonaws.com')) {
    const urlParts = new URL(imageUrl)
    if (urlParts.hostname.includes('.s3.')) {
      bucket = urlParts.hostname.split('.')[0]
      key = urlParts.pathname.substring(1)
    } else {
      const pathParts = urlParts.pathname.substring(1).split('/')
      bucket = pathParts[0]
      key = pathParts.slice(1).join('/')
    }
  } else {
    throw new Error('Invalid S3 URL format')
  }

  console.log('Generating presigned URL for:', { bucket, key })

  const signer = new AwsSignatureV4({
    service: 's3',
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  })

  const signedUrl = await signer.sign('GET', new URL(`https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`), {
    headers: {},
    expiresIn
  })

  return signedUrl
}

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

    // Query the figures table
    const { data: figure, error: figureError } = await supabase
      .from('figures')
      .select('image_url, caption_text, ocr_text')
      .eq('figure_id', figure_id)
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
      console.log('Generating presigned URL for S3 object')
      const expiresIn = 600 // 10 minutes
      finalUrl = await generatePresignedUrl(figure.image_url, expiresIn)
      expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      console.log('Generated presigned URL successfully')
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