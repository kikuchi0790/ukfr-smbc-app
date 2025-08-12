import { NextRequest, NextResponse } from 'next/server';
import { extractKeywordsFromQuestion } from '@/lib/gemini';
import { KeywordCache } from '@/types';
import crypto from 'node:crypto';
import { z } from 'zod';

// API response structure
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  cached?: boolean;
}

// Simple in-memory cache for development
const memoryCache = new Map<string, { data: KeywordCache; expiresAt: number }>();

// Cache duration: 24 hours in milliseconds
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Rate limiting settings
const RATE_LIMIT = 20; // Max requests per minute per client
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Simple rate limiter using memory
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Helper for creating standardized responses
function apiResponse<T>(status: number, success: boolean, data: T | null, error: string | null, cached?: boolean): NextResponse {
  return NextResponse.json({ success, data, error, cached }, { status });
}

// Clean up expired cache entries periodically
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}

// Clean up expired rate limit entries
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}

export async function POST(request: NextRequest) {
  // Clean up periodically
  cleanupCache();
  cleanupRateLimits();

  // Schema for request body
  const RequestSchema = z.object({
    questionId: z.string().min(1),
    question: z.string().min(5),
    options: z.array(z.object({ letter: z.string().min(1), text: z.string().min(1) })).min(2),
    correctAnswer: z.string().min(1),
    explanation: z.string().optional(),
    clientId: z.string().optional(),
  });

  // Get raw body for validation and rate limiting key construction
  let parsedBody: z.infer<typeof RequestSchema>;
  try {
    const body = await request.json();
    const result = RequestSchema.safeParse(body);
    if (!result.success) {
      return apiResponse(400, false, null, 'Invalid request');
    }
    parsedBody = result.data;
  } catch {
    return apiResponse(400, false, null, 'Invalid JSON body');
  }

  // Build stronger rate limit key
  const xff = request.headers.get('x-forwarded-for') || '';
  const xri = request.headers.get('x-real-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const rawKey = `${parsedBody.clientId || ''}|${xri}|${xff}|${ua}`;
  const clientId = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    // Rate Limiting Check
    const now = Date.now();
    const rateLimitEntry = rateLimitMap.get(clientId);
    
    if (rateLimitEntry) {
      if (rateLimitEntry.resetAt < now) {
        // Reset the counter
        rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      } else if (rateLimitEntry.count >= RATE_LIMIT) {
        console.warn(`Rate limit exceeded for client: ${clientId}`);
        return apiResponse(429, false, null, 'Rate limit exceeded. Please try again later.');
      } else {
        // Increment the counter
        rateLimitEntry.count++;
      }
    } else {
      // First request from this client
      rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    const { questionId, question, options, correctAnswer, explanation } = parsedBody;

    // Check cache first
    const cacheEntry = memoryCache.get(questionId);
    if (cacheEntry && cacheEntry.expiresAt > now) {
      console.log(`Cache hit for question ${questionId}`);
      return apiResponse(200, true, { keywords: cacheEntry.data.keywords }, null, true);
    }

    // If not cached, call the Gemini API
    console.log(`Extracting keywords for question ${questionId}`);
    const keywords = await extractKeywordsFromQuestion(
      question,
      options.map((opt: any) => `${opt.letter}. ${opt.text}`),
      correctAnswer,
      explanation || ''
    );

    // Save result to cache
    const cacheData: KeywordCache = {
      questionId,
      keywords,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + CACHE_DURATION_MS).toISOString()
    };
    
    memoryCache.set(questionId, {
      data: cacheData,
      expiresAt: now + CACHE_DURATION_MS
    });

    return apiResponse(200, true, { keywords }, null, false);

  } catch (error) {
    const errorId = `err_${Date.now()}`;
    console.error(`[API Error ${errorId}]`, error);

    if (error instanceof SyntaxError) {
      return apiResponse(400, false, null, `Invalid JSON body. Error ID: ${errorId}`);
    }
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return apiResponse(500, false, null, `API configuration error. Error ID: ${errorId}`);
      }
      if (error.message.includes('rate limit')) {
        return apiResponse(503, false, null, `External API rate limit exceeded. Error ID: ${errorId}`);
      }
    }

    return apiResponse(500, false, null, `Failed to extract keywords. Error ID: ${errorId}`);
  }
}

// OPTIONS リクエストのハンドリング（CORS対応）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}