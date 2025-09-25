import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

// Enhance figure with AI
async function enhanceFigureWithAI(imageData: string, context: string): Promise<{caption: string | null, ocrText: string | null}> {
  if (!openaiApiKey) {
    console.log('No OpenAI API key configured, skipping AI enhancement')
    return { caption: null, ocrText: null }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing technical diagrams and arcade game manuals. 
            Analyze the provided image and extract:
            1. A clear, technical description of what the image shows
            2. Any text visible in the image (OCR)
            
            Context: ${context}
            
            Respond in JSON format:
            {
              "caption": "Technical description of the image",
              "ocr_text": "Any text found in the image"
            }`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI API error:', response.status)
      return { caption: null, ocrText: null }
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    try {
      const parsed = JSON.parse(content)
      return {
        caption: parsed.caption || null,
        ocrText: parsed.ocr_text || null
      }
    } catch {
      // If JSON parsing fails, try to extract from text
      return {
        caption: content.substring(0, 500),
        ocrText: null
      }
    }

  } catch (error) {
    console.error('Error in AI enhancement:', error)
    return { caption: null, ocrText: null }
  }
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
    console.log('Enhancement request:', { figure_id, manual_id })

    // Build query
    let query = supabase
      .from('figures')
      .select('id, figure_id, manual_id, image_url, caption_text, ocr_text')

    if (figure_id) {
      query = query.eq('figure_id', figure_id)
    }
    if (manual_id) {
      query = query.eq('manual_id', manual_id)
    }

    // Limit to 10 figures max for batch processing
    query = query.limit(10)

    const { data: figures, error: figuresError } = await query

    if (figuresError) {
      console.error('Error fetching figures:', figuresError)
      return new Response(JSON.stringify({ 
        error: figuresError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!figures || figures.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No figures found',
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing ${figures.length} figures`)

    const results = []

    for (const figure of figures) {
      try {
        console.log(`Processing figure ${figure.figure_id}`)

        let imageData = figure.image_url

        // If it's an S3 URL, try to get a presigned URL
        if (figure.image_url && (figure.image_url.startsWith('s3://') || figure.image_url.includes('.s3.'))) {
          try {
            const presignResponse = await supabase.functions.invoke('presign-image', {
              body: {
                figure_id: figure.figure_id,
                manual_id: figure.manual_id
              }
            })

            if (presignResponse.data && presignResponse.data.url) {
              imageData = presignResponse.data.url
              console.log('Got presigned URL for S3 image')
            }
          } catch (presignError) {
            console.error('Error getting presigned URL:', presignError)
            // Continue with original URL
          }
        }

        // Enhance with AI
        const context = `This is a figure from manual: ${figure.manual_id}. Figure ID: ${figure.figure_id}`
        const enhancement = await enhanceFigureWithAI(imageData, context)

        // Update the figure if we got useful data
        if (enhancement.caption || enhancement.ocrText) {
          const updates: any = {}
          if (enhancement.caption) updates.caption_text = enhancement.caption
          if (enhancement.ocrText) updates.ocr_text = enhancement.ocrText

          const { error: updateError } = await supabase
            .from('figures')
            .update(updates)
            .eq('id', figure.id)

          if (updateError) {
            console.error('Error updating figure:', updateError)
          } else {
            console.log(`Updated figure ${figure.figure_id} successfully`)
          }
        }

        results.push({
          figure_id: figure.figure_id,
          manual_id: figure.manual_id,
          enhanced: !!(enhancement.caption || enhancement.ocrText),
          caption: enhancement.caption,
          ocr_text: enhancement.ocrText
        })

      } catch (figureError) {
        console.error(`Error processing figure ${figure.figure_id}:`, figureError)
        results.push({
          figure_id: figure.figure_id,
          manual_id: figure.manual_id,
          enhanced: false,
          error: figureError.message
        })
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${figures.length} figures`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in test-enhancement:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})