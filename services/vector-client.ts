import fs from 'node:fs';
import path from 'node:path';
import { normalizeMaterialId, validatePageNumber } from '@/utils/material-utils';
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
  // Enhanced metadata for better search
  sectionTitle?: string;
  sectionNumber?: number;
  containsAmounts?: string[];
  keyEntities?: string[];
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

export class LocalVectorClient implements VectorSearcher {
  private records: PassageRecord[] = [];
  private amountIndex: Map<string, PassageRecord[]> = new Map();
  private sectionIndex: Map<string, PassageRecord[]> = new Map();

  constructor(indexFilePath: string) {
    const p = path.resolve(indexFilePath);
    if (!fs.existsSync(p)) {
      throw new Error(`Vector index not found at ${p}`);
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const json = JSON.parse(raw) as PassageRecord[];
    this.records = json;
    
    // Build specialized indexes
    this.buildSpecializedIndexes();
  }
  
  private buildSpecializedIndexes() {
    // Build amount index for fast lookup
    this.records.forEach(record => {
      // Extract amounts from text
      const amountRegex = /£[\d,]+|\d{2,3},\d{3}ポンド|\$[\d,]+|\d+%/g;
      const amounts = record.plainText.match(amountRegex) || [];
      
      amounts.forEach(amount => {
        if (!this.amountIndex.has(amount)) {
          this.amountIndex.set(amount, []);
        }
        this.amountIndex.get(amount)!.push(record);
      });
      
      // Store in metadata if available
      if (record.containsAmounts) {
        record.containsAmounts.forEach(amount => {
          if (!this.amountIndex.has(amount)) {
            this.amountIndex.set(amount, []);
          }
          this.amountIndex.get(amount)!.push(record);
        });
      }
      
      // Build section index
      if (record.sectionTitle) {
        const key = record.sectionTitle.toLowerCase();
        if (!this.sectionIndex.has(key)) {
          this.sectionIndex.set(key, []);
        }
        this.sectionIndex.get(key)!.push(record);
      }
    });
    
    console.log(`[Vector Client] Built specialized indexes: ${this.amountIndex.size} amounts, ${this.sectionIndex.size} sections`);
  }
  
  // Direct amount-based search
  async searchByAmount(amount: string): Promise<RetrievedPassage[]> {
    const records = this.amountIndex.get(amount) || [];
    console.log(`[Amount Search] Found ${records.length} records with amount "${amount}"`);
    
    return records.map(r => ({
      materialId: r.materialId,
      page: r.pageNumber,
      quote: r.plainText,
      score: 1.0,  // Perfect match for exact amount
      offset: r.offset,
    }));
  }
  
  // Section-based search
  async searchBySection(sectionKeywords: string[]): Promise<RetrievedPassage[]> {
    const results: PassageRecord[] = [];
    
    sectionKeywords.forEach(keyword => {
      const key = keyword.toLowerCase();
      this.sectionIndex.forEach((records, sectionTitle) => {
        if (sectionTitle.includes(key)) {
          results.push(...records);
        }
      });
    });
    
    console.log(`[Section Search] Found ${results.length} records matching sections: ${sectionKeywords.join(', ')}`);
    
    // Deduplicate and return
    const seen = new Set<string>();
    return results
      .filter(r => {
        const key = `${r.materialId}_${r.pageNumber}_${r.offset}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(r => ({
        materialId: r.materialId,
        page: r.pageNumber,
        quote: r.plainText,
        score: 0.95,  // High score for section match
        offset: r.offset,
      }));
  }

  async search(queryEmbedding: number[], options: VectorSearchOptions = {}): Promise<RetrievedPassage[]> {
    // Try hybrid search first if amounts or sections are provided
    let hybridResults: RetrievedPassage[] = [];
    
    if (options.hybridAmounts && options.hybridAmounts.length > 0) {
      for (const amount of options.hybridAmounts) {
        const amountResults = await this.searchByAmount(amount);
        hybridResults.push(...amountResults);
      }
    }
    
    if (options.hybridSections && options.hybridSections.length > 0) {
      const sectionResults = await this.searchBySection(options.hybridSections);
      hybridResults.push(...sectionResults);
    }
    
    // If we have high-quality hybrid results, prioritize them
    if (hybridResults.length > 0) {
      console.log(`[Hybrid Search] Found ${hybridResults.length} high-priority results from amount/section search`);
    }
    
    // Continue with vector search
    const k = options.k ?? 6;
    const mmrLambda = options.mmrLambda ?? 0.7; // Increased default from 0.5 to 0.7 for better accuracy
    const minScore = options.minScore ?? 0.65; // Lowered threshold for cross-lingual search
    
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
      
      // Normalize materialId and validate page
      const normalizedMaterialId = normalizeMaterialId(r.materialId);
      if (!normalizedMaterialId || !validatePageNumber(normalizedMaterialId, r.pageNumber)) {
        console.warn('[LocalVectorClient] Skipping invalid result:', { 
          materialId: r.materialId, 
          pageNumber: r.pageNumber 
        });
        continue;
      }
      
      selectedResults.push({
        materialId: normalizedMaterialId,
        page: r.pageNumber,
        quote: r.plainText,
        score: filteredSims.find(s => s.idx === bestIdx)?.score ?? 0,
        offset: r.offset,
      });
    }
    
    // Merge hybrid results with vector results
    const finalResults: RetrievedPassage[] = [];
    const seen = new Set<string>();
    
    // Add hybrid results first (higher priority)
    hybridResults.forEach(result => {
      const key = `${result.materialId}_${result.page}_${result.offset}`;
      if (!seen.has(key)) {
        seen.add(key);
        finalResults.push(result);
      }
    });
    
    // Add vector search results
    selectedResults.forEach(result => {
      const key = `${result.materialId}_${result.page}_${result.offset}`;
      if (!seen.has(key)) {
        seen.add(key);
        finalResults.push(result);
      }
    });
    
    // Return top k results
    return Promise.resolve(finalResults.slice(0, k));
  }
}


