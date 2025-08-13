/*
  Build vector index from public/materials HTML files.
  - Extract text with page markers
  - Chunk into ~500 tokens with 100 overlap (approx by characters)
  - Normalize and alias-expand
  - Embed via OpenAI and save to services/data/materials_index.json
*/

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';
import { embedTexts } from '../lib/openai';
import { normalizeText, applyAliasExpansion } from '../utils/text-normalizer';

interface RawChunk {
  id: string;
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
}

const MATERIALS_DIR = path.join(process.cwd(), 'public', 'materials');
const OUTPUT_FILE = path.join(process.cwd(), 'services', 'data', 'materials_index.json');

const aliasMap: Record<string, string> = {
  'fca': 'financial conduct authority',
  'pra': 'prudential regulation authority',
  'fsma': 'financial services and markets act',
  'cobs': 'conduct of business sourcebook',
  'cisi': 'chartered institute for securities and investment',
};

function readHtmlFiles(): Array<{ id: string; html: string }> {
  const files = fs.readdirSync(MATERIALS_DIR).filter(f => f.endsWith('.html'));
  return files.map(f => ({ id: f, html: fs.readFileSync(path.join(MATERIALS_DIR, f), 'utf-8') }));
}

function extractTextWithPages(html: string): Array<{ page: number; text: string }> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const markers = Array.from(doc.querySelectorAll('.page-marker')) as HTMLElement[];
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i];
    const end = markers[i + 1] || null;
    const range = doc.createRange();
    range.setStartAfter(start);
    if (end) range.setEndBefore(end); else range.setEndAfter(doc.body);
    const fragment = range.cloneContents();
    const tmp = doc.createElement('div');
    tmp.appendChild(fragment);
    const text = tmp.textContent || '';
    const pageNum = Number(start.getAttribute('data-page')) || i + 1;
    pages.push({ page: pageNum, text });
  }
  if (pages.length === 0) {
    const text = doc.body.textContent || '';
    pages.push({ page: 1, text });
  }
  return pages;
}

function chunkText(text: string, targetChars = 2000, overlapChars = 400): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + targetChars);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = Math.max(0, end - overlapChars);
  }
  return chunks;
}

async function main() {
  // Load env (.env.local preferred)
  const envLocal = path.join(process.cwd(), '.env.local');
  const envFile = fs.existsSync(envLocal) ? envLocal : path.join(process.cwd(), '.env');
  dotenv.config({ path: envFile });

  console.log('Building material index...');
  const sources = readHtmlFiles();
  const rawChunks: RawChunk[] = [];
  for (const src of sources) {
    const pages = extractTextWithPages(src.html);
    let chunkIndex = 0;
    for (const p of pages) {
      const chunks = chunkText(p.text);
      let offset = 0;
      for (const c of chunks) {
        const normalized = applyAliasExpansion(c, aliasMap);
        rawChunks.push({
          id: `${src.id}#${p.page}-${chunkIndex}`,
          materialId: src.id,
          pageNumber: p.page,
          offset,
          chunkIndex,
          plainText: c,
          normalizedText: normalizeText(normalized),
        });
        offset += c.length;
        chunkIndex++;
      }
    }
  }
  console.log(`Total chunks: ${rawChunks.length}`);
  const batchSize = 128;
  const embeddings: number[][] = [];
  for (let i = 0; i < rawChunks.length; i += batchSize) {
    const batch = rawChunks.slice(i, i + batchSize);
    const embs = await embedTexts(batch.map(b => b.normalizedText));
    embeddings.push(...embs);
    console.log(`Embedded ${Math.min(i + batch.length, rawChunks.length)} / ${rawChunks.length}`);
  }

  const records = rawChunks.map((c, idx) => ({
    ...c,
    embedding: embeddings[idx],
  }));

  // Ensure output directory
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records));
  console.log(`Saved index to ${OUTPUT_FILE}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


