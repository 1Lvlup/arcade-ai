import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const awsRegion = Deno.env.get("AWS_REGION")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const aws = new AwsClient({
  accessKeyId: awsAccessKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: awsRegion,
  service: "s3",
});

async function generatePresignedUrl(imageUrl: string, expiresIn = 600) {
  let bucket: string;
  let key: string;
  
  if (imageUrl.startsWith("s3://")) {
    // s3://bucket/key/… format
    const [, , bucketName, ...keyParts] = imageUrl.split("/");
    bucket = bucketName;
    key = keyParts.join("/");
  } else if (imageUrl.startsWith("https://")) {
    // https://bucket.s3.region.amazonaws.com/key/… format
    const url = new URL(imageUrl);
    bucket = url.hostname.split('.')[0]; // Extract bucket from hostname
    key = url.pathname.substring(1); // Remove leading slash
  } else {
    throw new Error("Invalid image URL format");
  }
  
  const base = `https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  const signed = await aws.sign(base, { method: "GET" }, { aws: { signQuery: true, expires: expiresIn } });
  return signed.url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { figure_id, manual_id } = await req.json();
    console.log("🔍 PRESIGN REQUEST - Figure ID:", figure_id, "Manual ID:", manual_id);
    console.log("🔑 PRESIGN REQUEST - Auth header present:", !!req.headers.get('authorization'));
    console.log("🔑 PRESIGN REQUEST - API key present:", !!req.headers.get('apikey'));
    
    if (!figure_id) {
      console.error("❌ PRESIGN ERROR: Figure ID is required");
      throw new Error("Figure ID is required");
    }
    if (!manual_id) {
      console.error("❌ PRESIGN ERROR: Manual ID is required");
      throw new Error("Manual ID is required");
    }

    // Set tenant context for service access to figures
    console.log(`🔑 PRESIGN CONTEXT - Setting tenant context...`);
    const { data: contextData, error: contextError } = await supabase.rpc('set_tenant_context', { 
      tenant_id: '00000000-0000-0000-0000-000000000001' 
    });
    
    if (contextError) {
      console.error("❌ PRESIGN CONTEXT ERROR:", contextError);
    } else {
      console.log(`✅ PRESIGN CONTEXT - Tenant context set: ${JSON.stringify(contextData)}`);
    }

    console.log("🔍 PRESIGN DB QUERY - About to query figures table...");
    const { data: fig, error } = await supabase
      .from("figures")
      .select("image_url, caption_text, ocr_text, manual_id, fec_tenant_id")
      .eq("figure_id", figure_id)
      .eq("manual_id", manual_id)
      .single();

    console.log("🔍 PRESIGN DB RESULT - Error:", error ? JSON.stringify(error) : "None");
    console.log("🔍 PRESIGN DB RESULT - Figure found:", !!fig);
    console.log("🔍 PRESIGN DB RESULT - Image URL:", fig?.image_url || "None");

    if (error || !fig) throw new Error("Figure not found");
    if (!fig.image_url) {
      throw new Error("No image URL found for figure");
    }

    // If the image URL is already a public HTTPS URL, return it directly
    if (fig.image_url.startsWith("https://")) {
      console.log("Returning public HTTPS URL directly:", fig.image_url);
      return new Response(JSON.stringify({
        presigned_url: fig.image_url,
        caption_text: fig.caption_text,
        ocr_text: fig.ocr_text,
        expires_in: null, // No expiration for public URLs
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // For s3:// URLs, generate a presigned URL
    if (!fig.image_url.startsWith("s3://")) {
      console.log("Invalid image URL format:", fig.image_url);
      throw new Error("Invalid image URL format");
    }

    console.log("Generating presigned URL for:", fig.image_url);
    const url = await generatePresignedUrl(fig.image_url, 600);

    return new Response(JSON.stringify({
      presigned_url: url,
      caption_text: fig.caption_text,
      ocr_text: fig.ocr_text,
      expires_in: 600,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("presign-image error:", error);
    return new Response(JSON.stringify({ error: error.message, details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});