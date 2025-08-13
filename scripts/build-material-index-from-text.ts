/*
  Build vector index from public/materials text files (_ja_fixed.txt).
  - Extract text with proper page markers
  - Chunk into ~500-700 characters with 100-200 overlap
  - Normalize and alias-expand
  - Embed via OpenAI and save to services/data/materials_index.json
*/

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
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

interface PageContent {
  pageNumber: number;
  text: string;
  startOffset: number;
}

const MATERIALS_DIR = path.join(process.cwd(), 'public', 'materials');
const OUTPUT_FILE = path.join(process.cwd(), 'services', 'data', 'materials_index.json');

// Extended alias map for better coverage
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

function readTextFiles(): Array<{ id: string; content: string }> {
  const files = fs.readdirSync(MATERIALS_DIR).filter(f => f.endsWith('_ja_fixed.txt'));
  return files.map(f => ({
    id: f.replace('_ja_fixed.txt', ''),
    content: fs.readFileSync(path.join(MATERIALS_DIR, f), 'utf-8')
  }));
}

function extractPagesFromText(content: string): PageContent[] {
  const pages: PageContent[] = [];
  const lines = content.split('\n');
  
  let currentPage: PageContent | null = null;
  let globalOffset = 0;
  let pageCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for page marker pattern (line of equals signs)
    if (line.match(/^={3,}/)) {
      // Look at next line for page number
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const pageNumberMatch = nextLine.match(/^ページ\s+(\d+)/);
        
        if (pageNumberMatch) {
          // Save previous page if exists
          if (currentPage && currentPage.text.trim().length > 0) {
            pages.push(currentPage);
            globalOffset += currentPage.text.length;
            console.log(`    Saved page ${currentPage.pageNumber} with ${currentPage.text.length} characters`);
          }
          
          // Start new page
          const pageNum = parseInt(pageNumberMatch[1], 10);
          pageCount++;
          currentPage = {
            pageNumber: pageNum,
            text: '',
            startOffset: globalOffset
          };
          console.log(`    Starting page ${pageNum} at line ${i+1}`);
          i++; // Skip the page number line
          continue;
        }
      }
    }
    
    // Add content to current page (only if we have a current page)
    if (currentPage) {
      currentPage.text += line + '\n';
    } else if (!line.match(/^={3,}/) && line.trim()) {
      // Handle content before first page marker (shouldn't happen with our files)
      if (pages.length === 0 && !currentPage) {
        console.log('    Warning: Content before first page marker, assigning to page 1');
        currentPage = {
          pageNumber: 1,
          text: line + '\n',
          startOffset: 0
        };
      }
    }
  }
  
  // Add last page
  if (currentPage && currentPage.text.trim().length > 0) {
    pages.push(currentPage);
    console.log(`    Saved final page ${currentPage.pageNumber} with ${currentPage.text.length} characters`);
  }
  
  console.log(`    Total pages extracted: ${pages.length}`);
  
  // If no pages found, treat entire content as page 1
  if (pages.length === 0) {
    console.log('    Warning: No pages found, treating entire content as page 1');
    pages.push({
      pageNumber: 1,
      text: content,
      startOffset: 0
    });
  }
  
  return pages;
}

function chunkText(text: string, targetChars = 350, overlapChars = 100): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return [];
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < clean.length) {
    // Try to find a good break point (sentence end, paragraph, etc.)
    let end = Math.min(clean.length, i + targetChars);
    
    if (end < clean.length) {
      // Look for sentence boundaries
      const searchText = clean.slice(i, end + 100); // Look a bit ahead
      const sentenceEnds = [
        searchText.lastIndexOf('。'),
        searchText.lastIndexOf('.\n'),
        searchText.lastIndexOf('\n\n'),
        searchText.lastIndexOf('）'),
        searchText.lastIndexOf('；')
      ];
      
      const bestEnd = Math.max(...sentenceEnds);
      if (bestEnd > targetChars * 0.5) {
        end = i + bestEnd + 1;
      }
    }
    
    chunks.push(clean.slice(i, end));
    
    if (end === clean.length) break;
    
    // Start next chunk with overlap
    i = Math.max(i + 1, end - overlapChars);
  }
  
  return chunks;
}

async function main() {
  // Load env (.env.local preferred)
  const envLocal = path.join(process.cwd(), '.env.local');
  const envFile = fs.existsSync(envLocal) ? envLocal : path.join(process.cwd(), '.env');
  dotenv.config({ path: envFile });

  console.log('Building material index from text files...');
  
  const sources = readTextFiles();
  const rawChunks: RawChunk[] = [];
  
  for (const src of sources) {
    console.log(`Processing ${src.id}...`);
    const pages = extractPagesFromText(src.content);
    console.log(`  Found ${pages.length} pages`);
    
    let globalChunkIndex = 0;
    
    for (const page of pages) {
      const chunks = chunkText(page.text);
      console.log(`  Page ${page.pageNumber}: ${chunks.length} chunks`);
      
      let pageOffset = 0;
      for (const chunk of chunks) {
        // Skip very small chunks
        if (chunk.trim().length < 50) continue;
        
        const expanded = applyAliasExpansion(chunk, aliasMap);
        const normalized = normalizeText(expanded);
        
        // Map text file ID to appropriate material ID that matches PDF filename
        let materialId = src.id;
        if (src.id.includes('Checkpoint')) {
          materialId = 'UKFR_ED32_Checkpoint';
        } else if (src.id.includes('Study_Companion')) {
          materialId = 'UKFR_ED32_Study_Companion';
        }
        
        rawChunks.push({
          id: `${materialId}#${page.pageNumber}-${globalChunkIndex}`,
          materialId,
          pageNumber: page.pageNumber,
          offset: page.startOffset + pageOffset,
          chunkIndex: globalChunkIndex,
          plainText: chunk,
          normalizedText: normalized
        });
        
        pageOffset += chunk.length;
        globalChunkIndex++;
      }
    }
  }
  
  console.log(`Total chunks: ${rawChunks.length}`);
  
  if (rawChunks.length === 0) {
    console.error('No chunks created. Check your text files.');
    process.exit(1);
  }
  
  // Embed in batches
  const batchSize = 100;
  const embeddings: number[][] = [];
  
  for (let i = 0; i < rawChunks.length; i += batchSize) {
    const batch = rawChunks.slice(i, i + batchSize);
    console.log(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawChunks.length / batchSize)}...`);
    
    try {
      const embs = await embedTexts(batch.map(b => b.normalizedText));
      embeddings.push(...embs);
    } catch (error) {
      console.error(`Failed to embed batch starting at ${i}:`, error);
      throw error;
    }
    
    // Small delay to avoid rate limiting
    if (i + batchSize < rawChunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Combine chunks with embeddings
  const records = rawChunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx]
  }));
  
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));
  console.log(`\n✅ Saved index to ${OUTPUT_FILE}`);
  console.log(`   Total chunks: ${records.length}`);
  console.log(`   Materials indexed: ${[...new Set(records.map(r => r.materialId))].join(', ')}`);
  
  // Show statistics
  const stats = records.reduce((acc, r) => {
    if (!acc[r.materialId]) {
      acc[r.materialId] = { pages: new Set(), chunks: 0 };
    }
    acc[r.materialId].pages.add(r.pageNumber);
    acc[r.materialId].chunks++;
    return acc;
  }, {} as Record<string, { pages: Set<number>, chunks: number }>);
  
  console.log('\nIndex Statistics:');
  Object.entries(stats).forEach(([material, data]) => {
    console.log(`  ${material}:`);
    console.log(`    Pages: ${data.pages.size}`);
    console.log(`    Chunks: ${data.chunks}`);
    console.log(`    Avg chunks/page: ${(data.chunks / data.pages.size).toFixed(1)}`);
  });
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});