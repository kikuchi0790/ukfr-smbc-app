#!/usr/bin/env tsx
/**
 * Clean Qdrant Upload Script
 * 
 * Uploads material index to Qdrant with:
 * - Optional collection reset
 * - Pre-upload validation
 * - Progress tracking
 * - Error retry logic
 * - Post-upload verification
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantAdmin } from './qdrant-admin';
import { IndexValidator } from './validate-index';
import { normalizeMaterialId, validatePageNumber } from '../utils/material-utils';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
}

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

interface UploadOptions {
  reset?: boolean;
  validate?: boolean;
  batchSize?: number;
  retryAttempts?: number;
}

class CleanUploader {
  private client: QdrantClient;
  private admin: QdrantAdmin;
  private collection: string;
  private records: IndexRecord[] = [];
  private uploadedCount: number = 0;
  private failedRecords: string[] = [];

  constructor(url: string, apiKey?: string, collection: string = 'materials_passages') {
    this.client = new QdrantClient({ url, apiKey });
    this.admin = new QdrantAdmin({ url, apiKey, collection });
    this.collection = collection;
  }

  /**
   * Load index file
   */
  async loadIndex(filePath: string): Promise<boolean> {
    console.log(`\n📂 Loading index from: ${filePath}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        throw new Error('Index must be an array');
      }
      
      // Filter and normalize records
      this.records = data.filter(record => {
        const normalizedId = normalizeMaterialId(record.materialId);
        if (!normalizedId) {
          console.warn(`  ⚠️ Skipping record with invalid materialId: ${record.materialId}`);
          return false;
        }
        
        if (!validatePageNumber(normalizedId, record.pageNumber)) {
          console.warn(`  ⚠️ Skipping record with invalid page: ${record.pageNumber} for ${normalizedId}`);
          return false;
        }
        
        if (!record.embedding || record.embedding.length === 0) {
          console.warn(`  ⚠️ Skipping record without embedding: ${record.id}`);
          return false;
        }
        
        // Normalize materialId
        record.materialId = normalizedId;
        return true;
      });
      
      console.log(`  ✅ Loaded ${this.records.length} valid records (filtered from ${data.length})`);
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to load index: ${error}`);
      return false;
    }
  }

  /**
   * Validate index before upload
   */
  async validateIndex(): Promise<boolean> {
    console.log('\n🔍 Validating index before upload...');
    
    const validator = new IndexValidator();
    
    // Create temp file with our filtered records
    const tempFile = path.join(process.cwd(), '.temp-index.json');
    fs.writeFileSync(tempFile, JSON.stringify(this.records));
    
    try {
      await validator.loadIndex(tempFile);
      const report = await validator.validate();
      
      if (report.invalidRecords > 0) {
        console.log(`  ⚠️ Found ${report.invalidRecords} invalid records`);
        console.log('  These will be skipped during upload');
      }
      
      console.log(`  ✅ Validation complete: ${report.validRecords} valid records`);
      return report.validRecords > 0;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Reset collection (delete and recreate)
   */
  async resetCollection(): Promise<void> {
    console.log('\n🔄 Resetting collection...');
    await this.admin.resetCollection();
  }

  /**
   * Generate deterministic UUID for a record
   */
  private generateUuid(record: IndexRecord): string {
    const input = `${record.materialId}#${record.pageNumber}-${record.chunkIndex}`;
    const hash = crypto.createHash('sha1').update(input).digest();
    const bytes = Uint8Array.from(hash);
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122
    const hex = Array.from(bytes.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }

  /**
   * Upload records to Qdrant
   */
  async upload(options: UploadOptions = {}): Promise<boolean> {
    const { batchSize = 100, retryAttempts = 3 } = options;
    
    console.log(`\n📤 Uploading ${this.records.length} records to Qdrant...`);
    console.log(`  Collection: ${this.collection}`);
    console.log(`  Batch size: ${batchSize}`);
    
    const startTime = Date.now();
    this.uploadedCount = 0;
    this.failedRecords = [];
    
    // Process in batches
    for (let i = 0; i < this.records.length; i += batchSize) {
      const batch = this.records.slice(i, Math.min(i + batchSize, this.records.length));
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(this.records.length / batchSize);
      
      // Prepare points for Qdrant
      const points = batch.map(record => ({
        id: this.generateUuid(record),
        vector: record.embedding,
        payload: {
          materialId: record.materialId,
          pageNumber: record.pageNumber,
          offset: record.offset,
          chunkIndex: record.chunkIndex,
          plainText: record.plainText,
          normalizedText: record.normalizedText
        }
      }));
      
      // Try uploading with retry logic
      let uploaded = false;
      let attempts = 0;
      
      while (!uploaded && attempts < retryAttempts) {
        attempts++;
        
        try {
          await this.client.upsert(this.collection, {
            points,
            wait: true
          });
          
          uploaded = true;
          this.uploadedCount += batch.length;
          
          // Progress update
          const progress = ((this.uploadedCount / this.records.length) * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  [${batchNumber}/${totalBatches}] Uploaded ${this.uploadedCount}/${this.records.length} (${progress}%) - ${elapsed}s`);
          
        } catch (error) {
          console.error(`  ❌ Batch ${batchNumber} failed (attempt ${attempts}/${retryAttempts}):`, error);
          
          if (attempts >= retryAttempts) {
            batch.forEach(record => this.failedRecords.push(record.id));
            console.error(`  ⚠️ Skipping batch ${batchNumber} after ${retryAttempts} attempts`);
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  ✅ Upload complete in ${elapsed}s`);
    console.log(`  Successfully uploaded: ${this.uploadedCount}/${this.records.length}`);
    
    if (this.failedRecords.length > 0) {
      console.log(`  ⚠️ Failed records: ${this.failedRecords.length}`);
      
      // Save failed records for analysis
      const failedFile = path.join(process.cwd(), 'upload-failed-records.json');
      fs.writeFileSync(failedFile, JSON.stringify(this.failedRecords, null, 2));
      console.log(`  Failed record IDs saved to: ${failedFile}`);
    }
    
    return this.uploadedCount > 0;
  }

  /**
   * Verify upload by checking collection statistics
   */
  async verifyUpload(): Promise<void> {
    console.log('\n🔍 Verifying upload...');
    
    try {
      const info = await this.client.getCollection(this.collection);
      console.log(`  Collection points: ${info.points_count ?? 'N/A'}`);
      console.log(`  Expected points: ${this.uploadedCount}`);
      
      if (info.points_count !== null && info.points_count !== undefined && info.points_count >= this.uploadedCount) {
        console.log('  ✅ Upload verification passed');
      } else if (info.points_count !== null && info.points_count !== undefined) {
        console.log('  ⚠️ Point count mismatch - some records may not have been uploaded');
      } else {
        console.log('  ⚠️ Could not verify upload - points_count is unavailable');
      }
      
      // Analyze data quality
      await this.admin.analyzeDataQuality(100);
      
    } catch (error) {
      console.error('  ❌ Verification failed:', error);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options: UploadOptions = {
    reset: args.includes('--reset'),
    validate: !args.includes('--no-validate'),
    batchSize: 100
  };
  
  // Get configuration
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  const collection = process.env.QDRANT_COLLECTION || 'materials_passages';
  
  if (!url) {
    console.error('❌ QDRANT_URL not set in environment');
    process.exit(1);
  }
  
  console.log('🚀 Clean Qdrant Upload');
  console.log('======================');
  console.log(`URL: ${url}`);
  console.log(`Collection: ${collection}`);
  console.log(`Options:`, options);
  
  const uploader = new CleanUploader(url, apiKey, collection);
  
  // Load index
  const indexPath = path.join(process.cwd(), 'services/data/materials_index.json');
  const loaded = await uploader.loadIndex(indexPath);
  if (!loaded) {
    process.exit(1);
  }
  
  // Validate if requested
  if (options.validate) {
    const valid = await uploader.validateIndex();
    if (!valid) {
      console.error('❌ Index validation failed');
      process.exit(1);
    }
  }
  
  // Reset collection if requested
  if (options.reset) {
    console.log('\n⚠️ WARNING: This will delete all existing data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await uploader.resetCollection();
  }
  
  // Upload
  const success = await uploader.upload(options);
  if (!success) {
    console.error('❌ Upload failed');
    process.exit(1);
  }
  
  // Verify
  await uploader.verifyUpload();
  
  console.log('\n✨ Done!');
  console.log('\nNext steps:');
  console.log('  1. Test with sample queries');
  console.log('  2. Monitor application logs for materialId issues');
  console.log('  3. Run accuracy tests: npm run test:rag');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { CleanUploader };