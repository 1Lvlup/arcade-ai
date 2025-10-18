# AI Model Configuration Guide

This document explains which AI models are used where in the system and how to configure them.

## Overview

The system uses different models for different purposes to optimize cost, speed, and quality:

1. **User-Facing Chatbot** - Configured via database (`ai_config` table)
2. **Backend Operations** - Configured via `BACKEND_MODEL` secret

---

## 1. User-Facing Chatbot (Production Chat)

**Used for**: Answering user questions in the chat interface

**Configuration**: 
- **Database Table**: `ai_config`
- **Config Key**: `chat_model`
- **Config Value**: Model name as JSON string (e.g., `"gpt-5-chat-latest"`)

**How to Change**:
1. Go to Supabase dashboard
2. Open SQL Editor
3. Run this query:
```sql
UPDATE ai_config 
SET config_value = '"gpt-5-chat-latest"'::jsonb
WHERE config_key = 'chat_model';
```

**Models Available**:
- `gpt-5-chat-latest` - Latest GPT-5 chat model (recommended for production)
- `gpt-4o` - GPT-4 Omni (legacy, but reliable)
- `gpt-4o-mini` - Faster, cheaper GPT-4 variant

**Where Used**: 
- `supabase/functions/chat-manual/index.ts` (line ~40: fetches from `ai_config` table)

---

## 2. Backend Operations

**Used for**: 
- Golden question generation
- Golden question answer grading
- Internal RAG operations (embeddings, etc.)

**Configuration**:
- **Secret Name**: `BACKEND_MODEL`
- **Default Value**: `gpt-5-2025-08-07`

**How to Change**:
1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Update the `BACKEND_MODEL` secret value
3. Valid values:
   - `gpt-5-2025-08-07` (recommended - flagship GPT-5)
   - `gpt-5-mini-2025-08-07` (faster, cheaper)
   - `gpt-4o` (legacy model)

**Where Used**:
- `supabase/functions/generate-golden-questions/index.ts` (line 16)
- `supabase/functions/evaluate-manual/index.ts` (line 16)
- `supabase/functions/chat-manual/index.ts` (line 21 - for internal operations only, NOT for user responses)

---

## Model Selection Guide

### When to use GPT-5 (gpt-5-2025-08-07):
- Production chatbot (via `chat_model` in database)
- Golden question generation (via `BACKEND_MODEL`)
- When you need best quality and reasoning

### When to use GPT-5 Chat (gpt-5-chat-latest):
- User-facing chat responses
- Conversational interactions
- Optimized for dialogue

### When to use GPT-5 Mini (gpt-5-mini-2025-08-07):
- High-volume backend tasks
- Cost optimization
- When quality/speed tradeoff favors speed

### When to use GPT-4 models:
- Fallback if GPT-5 has issues
- Legacy compatibility
- Budget constraints (gpt-4o-mini is very cheap)

---

## Important Notes

### GPT-5 API Differences
**CRITICAL**: GPT-5 and newer models (gpt-4.1+, o3, o4) have different API parameters:

✅ **Correct for GPT-5+**:
```typescript
{
  model: "gpt-5-2025-08-07",
  max_completion_tokens: 16000,  // Use this, not max_tokens
  // DO NOT include temperature - not supported
  messages: [...]
}
```

❌ **Wrong for GPT-5+**:
```typescript
{
  model: "gpt-5-2025-08-07",
  max_tokens: 16000,      // Wrong parameter name
  temperature: 0.7,       // Not supported - will error
  messages: [...]
}
```

✅ **Correct for GPT-4 (legacy)**:
```typescript
{
  model: "gpt-4o",
  max_tokens: 16000,      // Correct for GPT-4
  temperature: 0.7,       // Supported on GPT-4
  messages: [...]
}
```

### Checking Current Configuration

**User Chat Model**:
```sql
SELECT config_value 
FROM ai_config 
WHERE config_key = 'chat_model';
```

**Backend Model**:
Check Supabase Dashboard → Settings → Edge Functions → Secrets → `BACKEND_MODEL`

---

## Troubleshooting

### "Invalid parameter: temperature" error
- **Cause**: Using temperature parameter with GPT-5
- **Fix**: Remove temperature from request, or switch to GPT-4 model

### "Invalid parameter: max_tokens" error  
- **Cause**: Using max_tokens instead of max_completion_tokens with GPT-5
- **Fix**: Change to max_completion_tokens, or switch to GPT-4 model

### Chatbot using wrong model
- **Check**: Query the `ai_config` table to verify chat_model setting
- **Fix**: Update via SQL query shown above

### Golden questions using wrong model
- **Check**: Verify `BACKEND_MODEL` secret in Supabase dashboard
- **Fix**: Update the secret value and redeploy functions

---

## Summary Table

| Purpose | Configuration Method | Current Value | Where to Change |
|---------|---------------------|---------------|-----------------|
| User Chat Responses | Database: `ai_config.chat_model` | `gpt-5-chat-latest` | SQL query or AI Config UI |
| Golden Question Generation | Secret: `BACKEND_MODEL` | `gpt-5-2025-08-07` | Supabase Dashboard → Secrets |
| Question Grading | Secret: `BACKEND_MODEL` | `gpt-5-2025-08-07` | Supabase Dashboard → Secrets |
| Backend RAG Operations | Secret: `BACKEND_MODEL` | `gpt-5-2025-08-07` | Supabase Dashboard → Secrets |

---

**Last Updated**: 2025-10-18
