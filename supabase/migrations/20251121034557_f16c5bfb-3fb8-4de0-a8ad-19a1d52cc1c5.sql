-- Add Code Assistant model configuration to ai_config
-- Using INSERT without ON CONFLICT since we don't have a unique constraint
INSERT INTO public.ai_config (config_key, config_value, description, fec_tenant_id)
SELECT 
  'code_assistant_model',
  '"gpt-5-mini-2025-08-07"'::jsonb,
  'OpenAI model used for the Code Assistant (faster than full GPT-5)',
  id
FROM public.fec_tenants
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_config 
  WHERE config_key = 'code_assistant_model' 
  AND fec_tenant_id = fec_tenants.id
);