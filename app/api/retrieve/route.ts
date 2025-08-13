import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import path from 'node:path';
import { embedText } from '@/lib/openai';
import { normalizeText, applyAliasExpansion } from '@/utils/text-normalizer';
import { LocalVectorClient } from '@/services/vector-client';
import { QdrantVectorClient } from '@/services/vector-client-qdrant';

const RequestSchema = z.object({
  question: z.string().min(3),
  questionId: z.string().optional(),
  k: z.number().int().min(1).max(20).optional(),
});

type Passage = { materialId: string; page: number; quote: string; score: number; offset: number };

// naive in-memory cache
const cache = new Map<string, { passages: Passage[]; expiresAt: number }>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
    let searcher: { search: (emb: number[], o?: any) => any };
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
    cache.set(cacheKey, { passages: results, expiresAt: now + TTL_MS });
    return NextResponse.json({ success: true, data: payload, cached: false });
  } catch (err) {
    console.error('retrieve error', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Use POST' }, { status: 405 });
}


