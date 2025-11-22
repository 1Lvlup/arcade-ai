-- Update the code assistant model configuration to use a valid OpenAI model
-- The model 'gpt-5.1-codex-mini' does not exist
-- Replacing with 'gpt-5-mini-2025-08-07' which is fast and cost-efficient for code tasks

UPDATE public.ai_config
SET config_value = '"gpt-5-mini-2025-08-07"'::jsonb,
    updated_at = NOW()
WHERE config_key = 'code_assistant_model';

-- If the config doesn't exist yet, insert it
INSERT INTO public.ai_config (config_key, config_value, description)
VALUES (
  'code_assistant_model',
  '"gpt-5-mini-2025-08-07"'::jsonb,
  'AI model used for code assistant - valid options: gpt-5-2025-08-07, gpt-5-mini-2025-08-07, gpt-5-nano-2025-08-07, o3-2025-04-16, o4-mini-2025-04-16'
)
ON CONFLICT (config_key, fec_tenant_id) DO UPDATE
SET config_value = '"gpt-5-mini-2025-08-07"'::jsonb,
    updated_at = NOW();