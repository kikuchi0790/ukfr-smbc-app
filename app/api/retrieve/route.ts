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
});

// LRU cache implementation
class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000;
  private readonly ttlMs = 7 * 24 * 60 * 60 * 1000;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { question, questionId, k } = parsed.data;
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
    };
    const preprocessed = normalizeText(applyAliasExpansion(question, aliasMap));
    const qEmbedding = await embedText(preprocessed);
    const results = await searcher.search(qEmbedding, { k: k ?? 6, mmrLambda: 0.5 });

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


