#!/usr/bin/env tsx
/**
 * Unified Material Index Builder
 * 
 * This script builds a consistent, standardized index for both Study Companion and Checkpoint materials.
 * It ensures consistent materialId format and accurate page number extraction.
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { embedTexts } from '../lib/openai';
import { normalizeMaterialId, validatePageNumber } from '../utils/material-utils';

interface IndexRecord {
  id: string;
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
  embedding: number[];
}

// Configuration
const CHUNK_SIZE = 350;
const CHUNK_OVERLAP = 100;
const OUTPUT_FILE = path.join(process.cwd(), 'services/data/materials_index.json');
const BACKUP_DIR = path.join(process.cwd(), 'services/data/backups');

// Material definitions
const MATERIALS = [
  {
    id: 'UKFR_ED32_Study_Companion',
    textFile: 'UKFR_ED32_Study_Companion_ja_fixed.txt',
    totalPages: 112,
    name: 'Study Companion'
  },
  {
    id: 'UKFR_ED32_Checkpoint',
    textFile: 'UKFR_ED32_Checkpoint_ja_fixed.txt',
    totalPages: 44,
    name: 'Checkpoint'
  }
];

// Alias expansion map for better search
const ALIAS_MAP: Record<string, string> = {
  'fca': 'financial conduct authority',
  'pra': 'prudential regulation authority',
  'fsma': 'financial services and markets act',
  'fscs': 'financial services compensation scheme',
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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[・、。]/g, ' ')
    .trim();
}

function applyAliasExpansion(text: string, aliasMap: Record<string, string>): string {
  let expanded = text;
  for (const [alias, expansion] of Object.entries(aliasMap)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'gi');
    expanded = expanded.replace(regex, `${alias} ${expansion}`);
  }
  return expanded;
}

function extractPageFromContent(content: string): number | null {
  // Pattern 1: "ページ N" or "page N"
  const pageMatch = content.match(/(?:ページ|page)\s*(\d+)/i);
  if (pageMatch) {
    return parseInt(pageMatch[1], 10);
  }
  
  // Pattern 2: Line with just a number (typical page number)
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      const pageNum = parseInt(trimmed, 10);
      // Validate reasonable page number
      if (pageNum > 0 && pageNum <= 200) {
        return pageNum;
      }
    }
  }
  
  return null;
}

function createChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    
    if (end >= text.length) break;
    start = end - overlap;
  }
  
  return chunks;
}

async function processMaterial(material: typeof MATERIALS[0]): Promise<IndexRecord[]> {
  console.log(`\n📖 Processing ${material.name}...`);
  
  const textPath = path.join(process.cwd(), 'public/materials', material.textFile);
  const content = await fs.readFile(textPath, 'utf-8');
  
  // Split content by page markers
  const pagePattern = /={80,}\nページ\s+(\d+)\n/g;
  const pages: { pageNumber: number; content: string }[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = pagePattern.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    const pageContent = content.slice(lastIndex, match.index);
    
    if (pageContent.trim() && pages.length > 0) {
      pages[pages.length - 1].content += pageContent;
    }
    
    pages.push({ pageNumber, content: '' });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining content to last page
  if (lastIndex < content.length && pages.length > 0) {
    pages[pages.length - 1].content += content.slice(lastIndex);
  }
  
  // If no pages found, treat entire content as page 1
  if (pages.length === 0) {
    console.warn(`  ⚠️ No page markers found in ${material.textFile}, treating as single page`);
    pages.push({ pageNumber: 1, content });
  }
  
  console.log(`  📄 Found ${pages.length} pages (expected: ${material.totalPages})`);
  
  // Create chunks for each page
  const records: IndexRecord[] = [];
  let globalChunkIndex = 0;
  
  for (const page of pages) {
    if (!validatePageNumber(material.id, page.pageNumber)) {
      console.warn(`  ⚠️ Skipping invalid page ${page.pageNumber} for ${material.name}`);
      continue;
    }
    
    const chunks = createChunks(page.content, CHUNK_SIZE, CHUNK_OVERLAP);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const normalizedChunk = normalizeText(chunk);
      const expandedChunk = applyAliasExpansion(normalizedChunk, ALIAS_MAP);
      
      // Generate deterministic ID
      const idString = `${material.id}#${page.pageNumber}-${globalChunkIndex}`;
      
      records.push({
        id: idString,
        materialId: material.id,
        pageNumber: page.pageNumber,
        offset: i * (CHUNK_SIZE - CHUNK_OVERLAP),
        chunkIndex: globalChunkIndex,
        plainText: chunk,
        normalizedText: expandedChunk,
        embedding: [] // Will be filled later
      });
      
      globalChunkIndex++;
    }
  }
  
  console.log(`  ✅ Created ${records.length} chunks`);
  return records;
}

async function generateEmbeddings(records: IndexRecord[]): Promise<void> {
  console.log('\n🧠 Generating embeddings...');
  
  const batchSize = 100;
  const batches: IndexRecord[][] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  Processing batch ${i + 1}/${batches.length} (${batch.length} records)...`);
    
    try {
      const texts = batch.map(r => r.normalizedText);
      const embeddings = await embedTexts(texts);
      
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j];
      }
    } catch (error) {
      console.error(`  ❌ Error generating embeddings for batch ${i + 1}:`, error);
      throw error;
    }
  }
  
  console.log('  ✅ All embeddings generated');
}

async function createBackup(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `materials_index_${timestamp}.json`);
    
    // Check if current index exists
    try {
      await fs.access(OUTPUT_FILE);
      await fs.copyFile(OUTPUT_FILE, backupFile);
      console.log(`📦 Backup created: ${path.basename(backupFile)}`);
    } catch {
      console.log('📦 No existing index to backup');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create backup:', error);
  }
}

async function validateIndex(records: IndexRecord[]): Promise<boolean> {
  console.log('\n🔍 Validating index...');
  
  let valid = true;
  const materialCounts: Record<string, number> = {};
  const pageCounts: Record<string, Set<number>> = {};
  
  for (const record of records) {
    // Count records per material
    materialCounts[record.materialId] = (materialCounts[record.materialId] || 0) + 1;
    
    // Track unique pages per material
    if (!pageCounts[record.materialId]) {
      pageCounts[record.materialId] = new Set();
    }
    pageCounts[record.materialId].add(record.pageNumber);
    
    // Validate materialId format
    const normalized = normalizeMaterialId(record.materialId);
    if (normalized !== record.materialId) {
      console.error(`  ❌ Invalid materialId format: ${record.materialId}`);
      valid = false;
    }
    
    // Validate page number
    if (!validatePageNumber(record.materialId, record.pageNumber)) {
      console.error(`  ❌ Invalid page number ${record.pageNumber} for ${record.materialId}`);
      valid = false;
    }
    
    // Validate embedding
    if (!record.embedding || record.embedding.length === 0) {
      console.error(`  ❌ Missing embedding for record ${record.id}`);
      valid = false;
    }
  }
  
  // Report statistics
  console.log('\n📊 Index Statistics:');
  for (const material of MATERIALS) {
    const count = materialCounts[material.id] || 0;
    const pages = pageCounts[material.id] ? pageCounts[material.id].size : 0;
    console.log(`  ${material.name}:`);
    console.log(`    - Records: ${count}`);
    console.log(`    - Pages: ${pages}/${material.totalPages}`);
    
    if (pages < material.totalPages * 0.8) {
      console.warn(`    ⚠️ Missing significant number of pages`);
    }
  }
  
  return valid;
}

async function main() {
  console.log('🚀 Unified Material Index Builder');
  console.log('================================\n');
  
  try {
    // Create backup of existing index
    await createBackup();
    
    // Process all materials
    const allRecords: IndexRecord[] = [];
    
    for (const material of MATERIALS) {
      const records = await processMaterial(material);
      allRecords.push(...records);
    }
    
    // Generate embeddings
    await generateEmbeddings(allRecords);
    
    // Validate index
    const isValid = await validateIndex(allRecords);
    
    if (!isValid) {
      console.error('\n❌ Index validation failed. Please review errors above.');
      process.exit(1);
    }
    
    // Save index
    console.log('\n💾 Saving index...');
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(allRecords, null, 2));
    console.log(`  ✅ Index saved to ${OUTPUT_FILE}`);
    
    // Final report
    console.log('\n✨ Index build completed successfully!');
    console.log(`  Total records: ${allRecords.length}`);
    console.log(`  File size: ${((await fs.stat(OUTPUT_FILE)).size / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n📝 Next steps:');
    console.log('  1. Run "npm run upload:qdrant" to update Qdrant');
    console.log('  2. Test with a few sample queries');
    console.log('  3. Monitor for any materialId format issues');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { processMaterial, generateEmbeddings, validateIndex };