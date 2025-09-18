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

async function generatePresignedUrl(s3Uri: string, expiresIn = 600) {
  // s3://bucket/key/… → https://bucket.s3.region.amazonaws.com/key/…
  const [, , bucket, ...keyParts] = s3Uri.split("/");
  const key = keyParts.join("/");
  const base = `https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  const signed = await aws.sign(base, { method: "GET" }, { aws: { signQuery: true, expires: expiresIn } });
  return signed.url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { figure_id } = await req.json();
    if (!figure_id) throw new Error("Figure ID is required");

    const { data: fig, error } = await supabase
      .from("figures")
      .select("image_url, caption_text, ocr_text")
      .eq("figure_id", figure_id)
      .single();

    if (error || !fig) throw new Error("Figure not found");
    if (!fig.image_url.startsWith("s3://")) throw new Error("Invalid S3 URI");

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