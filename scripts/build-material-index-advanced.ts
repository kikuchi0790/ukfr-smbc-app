/*
  Advanced vector index builder with section structure and metadata
  - Preserves section hierarchy and titles
  - Extracts amounts and key entities
  - Uses adaptive chunking based on content type
  - Embeds with text-embedding-3-large for higher accuracy
*/

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { embedTexts } from '../lib/openai';
import { normalizeText, applyAliasExpansion } from '../utils/text-normalizer';

interface EnhancedChunk {
  id: string;
  materialId: string;
  pageNumber: number;
  offset: number;
  chunkIndex: number;
  plainText: string;
  normalizedText: string;
  // Enhanced metadata
  sectionTitle?: string;
  sectionNumber?: number;
  containsAmounts?: string[];
  keyEntities?: string[];
  contentType?: 'heading' | 'list' | 'paragraph' | 'table';
  importance?: number;
}

interface SectionInfo {
  title: string;
  number: number;
  pageNumber: number;
  startOffset: number;
  content: string;
  subsections?: SectionInfo[];
}

const MATERIALS_DIR = path.join(process.cwd(), 'public', 'materials');
const OUTPUT_FILE = path.join(process.cwd(), 'services', 'data', 'materials_index_advanced.json');

// Extended alias map
const aliasMap: Record<string, string> = {
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

// Important sections that should be preserved as single chunks
const IMPORTANT_SECTIONS = [
  'fscs.*scheme.*limit',
  'compensation.*scheme',
  'deposit.*guarantee',
  'financial.*services.*compensation',
  '金融サービス補償.*スキーム限度',
  'scheme limits',
  'スキーム限度額'
];

function readTextFiles(): Array<{ id: string; content: string }> {
  const files = fs.readdirSync(MATERIALS_DIR).filter(f => f.endsWith('_ja_fixed.txt'));
  return files.map(f => ({
    id: f.replace('_ja_fixed.txt', ''),
    content: fs.readFileSync(path.join(MATERIALS_DIR, f), 'utf-8')
  }));
}

function extractAmounts(text: string): string[] {
  const amountRegex = /£[\d,]+|\d{2,3},\d{3}ポンド|\$[\d,]+|\d+%|[\d,]+円/g;
  const matches = text.match(amountRegex) || [];
  return [...new Set(matches)];
}

function extractKeyEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Financial institutions
  const institutions = ['FCA', 'PRA', 'FSCS', 'CMA', 'FSMA', 'COBS', 'CISI'];
  institutions.forEach(inst => {
    if (text.includes(inst)) entities.push(inst);
  });
  
  // Key concepts
  const concepts = ['deposit', 'compensation', 'guarantee', 'scheme', 'limit', 'protection'];
  concepts.forEach(concept => {
    if (text.toLowerCase().includes(concept)) entities.push(concept);
  });
  
  return [...new Set(entities)];
}

function detectContentType(text: string): 'heading' | 'list' | 'paragraph' | 'table' {
  const trimmed = text.trim();
  
  // Heading detection
  if (trimmed.match(/^\d+\.[\s\S]*$/) && trimmed.length < 200) return 'heading';
  if (trimmed.match(/^[A-Z][^.!?]*$/) && trimmed.length < 100) return 'heading';
  
  // List detection
  if (trimmed.match(/^[•·▪▫◦‣⁃]\s/) || trimmed.match(/^[a-z]\)\s/)) return 'list';
  
  // Table detection (has multiple aligned columns)
  if (trimmed.split('\n').filter(line => line.includes('\t') || line.match(/\s{2,}/)).length > 2) return 'table';
  
  return 'paragraph';
}

function calculateImportance(chunk: EnhancedChunk): number {
  let score = 0.5; // Base score
  
  // Boost for section titles
  if (chunk.contentType === 'heading') score += 0.2;
  
  // Boost for important sections
  const lowerText = chunk.plainText.toLowerCase();
  if (IMPORTANT_SECTIONS.some(pattern => lowerText.match(new RegExp(pattern, 'i')))) {
    score += 0.3;
  }
  
  // Boost for amounts
  if (chunk.containsAmounts && chunk.containsAmounts.length > 0) {
    score += 0.1 * Math.min(chunk.containsAmounts.length, 3);
  }
  
  // Boost for key entities
  if (chunk.keyEntities && chunk.keyEntities.length > 0) {
    score += 0.05 * Math.min(chunk.keyEntities.length, 4);
  }
  
  return Math.min(score, 1.0);
}

function extractSections(content: string): SectionInfo[] {
  const sections: SectionInfo[] = [];
  const lines = content.split('\n');
  
  let currentSection: SectionInfo | null = null;
  let currentSubsection: SectionInfo | null = null;
  let globalOffset = 0;
  let currentPageNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Update page number if found
    const pageMatch = line.match(/^ページ\s+(\d+)|^Page\s+(\d+)/);
    if (pageMatch) {
      currentPageNumber = parseInt(pageMatch[1] || pageMatch[2], 10);
      continue;
    }
    
    // Main section detection (e.g., "21. Financial Services Compensation Scheme")
    const sectionMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (sectionMatch && sectionMatch[2].length > 5) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      currentSection = {
        title: sectionMatch[2].trim(),
        number: parseInt(sectionMatch[1], 10),
        pageNumber: currentPageNumber,
        startOffset: globalOffset,
        content: '',
        subsections: []
      };
      currentSubsection = null;
      continue;
    }
    
    // Subsection detection (e.g., "21.1 Scheme limits")
    const subsectionMatch = line.match(/^(\d+)\.(\d+)\s+(.+)/);
    if (subsectionMatch && currentSection) {
      if (currentSubsection) {
        currentSection.subsections!.push(currentSubsection);
      }
      
      currentSubsection = {
        title: subsectionMatch[3].trim(),
        number: parseFloat(`${subsectionMatch[1]}.${subsectionMatch[2]}`),
        pageNumber: currentPageNumber,
        startOffset: globalOffset,
        content: ''
      };
      continue;
    }
    
    // Add content to current section or subsection
    if (currentSubsection) {
      currentSubsection.content += line + '\n';
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
    
    globalOffset += line.length + 1;
  }
  
  // Save last section
  if (currentSubsection && currentSection) {
    currentSection.subsections!.push(currentSubsection);
  }
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

function adaptiveChunk(section: SectionInfo, materialId: string): EnhancedChunk[] {
  const chunks: EnhancedChunk[] = [];
  const text = section.content.trim();
  
  // Check if this is an important section that should be kept whole
  const isImportant = IMPORTANT_SECTIONS.some(pattern => 
    section.title.toLowerCase().match(new RegExp(pattern, 'i')) ||
    text.toLowerCase().match(new RegExp(pattern, 'i'))
  );
  
  // For important sections or short sections, keep as single chunk
  if (isImportant || text.length < 800) {
    const expanded = applyAliasExpansion(text, aliasMap);
    const normalized = normalizeText(expanded);
    
    const chunk: EnhancedChunk = {
      id: `${materialId}#${section.pageNumber}-${section.number}`,
      materialId,
      pageNumber: section.pageNumber,
      offset: section.startOffset,
      chunkIndex: 0,
      plainText: text,
      normalizedText: normalized,
      sectionTitle: section.title,
      sectionNumber: section.number,
      containsAmounts: extractAmounts(text),
      keyEntities: extractKeyEntities(text),
      contentType: detectContentType(text),
    };
    
    chunk.importance = calculateImportance(chunk);
    chunks.push(chunk);
  } else {
    // For longer sections, use smart chunking
    const targetSize = isImportant ? 600 : 400;
    const overlap = 100;
    const parts = smartChunk(text, targetSize, overlap);
    
    parts.forEach((part, idx) => {
      const expanded = applyAliasExpansion(part, aliasMap);
      const normalized = normalizeText(expanded);
      
      const chunk: EnhancedChunk = {
        id: `${materialId}#${section.pageNumber}-${section.number}-${idx}`,
        materialId,
        pageNumber: section.pageNumber,
        offset: section.startOffset + (idx * (targetSize - overlap)),
        chunkIndex: idx,
        plainText: part,
        normalizedText: normalized,
        sectionTitle: section.title,
        sectionNumber: section.number,
        containsAmounts: extractAmounts(part),
        keyEntities: extractKeyEntities(part),
        contentType: detectContentType(part),
      };
      
      chunk.importance = calculateImportance(chunk);
      chunks.push(chunk);
    });
  }
  
  // Process subsections
  if (section.subsections) {
    section.subsections.forEach(subsection => {
      chunks.push(...adaptiveChunk(subsection, materialId));
    });
  }
  
  return chunks;
}

function smartChunk(text: string, targetSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  let currentLength = 0;
  
  for (const sentence of sentences) {
    if (currentLength + sentence.length > targetSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + sentence;
      currentLength = currentChunk.length;
    } else {
      currentChunk += sentence;
      currentLength += sentence.length;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function main() {
  // Load env
  const envLocal = path.join(process.cwd(), '.env.local');
  const envFile = fs.existsSync(envLocal) ? envLocal : path.join(process.cwd(), '.env');
  dotenv.config({ path: envFile });

  console.log('Building advanced material index with section structure...');
  
  const sources = readTextFiles();
  const allChunks: EnhancedChunk[] = [];
  
  for (const src of sources) {
    console.log(`Processing ${src.id}...`);
    
    // Map to correct material ID
    let materialId = src.id;
    if (src.id.includes('Checkpoint')) {
      materialId = 'UKFR_ED32_Checkpoint';
    } else if (src.id.includes('Study_Companion')) {
      materialId = 'UKFR_ED32_Study_Companion';
    }
    
    // Extract sections with structure
    const sections = extractSections(src.content);
    console.log(`  Found ${sections.length} main sections`);
    
    // Process each section with adaptive chunking
    for (const section of sections) {
      const chunks = adaptiveChunk(section, materialId);
      console.log(`  Section ${section.number}: "${section.title}" -> ${chunks.length} chunks`);
      allChunks.push(...chunks);
    }
  }
  
  console.log(`Total chunks: ${allChunks.length}`);
  
  // Sort by importance for better embedding priority
  allChunks.sort((a, b) => (b.importance || 0) - (a.importance || 0));
  
  // Embed in batches - process each chunk individually to avoid token limit
  const embeddings: number[][] = [];
  
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    
    // Show progress every 10 chunks
    if (i % 10 === 0) {
      console.log(`Embedding chunk ${i + 1}/${allChunks.length}...`);
    }
    
    try {
      // Truncate if too long (max ~6000 chars for safety with tokens)
      let textToEmbed = chunk.normalizedText;
      if (textToEmbed.length > 6000) {
        console.warn(`  Chunk ${i} truncated from ${textToEmbed.length} to 6000 chars`);
        textToEmbed = textToEmbed.slice(0, 6000);
      }
      
      // Try text-embedding-3-large first for better accuracy
      try {
        const [emb] = await embedTexts([textToEmbed], 'text-embedding-3-large');
        embeddings.push(emb);
      } catch (largeModelError) {
        // Fallback to text-embedding-3-small
        const [emb] = await embedTexts([textToEmbed], 'text-embedding-3-small');
        embeddings.push(emb);
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${i}:`, error);
      // Use zero vector as fallback
      const dimensions = allChunks[0].normalizedText.includes('large') ? 3072 : 1536;
      embeddings.push(new Array(dimensions).fill(0));
    }
  }
  
  // Combine chunks with embeddings
  const finalData = allChunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx]
  }));
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
  console.log(`Index saved to ${OUTPUT_FILE}`);
  
  // Print statistics
  const stats = {
    totalChunks: finalData.length,
    avgChunkSize: finalData.reduce((sum, c) => sum + c.plainText.length, 0) / finalData.length,
    chunksWithAmounts: finalData.filter(c => c.containsAmounts && c.containsAmounts.length > 0).length,
    highImportanceChunks: finalData.filter(c => (c.importance || 0) > 0.8).length,
    sectionsPreserved: new Set(finalData.map(c => c.sectionTitle)).size
  };
  
  console.log('\nIndex Statistics:');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch(console.error);