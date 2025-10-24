/**
 * Centralized Model Configuration
 * 
 * This file defines all AI models used across the system.
 * Update these values to change models globally.
 * 
 * SECRETS (configured in Supabase):
 * - CHAT_MODEL: User-facing chat model (default: gpt-5-chat-latest)
 * - BACKEND_MODEL: Backend operations like Q&A generation, grading (default: gpt-5-2025-08-07)
 */

export const MODEL_CONFIG = {
  // Embedding model for vector search
  embedding: {
    model: 'text-embedding-3-small',
    provider: 'openai',
    use_case: 'Vector embeddings for semantic search',
  },

  // Reranking model for search result optimization
  reranking: {
    model: 'rerank-english-v3.0',
    provider: 'cohere',
    use_case: 'Reranking search results for better relevance',
  },

  // Vision models for image processing
  vision: {
    ocr: {
      model: 'gpt-4.1',
      provider: 'openai',
      use_case: 'OCR text extraction from figures',
    },
    caption: {
      model: 'gpt-4.1',
      provider: 'openai',
      use_case: 'Generating captions for figures',
    },
    classification: {
      model: 'gpt-4o',
      provider: 'openai',
      use_case: 'Classifying figure types',
    },
  },

  // Image generation
  imageGen: {
    model: 'gpt-image-1',
    provider: 'openai',
    use_case: 'Generating images from text prompts',
    settings: {
      defaultSize: '1024x1024',
      defaultQuality: 'auto',
      defaultFormat: 'png',
    },
  },

  // Chat models (from secrets)
  chat: {
    // User-facing chat responses - uses CHAT_MODEL secret
    getChatModel: () => Deno.env.get('CHAT_MODEL') || 'gpt-5-chat-latest',
    use_case: 'User-facing Q&A responses',
  },

  // Backend operations (from secrets)
  backend: {
    // Backend operations - uses BACKEND_MODEL secret
    getBackendModel: () => Deno.env.get('BACKEND_MODEL') || 'gpt-5-2025-08-07',
    use_case: 'Golden question generation, answer grading, RAG operations',
  },
};

/**
 * Helper to check if a model is GPT-5 or newer
 */
export function isGpt5OrNewer(model: string): boolean {
  return model.startsWith('gpt-5') || 
         model.startsWith('o3') || 
         model.startsWith('o4') ||
         model.startsWith('gpt-4.1');
}

/**
 * Get appropriate token parameter name for model
 */
export function getTokenParamName(model: string): string {
  return isGpt5OrNewer(model) ? 'max_completion_tokens' : 'max_tokens';
}

/**
 * Check if model supports temperature parameter
 */
export function supportsTemperature(model: string): boolean {
  // GPT-5, O3, O4 don't support temperature
  return !model.startsWith('gpt-5') && 
         !model.startsWith('o3') && 
         !model.startsWith('o4');
}
