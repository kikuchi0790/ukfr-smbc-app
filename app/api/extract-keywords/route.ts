import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { extractKeywordsFromQuestion } from '@/lib/gemini';
import { KeywordCache } from '@/types';

// API response structure
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  cached?: boolean;
}

// Cache duration: 24 hours in seconds
const CACHE_DURATION_SECONDS = 24 * 60 * 60;

// Rate limiting settings
const RATE_LIMIT = 20; // Max requests per minute per client
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Helper for creating standardized responses
function apiResponse<T>(status: number, success: boolean, data: T | null, error: string | null, cached?: boolean): NextResponse {
  return NextResponse.json({ success, data, error, cached }, { status });
}

export async function POST(request: NextRequest) {
  // Get client IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const clientId = forwarded ? forwarded.split(',')[0] : 'anonymous';

  try {
    // Rate Limiting Check
    const rateLimitKey = `rate_limit:extract_keywords:${clientId}`;
    const currentUsage = await kv.get<number>(rateLimitKey) ?? 0;

    if (currentUsage >= RATE_LIMIT) {
      console.warn(`Rate limit exceeded for client: ${clientId}`);
      return apiResponse(429, false, null, 'Rate limit exceeded. Please try again later.');
    }

    // Get request body
    const body = await request.json();
    const { questionId, question, options, correctAnswer, explanation } = body;

    // Validate required parameters
    if (!questionId || !question || !options || !correctAnswer) {
      return apiResponse(400, false, null, 'Missing required parameters');
    }

    // Check cache first
    const cacheKey = `keyword_cache:${questionId}`;
    const cached = await kv.get<KeywordCache>(cacheKey);

    if (cached) {
      console.log(`Cache hit for question ${questionId}`);
      return apiResponse(200, true, { keywords: cached.keywords }, null, true);
    }

    // If not cached, increment rate limit counter and call the Gemini API
    await kv.incr(rateLimitKey);
    await kv.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    console.log(`Extracting keywords for question ${questionId}`);
    const keywords = await extractKeywordsFromQuestion(
      question,
      options.map((opt: any) => `${opt.letter}. ${opt.text}`),
      correctAnswer,
      explanation || ''
    );

    // Save result to cache
    const cacheEntry: KeywordCache = {
      questionId,
      keywords,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CACHE_DURATION_SECONDS * 1000).toISOString()
    };
    await kv.set(cacheKey, cacheEntry, { ex: CACHE_DURATION_SECONDS });

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