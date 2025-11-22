-- Update ALL code_assistant_model configs to use exactly gpt-5.1-codex-mini
UPDATE public.ai_config
SET config_value = '"gpt-5.1-codex-mini"'::jsonb,
    updated_at = NOW()
WHERE config_key = 'code_assistant_model';