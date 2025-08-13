import fs from 'node:fs';
import path from 'node:path';
import type { RetrievedPassage as RagRetrievedPassage, VectorSearcher, VectorSearchOptions } from '@/types/rag';

export interface PassageRecord {
  id: string;
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
  embedding: number[];
}

// Re-export types from rag.ts for backward compatibility
export type RetrievedPassage = RagRetrievedPassage;
export type RetrieveOptions = VectorSearchOptions;

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

export class LocalVectorClient {
  private records: PassageRecord[] = [];

  constructor(indexFilePath: string) {
    const p = path.resolve(indexFilePath);
    if (!fs.existsSync(p)) {
      throw new Error(`Vector index not found at ${p}`);
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const json = JSON.parse(raw) as PassageRecord[];
    this.records = json;
  }

  async search(queryEmbedding: number[], options: VectorSearchOptions = {}): Promise<RetrievedPassage[]> {
    const k = options.k ?? 6;
    const mmrLambda = options.mmrLambda ?? 0.7; // Increased default from 0.5 to 0.7 for better accuracy
    const minScore = options.minScore ?? 0.7; // Filter out low-relevance results
    
    // Precompute similarities
    const sims = this.records.map((r, idx) => ({ idx, score: cosineSimilarity(queryEmbedding, r.embedding) }));
    
    // Filter by minimum score threshold
    const filteredSims = sims.filter(s => s.score >= minScore);
    console.log(`[Vector Search] Found ${filteredSims.length} results above score ${minScore} (total: ${sims.length})`);
    
    // Sort by score
    filteredSims.sort((a, b) => b.score - a.score);
    // MMR selection
    const selected: number[] = [];
    const selectedResults: RetrievedPassage[] = [];
    const maxIter = Math.min(k, filteredSims.length);
    
    // If no results meet the threshold, return empty
    if (filteredSims.length === 0) {
      console.log('[Vector Search] No results met the minimum score threshold');
      return [];
    }
    
    while (selected.length < maxIter) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < filteredSims.length; i++) {
        if (selected.includes(filteredSims[i].idx)) continue;
        const candidate = filteredSims[i];
        // Diversity penalty
        let diversity = 0;
        if (selected.length > 0) {
          for (const s of selected) {
            const simToSelected = cosineSimilarity(this.records[candidate.idx].embedding, this.records[s].embedding);
            if (simToSelected > diversity) diversity = simToSelected;
          }
        }
        const mmrScore = mmrLambda * candidate.score - (1 - mmrLambda) * diversity;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = candidate.idx;
        }
      }
      if (bestIdx === -1) break;
      selected.push(bestIdx);
      const r = this.records[bestIdx];
      selectedResults.push({
        materialId: r.materialId,
        page: r.pageNumber,
        quote: r.plainText,
        score: filteredSims.find(s => s.idx === bestIdx)?.score ?? 0,
        offset: r.offset,
      });
    }
    return Promise.resolve(selectedResults);
  }
}


