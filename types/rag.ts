// RAG (Retrieval-Augmented Generation) Types

export interface RetrievedPassage {
  materialId: string;
  page: number;
  quote: string;
  score: number;
  offset: number;
}

export interface VectorSearcher {
  search(
    embedding: number[],
    options?: VectorSearchOptions
  ): Promise<RetrievedPassage[]>;
}

export interface VectorSearchOptions {
  k?: number;
  mmrLambda?: number;
  minScore?: number;
}

export interface CacheEntry {
  passages: RetrievedPassage[];
  expiresAt: number;
}

export interface QdrantPayload {
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
}

export interface RerankRequest {
  question: string;
  passages: RetrievedPassage[];
}

export interface RerankResponse {
  page: number;
  exactQuote: string;
  rationale: string;
}