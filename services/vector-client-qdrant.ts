import { QdrantClient } from '@qdrant/js-client-rest';
import { cosineSimilarity } from './vector-client';
import type { RetrievedPassage, VectorSearcher, VectorSearchOptions, QdrantPayload } from '@/types/rag';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

export class QdrantVectorClient implements VectorSearcher {
  private client: QdrantClient;
  private collection: string;

  constructor(cfg: QdrantConfig) {
    this.client = new QdrantClient({ url: cfg.url, apiKey: cfg.apiKey });
    this.collection = cfg.collection;
  }

  async search(queryEmbedding: number[], options: VectorSearchOptions = {}): Promise<RetrievedPassage[]> {
    const k = options.k ?? 6;
    const mmrLambda = options.mmrLambda ?? 0.5;
    // Fetch a larger candidate pool for MMR
    const limit = Math.max(20, k * 4);
    const res = await this.client.search(this.collection, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      with_vector: true,
      score_threshold: 0.0,
    });

    // Prepare for MMR
    const candidates = res.map((p, idx) => ({
      idx,
      score: typeof p.score === 'number' ? p.score : 0,
      vector: (p.vector || []) as number[],
      payload: (p.payload as unknown as QdrantPayload) || ({} as unknown as QdrantPayload),
    }));

    const selected: number[] = [];
    const results: RetrievedPassage[] = [];
    const maxIter = Math.min(k, candidates.length);
    while (selected.length < maxIter) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        if (selected.includes(i)) continue;
        const cand = candidates[i];
        let diversity = 0;
        if (selected.length > 0) {
          for (const s of selected) {
            const sim = cosineSimilarity(cand.vector, candidates[s].vector);
            if (sim > diversity) diversity = sim;
          }
        }
        const mmrScore = mmrLambda * cand.score - (1 - mmrLambda) * diversity;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      selected.push(bestIdx);
      const sel = candidates[bestIdx];
      results.push({
        materialId: String(sel.payload.materialId || ''),
        page: Number(sel.payload.pageNumber || 1),
        quote: String(sel.payload.plainText || ''),
        score: sel.score,
        offset: Number(sel.payload.offset || 0),
      });
    }
    return results;
  }
}


