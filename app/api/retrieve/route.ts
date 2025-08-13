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
  question: z.string().min(3).max(5000),
  questionId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  k: z.number().int().min(1).max(20).optional(),
  useFullQuestion: z.boolean().optional(),
  explanation: z.string().optional(),  // Add explanation from answer
  useAdvancedSearch: z.boolean().optional()  // Enable advanced multi-stage search
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

function extractKeyPhrases(question: string, explanation?: string): string {
  // Remove options if they exist
  const withoutOptions = question.split(/\n[A-E]\.\s/)[0];
  
  // Extract key phrases with improved logic
  const mainQuestion = withoutOptions.trim();
  
  // If we have an explanation, combine intelligently
  if (explanation) {
    // Extract key information from both question and explanation
    const keyInfo = `${mainQuestion} ${explanation}`.slice(0, 400);
    return keyInfo;
  }
  
  if (mainQuestion.length > 200) {
    // Try to find the actual question part (often after context)
    const questionParts = mainQuestion.split(/[？。]/);
    const lastPart = questionParts[questionParts.length - 1].trim();
    if (lastPart.length > 50) {
      return lastPart.slice(0, 200);
    }
    return mainQuestion.slice(-200);
  }
  
  return mainQuestion;
}

// Extract numerical amounts from text
function extractAmounts(text: string): string[] {
  const amountRegex = /£[\d,]+|\d{2,3},\d{3}ポンド|＄[\d,]+|\d+%/g;
  const matches = text.match(amountRegex) || [];
  return [...new Set(matches)];
}

// Expand query with GPT-5 for better search
async function expandQueryWithGPT(question: string, explanation?: string): Promise<string[]> {
  try {
    const { getOpenAIClient } = await import('@/lib/openai');
    const openai = getOpenAIClient();
    
    const prompt = `Given this Japanese financial regulation question, generate 3 search queries in English that would find the relevant educational material.

Question: ${question}
${explanation ? `Explanation: ${explanation}` : ''}

Focus on:
1. Specific amounts/numbers mentioned
2. Key institutions (FSCS, FCA, PRA)
3. Core concepts (deposit protection, compensation scheme)

Return JSON array of 3 search queries.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5-2025-08-07',  // Using GPT-5 for superior query expansion
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return result.queries || [];
  } catch (error) {
    console.error('Query expansion failed:', error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { question, questionId, k, useFullQuestion, explanation, useAdvancedSearch } = parsed.data;
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
    
    // Advanced query processing
    let queries: string[] = [];
    let embeddings: number[][] = [];
    
    if (useAdvancedSearch) {
      // Use GPT-5 for query expansion
      const expandedQueries = await expandQueryWithGPT(question, explanation);
      queries = expandedQueries.length > 0 ? expandedQueries : [extractKeyPhrases(question, explanation)];
      
      // Also add amount-specific queries if amounts are found
      const amounts = extractAmounts(question + (explanation || ''));
      if (amounts.length > 0) {
        queries.push(`FSCS compensation ${amounts.join(' ')}`);
        queries.push(`deposit guarantee ${amounts.join(' ')}`);
      }
      
      console.log('[RAG Advanced] Expanded queries:', queries);
      
      // Generate embeddings for all queries
      const { embedTexts } = await import('@/lib/openai');
      embeddings = await embedTexts(queries.map(q => normalizeText(applyAliasExpansion(q, aliasMap))));
    } else {
      // Standard single query
      const queryToProcess = useFullQuestion ? question : extractKeyPhrases(question, explanation);
      const preprocessed = normalizeText(applyAliasExpansion(queryToProcess, aliasMap));
      const qEmbedding = await embedText(preprocessed);
      embeddings = [qEmbedding];
      queries = [queryToProcess];
    }
    // Extract amounts and sections for hybrid search
    const extractedAmounts = extractAmounts(question + (explanation || ''));
    const sectionKeywords = ['fscs', 'compensation scheme', 'scheme limits', 'deposit', 'insurance'];
    
    // Multi-query search and fusion
    let allResults: any[] = [];
    const resultMap = new Map<string, any>();
    
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const query = queries[i];
      
      // Enhanced search with hybrid capabilities
      const searchOptions: any = {
        k: useAdvancedSearch ? 15 : (k ?? 6),  // Get more results for fusion
        mmrLambda: 0.7,
        minScore: useAdvancedSearch ? 0.6 : 0.65  // Lower threshold for multi-query
      };
      
      // Add hybrid search options if available (LocalVectorClient supports these)
      if (extractedAmounts.length > 0) {
        searchOptions.hybridAmounts = extractedAmounts;
      }
      if (sectionKeywords.length > 0) {
        searchOptions.hybridSections = sectionKeywords;
      }
      
      // Search with each embedding
      const results = await searcher.search(embedding, searchOptions);
      
      console.log(`[RAG Multi-Query ${i+1}] Query: "${query.slice(0, 50)}..." found ${results.length} results`);
      
      // Fusion: combine results with score boosting
      results.forEach(result => {
        const key = `${result.materialId}_${result.page}_${result.offset}`;
        if (resultMap.has(key)) {
          // Boost score if found by multiple queries
          const existing = resultMap.get(key);
          existing.score = Math.max(existing.score, result.score) * 1.1;  // 10% boost
          existing.queryHits = (existing.queryHits || 1) + 1;
        } else {
          resultMap.set(key, { ...result, queryHits: 1 });
        }
      });
    }
    
    // Sort by combined score and query hits
    allResults = Array.from(resultMap.values())
      .sort((a, b) => {
        // Prioritize results found by multiple queries
        if (a.queryHits !== b.queryHits) {
          return b.queryHits - a.queryHits;
        }
        return b.score - a.score;
      })
      .slice(0, k ?? 6);
    
    const results = allResults;
    
    // Enhanced debug logging
    console.log('[RAG Debug] Search completed:', {
      mode: useAdvancedSearch ? 'advanced' : 'standard',
      queriesUsed: queries.length,
      resultsCount: results.length,
      topResults: results.slice(0, 3).map(r => ({
        materialId: r.materialId,
        page: r.page,
        score: r.score.toFixed(3),
        queryHits: r.queryHits || 1,
        snippet: r.quote.slice(0, 80)
      })),
      extractedAmounts: extractAmounts(question + (explanation || ''))
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


