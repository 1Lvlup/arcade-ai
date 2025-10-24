/**
 * Standardized Error Handling for Edge Functions
 * 
 * This module provides consistent error handling across all edge functions:
 * - Structured logging with context
 * - Appropriate HTTP status codes
 * - Sanitized error messages for clients
 * - Request/response tracking
 */

export interface ErrorContext {
  functionName: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Log error with structured context
 */
export function logError(
  error: Error | unknown,
  context: ErrorContext,
  additionalInfo?: Record<string, any>
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  console.error(`❌ [${context.functionName}] Error occurred:`, {
    message: errorObj.message,
    stack: errorObj.stack,
    context: {
      userId: context.userId,
      tenantId: context.tenantId,
      requestId: context.requestId,
      ...context.metadata,
    },
    additional: additionalInfo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: Error | unknown,
  context: ErrorContext,
  statusCode: number = 500
): Response {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  // Log the error
  logError(errorObj, context);
  
  // Sanitize error message for client
  const clientMessage = sanitizeErrorMessage(errorObj.message);
  
  const errorResponse: ErrorResponse = {
    error: clientMessage,
    code: getErrorCode(errorObj),
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
  };
  
  // Add details only in non-production or for known safe errors
  if (Deno.env.get('ENVIRONMENT') !== 'production' || isSafeError(errorObj)) {
    errorResponse.details = errorObj.message;
  }
  
  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

/**
 * Sanitize error messages to avoid leaking sensitive info
 */
function sanitizeErrorMessage(message: string): string {
  // Remove API keys, tokens, passwords
  let sanitized = message
    .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=[REDACTED]')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]')
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=[REDACTED]');
  
  // Map known error patterns to user-friendly messages
  if (message.includes('rate limit') || message.includes('429')) {
    return 'Rate limit exceeded. Please try again later.';
  }
  if (message.includes('unauthorized') || message.includes('401')) {
    return 'Unauthorized. Please check your credentials.';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'Requested resource not found.';
  }
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  return sanitized;
}

/**
 * Get error code from error object
 */
function getErrorCode(error: Error): string | undefined {
  // Check for known error codes
  if ('code' in error) {
    return String((error as any).code);
  }
  
  const message = error.message.toLowerCase();
  if (message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
  if (message.includes('unauthorized')) return 'UNAUTHORIZED';
  if (message.includes('not found')) return 'NOT_FOUND';
  if (message.includes('timeout')) return 'TIMEOUT';
  if (message.includes('validation')) return 'VALIDATION_ERROR';
  
  return 'INTERNAL_ERROR';
}

/**
 * Check if error is safe to expose details to client
 */
function isSafeError(error: Error): boolean {
  const safePatterns = [
    'rate limit',
    'not found',
    'invalid input',
    'validation failed',
    'unauthorized',
  ];
  
  const message = error.message.toLowerCase();
  return safePatterns.some(pattern => message.includes(pattern));
}

/**
 * Wrapper for async edge function handlers with automatic error handling
 */
export function withErrorHandler(
  functionName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`🚀 [${functionName}] Request started:`, {
        requestId,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
      });
      
      const response = await handler(req);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${functionName}] Request completed:`, {
        requestId,
        status: response.status,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return createErrorResponse(
        error,
        {
          functionName,
          requestId,
          metadata: {
            method: req.method,
            url: req.url,
            duration: `${duration}ms`,
          },
        },
        500
      );
    }
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: any,
  requiredFields: string[],
  context: ErrorContext
): void {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    (error as any).code = 'VALIDATION_ERROR';
    logError(error, context);
    throw error;
  }
}

/**
 * Handle OpenAI API errors specifically
 */
export function handleOpenAIError(response: Response, context: ErrorContext): never {
  let message = `OpenAI API error: ${response.status} ${response.statusText}`;
  let code = 'OPENAI_ERROR';
  
  if (response.status === 429) {
    message = 'OpenAI rate limit exceeded. Please try again later.';
    code = 'OPENAI_RATE_LIMIT';
  } else if (response.status === 401) {
    message = 'OpenAI API authentication failed. Please check API key.';
    code = 'OPENAI_AUTH_ERROR';
  } else if (response.status === 500) {
    message = 'OpenAI service is currently unavailable. Please try again.';
    code = 'OPENAI_SERVICE_ERROR';
  }
  
  const error = new Error(message) as any;
  error.code = code;
  error.status = response.status;
  
  logError(error, context);
  throw error;
}
