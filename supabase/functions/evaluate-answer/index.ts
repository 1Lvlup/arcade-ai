// supabase/functions/evaluate-answer/index.ts
// Automatically evaluates AI answer quality using GPT-5-mini

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EVALUATION_PROMPT = `You are an AI answer quality evaluator for a technical support system. Your job is to critically assess AI-generated answers to user questions.

Evaluate the answer based on these criteria:

**Accuracy (0-100)**: Does the answer match information from the source documents? Are there any factual errors or hallucinations?

**Completeness (0-100)**: Does it address all parts of the question? Are there important details missing?

**Clarity (0-100)**: Is it easy to understand? Is the language appropriate for a technician?

**Citation Quality (0-100)**: Are page references accurate? Can the user verify the information?

Provide:
1. Overall grade (A/B/C/D/F)
2. Score for each criterion (0-100)
3. List of specific issues found
4. Concrete improvement suggestions
5. What the answer did well (strengths)

Be critical but fair. Focus on actionable feedback.`;

interface EvaluationInput {
  query_log_id: string;
  question: string;
  answer: string;
  source_chunks: Array<{
    content: string;
    page_start?: number;
    page_end?: number;
    score?: number;
  }>;
  fec_tenant_id: string;
}

interface EvaluationResult {
  overall_grade: "A" | "B" | "C" | "D" | "F";
  accuracy_score: number;
  completeness_score: number;
  clarity_score: number;
  citation_quality_score: number;
  issues_found: string[];
  improvement_suggestions: string[];
  strengths: string[];
  evaluation_details: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: EvaluationInput = await req.json();
    console.log(`🔍 Starting evaluation for query_log_id: ${input.query_log_id}`);

    // Build evaluation context
    const sourceContext = input.source_chunks
      .slice(0, 3)
      .map((chunk, idx) => {
        const pageInfo = chunk.page_start ? ` (Page ${chunk.page_start})` : "";
        return `Source ${idx + 1}${pageInfo}:\n${chunk.content}`;
      })
      .join("\n\n---\n\n");

    const evaluationRequest = `
QUESTION:
${input.question}

AI ANSWER:
${input.answer}

SOURCE DOCUMENTS:
${sourceContext}

Evaluate this answer and respond with a JSON object containing:
- overall_grade: one of "A", "B", "C", "D", "F"
- accuracy_score: number 0-100
- completeness_score: number 0-100
- clarity_score: number 0-100
- citation_quality_score: number 0-100
- issues_found: array of specific problems
- improvement_suggestions: array of actionable improvements
- strengths: array of what the answer did well
`;

    // Call OpenAI for evaluation
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        messages: [
          { role: "system", content: EVALUATION_PROMPT },
          { role: "user", content: evaluationRequest },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_completion_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const evaluationText = openaiData.choices[0].message.content;
    
    let evaluation: EvaluationResult;
    try {
      evaluation = JSON.parse(evaluationText);
    } catch (e) {
      console.error("Failed to parse evaluation JSON:", evaluationText);
      throw new Error("Failed to parse evaluation response");
    }

    // Validate and store evaluation
    const { error: insertError } = await supabase
      .from("answer_evaluations")
      .insert({
        query_log_id: input.query_log_id,
        fec_tenant_id: input.fec_tenant_id,
        evaluator_model: "gpt-5-mini-2025-08-07",
        overall_grade: evaluation.overall_grade,
        accuracy_score: Math.min(100, Math.max(0, evaluation.accuracy_score)),
        completeness_score: Math.min(100, Math.max(0, evaluation.completeness_score)),
        clarity_score: Math.min(100, Math.max(0, evaluation.clarity_score)),
        citation_quality_score: Math.min(100, Math.max(0, evaluation.citation_quality_score)),
        issues_found: evaluation.issues_found || [],
        improvement_suggestions: evaluation.improvement_suggestions || [],
        strengths: evaluation.strengths || [],
        evaluation_details: evaluationText,
      });

    if (insertError) {
      console.error("Failed to store evaluation:", insertError);
      throw insertError;
    }

    console.log(`✅ Evaluation complete: ${evaluation.overall_grade} grade`);

    return new Response(
      JSON.stringify({
        success: true,
        evaluation,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Evaluation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
