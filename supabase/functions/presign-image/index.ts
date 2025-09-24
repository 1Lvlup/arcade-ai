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
    // Get user context from the request headers
    const authHeader = req.headers.get('authorization');
    console.log("Auth header present:", !!authHeader);
    const { figure_id } = await req.json();
    console.log("Requesting figure:", figure_id);
    
    if (!figure_id) throw new Error("Figure ID is required");

    const { data: fig, error } = await supabase
      .from("figures")
      .select("image_url, caption_text, ocr_text, manual_id, fec_tenant_id")
      .eq("figure_id", figure_id)
      .single();

    console.log("Database query result:", { fig, error });

    if (error || !fig) throw new Error("Figure not found");
    if (!fig.image_url || (!fig.image_url.startsWith("s3://") && !fig.image_url.startsWith("https://"))) {
      console.log("Invalid image URL:", fig.image_url);
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