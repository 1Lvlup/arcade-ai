-- Simple update of chat model to gpt-5-2025-08-07
UPDATE ai_config 
SET config_value = '"gpt-5-2025-08-07"'::jsonb,
    updated_at = NOW()
WHERE config_key = 'chat_model';