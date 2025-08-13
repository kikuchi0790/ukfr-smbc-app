import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import path from 'node:path';
import { embedText } from '@/lib/openai';
import { normalizeText, applyAliasExpansion } from '@/utils/text-normalizer';
import { LocalVectorClient } from '@/services/vector-client';
import { QdrantVectorClient } from '@/services/vector-client-qdrant';
import type { CacheEntry, VectorSearcher } from '@/types/rag';

const RequestSchema = z.object({
  question: z.string().min(3).max(5000), // Add max length for security
  questionId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(), // Validate format
  k: z.number().int().min(1).max(20).optional(),
  useFullQuestion: z.boolean().optional(), // Option to use full question for backward compatibility
});

// LRU cache implementation
class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000;
  private readonly ttlMs = 24 * 60 * 60 * 1000; // Reduced from 7 days to 24 hours

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, passages: CacheEntry['passages']): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      passages,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new LRUCache();

function makeKey(input: unknown): string {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getIndexPath(): string {
  // The index is stored under services/data/materials_index.json
  return path.join(process.cwd(), 'services', 'data', 'materials_index.json');
}

function extractKeyPhrases(question: string): string {
  // Remove options if they exist (they usually start with "A.", "B.", etc.)
  const withoutOptions = question.split(/\n[A-E]\.\s/)[0];
  
  // Extract key phrases (first 200 chars if long, focusing on the actual question)
  const mainQuestion = withoutOptions.trim();
  if (mainQuestion.length > 200) {
    // Try to find the actual question part (often after context)
    const questionParts = mainQuestion.split(/[？。]/);
    const lastPart = questionParts[questionParts.length - 1].trim();
    if (lastPart.length > 50) {
      return lastPart.slice(0, 200);
    }
    return mainQuestion.slice(-200); // Take last 200 chars which usually contain the actual question
  }
  
  return mainQuestion;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { question, questionId, k, useFullQuestion } = parsed.data;
    const cacheKey = makeKey(questionId ? `qid:${questionId}` : question);
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ success: true, data: { passages: cached.passages }, cached: true });
    }

    const useQdrant = process.env.VECTOR_BACKEND === 'qdrant' && process.env.QDRANT_URL;
    let searcher: VectorSearcher;
    
    try {
      if (useQdrant) {
        searcher = new QdrantVectorClient({
          url: process.env.QDRANT_URL as string,
          apiKey: process.env.QDRANT_API_KEY,
          collection: process.env.QDRANT_COLLECTION || 'materials_passages',
        });
      } else {
        const indexPath = getIndexPath();
        searcher = new LocalVectorClient(indexPath);
      }
    } catch (initError) {
      console.error('Failed to initialize vector searcher:', initError);
      // Fallback to local if Qdrant fails
      if (useQdrant) {
        console.warn('Falling back to local vector search');
        const indexPath = getIndexPath();
        searcher = new LocalVectorClient(indexPath);
      } else {
        throw initError;
      }
    }
    // Normalize and alias-expand query to align with index preprocessing
    const aliasMap: Record<string, string> = {
      'fca': 'financial conduct authority',
      'pra': 'prudential regulation authority',
      'fsma': 'financial services and markets act',
      'cobs': 'conduct of business sourcebook',
      'cisi': 'chartered institute for securities and investment',
      'mifid': 'markets in financial instruments directive',
      'prin': 'principles for businesses',
      'sysc': 'senior management arrangements systems and controls',
      'fit': 'fit and proper test',
      'smcr': 'senior managers and certification regime',
      'mar': 'market abuse regulation',
      'aml': 'anti money laundering',
      'kyc': 'know your customer',
      'tcf': 'treating customers fairly',
      'rdr': 'retail distribution review',
    };
    
    // Use optimized query unless full question is explicitly requested
    const queryToProcess = useFullQuestion ? question : extractKeyPhrases(question);
    const preprocessed = normalizeText(applyAliasExpansion(queryToProcess, aliasMap));
    const qEmbedding = await embedText(preprocessed);
    const results = await searcher.search(qEmbedding, { k: k ?? 6, mmrLambda: 0.7 }); // Increased from 0.5 to 0.7 for better accuracy
    
    // Debug logging for RAG search results
    console.log('[RAG Debug] Query processed:', {
      original: question.slice(0, 100),
      optimized: queryToProcess.slice(0, 100),
      preprocessed: preprocessed.slice(0, 100),
      resultsCount: results.length,
      topResults: results.slice(0, 3).map(r => ({
        materialId: r.materialId,
        page: r.page,
        score: r.score,
        snippet: r.quote.slice(0, 50)
      }))
    });

    const payload = { passages: results };
    cache.set(cacheKey, results);
    return NextResponse.json({ success: true, data: payload, cached: false });
  } catch (err) {
    console.error('[/api/retrieve] Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: errorMessage, fallback: true },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Use POST' }, { status: 405 });
}


