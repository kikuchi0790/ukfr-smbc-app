import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'node:crypto';

type RecordT = {
  id: string;
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
  embedding: number[];
};

async function main() {
  const envLocal = path.join(process.cwd(), '.env.local');
  dotenv.config({ path: fs.existsSync(envLocal) ? envLocal : path.join(process.cwd(), '.env') });

  const url = process.env.QDRANT_URL as string;
  const apiKey = process.env.QDRANT_API_KEY as string | undefined;
  const collection = process.env.QDRANT_COLLECTION || 'materials_passages';
  if (!url) throw new Error('QDRANT_URL not set');

  const client = new QdrantClient({ url, apiKey });
  // Ensure collection exists
  try {
    await client.getCollection(collection);
  } catch {
    await client.createCollection(collection, {
      vectors: { size: 1536, distance: 'Cosine' },
      optimizers_config: { default_segment_number: 2 },
    } as any);
  }

  const file = path.join(process.cwd(), 'services', 'data', 'materials_index.json');
  const raw = fs.readFileSync(file, 'utf-8');
  const records: RecordT[] = JSON.parse(raw);

  const batchSize = 128;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await client.upsert(collection, {
      wait: true,
      points: batch.map((r) => ({
        id: toUuidV5(r.id),
        vector: r.embedding,
        payload: {
          materialId: r.materialId,
          pageNumber: r.pageNumber,
          offset: r.offset,
          chunkIndex: r.chunkIndex,
          plainText: r.plainText,
          normalizedText: r.normalizedText,
        },
      })),
    });
    console.log(`Upserted ${Math.min(i + batch.length, records.length)} / ${records.length}`);
  }
  console.log('Upload completed');
}

function toUuidV5(input: string): string {
  // Deterministic UUID v5-like from SHA-1
  const hash = crypto.createHash('sha1').update(input).digest();
  const bytes = Uint8Array.from(hash);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122
  const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


