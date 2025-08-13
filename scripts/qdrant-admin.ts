#!/usr/bin/env tsx
/**
 * Qdrant Administration Tool
 * 
 * Provides utilities for managing Qdrant collections:
 * - View collection info and statistics
 * - Delete and recreate collections
 * - Validate data integrity
 * - Clean up invalid records
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { normalizeMaterialId, validatePageNumber } from '../utils/material-utils';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
}

interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

class QdrantAdmin {
  private client: QdrantClient;
  private collection: string;

  constructor(config: QdrantConfig) {
    this.client = new QdrantClient({ url: config.url, apiKey: config.apiKey });
    this.collection = config.collection;
  }

  /**
   * Get collection information and statistics
   */
  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collection);
      console.log('\n📊 Collection Information:');
      console.log(`  Name: ${this.collection}`);
      console.log(`  Points count: ${info.points_count}`);
      console.log(`  Vectors size: ${info.config?.params?.vectors?.size || 'N/A'}`);
      console.log(`  Distance: ${info.config?.params?.vectors?.distance || 'N/A'}`);
      console.log(`  Status: ${info.status}`);
      
      return info;
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`\n❌ Collection '${this.collection}' does not exist`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Analyze data quality in the collection
   */
  async analyzeDataQuality(limit: number = 100) {
    console.log('\n🔍 Analyzing data quality...');
    
    try {
      // Scroll through points to analyze
      const response = await this.client.scroll(this.collection, {
        limit,
        with_payload: true,
        with_vector: false
      });

      const issues = {
        invalidMaterialId: [] as any[],
        invalidPageNumber: [] as any[],
        missingFields: [] as any[],
        oldFormat: [] as any[]
      };

      const materialStats: Record<string, { count: number; pages: Set<number> }> = {};

      for (const point of response.points) {
        const payload = point.payload as any;
        
        // Check for missing fields
        if (!payload.materialId || !payload.pageNumber) {
          issues.missingFields.push({ id: point.id, payload });
          continue;
        }

        // Check materialId format
        const normalizedId = normalizeMaterialId(payload.materialId);
        if (!normalizedId) {
          issues.invalidMaterialId.push({ 
            id: point.id, 
            materialId: payload.materialId 
          });
        } else if (normalizedId !== payload.materialId) {
          issues.oldFormat.push({
            id: point.id,
            old: payload.materialId,
            new: normalizedId
          });
        }

        // Check page number validity
        if (!validatePageNumber(normalizedId || payload.materialId, payload.pageNumber)) {
          issues.invalidPageNumber.push({
            id: point.id,
            materialId: payload.materialId,
            pageNumber: payload.pageNumber
          });
        }

        // Collect statistics
        const mid = normalizedId || payload.materialId;
        if (!materialStats[mid]) {
          materialStats[mid] = { count: 0, pages: new Set() };
        }
        materialStats[mid].count++;
        materialStats[mid].pages.add(payload.pageNumber);
      }

      // Report findings
      console.log('\n📈 Material Statistics:');
      for (const [materialId, stats] of Object.entries(materialStats)) {
        console.log(`  ${materialId}:`);
        console.log(`    - Points: ${stats.count}`);
        console.log(`    - Unique pages: ${stats.pages.size}`);
      }

      console.log('\n⚠️ Data Quality Issues:');
      console.log(`  Invalid materialId: ${issues.invalidMaterialId.length}`);
      console.log(`  Invalid page numbers: ${issues.invalidPageNumber.length}`);
      console.log(`  Missing fields: ${issues.missingFields.length}`);
      console.log(`  Old format: ${issues.oldFormat.length}`);

      if (issues.oldFormat.length > 0) {
        console.log('\n📝 Sample of old format issues:');
        issues.oldFormat.slice(0, 5).forEach(issue => {
          console.log(`    ${issue.old} → ${issue.new}`);
        });
      }

      return issues;
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`\n❌ Collection '${this.collection}' does not exist`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete the collection
   */
  async deleteCollection() {
    console.log(`\n🗑️ Deleting collection '${this.collection}'...`);
    
    try {
      const result = await this.client.deleteCollection(this.collection);
      console.log('  ✅ Collection deleted successfully');
      return result;
    } catch (error: any) {
      if (error.status === 404) {
        console.log('  ℹ️ Collection does not exist (already deleted)');
        return true;
      }
      throw error;
    }
  }

  /**
   * Create a new collection with optimal settings
   */
  async createCollection() {
    console.log(`\n🏗️ Creating collection '${this.collection}'...`);
    
    try {
      const result = await this.client.createCollection(this.collection, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension
          distance: 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      } as any);
      
      console.log('  ✅ Collection created successfully');
      return result;
    } catch (error: any) {
      if (error.status === 409) {
        console.log('  ⚠️ Collection already exists');
        return false;
      }
      throw error;
    }
  }

  /**
   * Reset collection (delete and recreate)
   */
  async resetCollection() {
    console.log('\n🔄 Resetting collection...');
    
    // Delete existing collection
    await this.deleteCollection();
    
    // Wait a moment for consistency
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create new collection
    await this.createCollection();
    
    console.log('  ✅ Collection reset complete');
  }

  /**
   * Clean up invalid records
   */
  async cleanupInvalidRecords() {
    console.log('\n🧹 Cleaning up invalid records...');
    
    const issues = await this.analyzeDataQuality(1000);
    if (!issues) return;

    const toDelete: string[] = [];
    
    // Collect IDs to delete
    issues.invalidMaterialId.forEach(i => toDelete.push(i.id));
    issues.invalidPageNumber.forEach(i => toDelete.push(i.id));
    issues.missingFields.forEach(i => toDelete.push(i.id));
    
    if (toDelete.length === 0) {
      console.log('  ✅ No invalid records to clean up');
      return;
    }

    console.log(`  Found ${toDelete.length} invalid records to delete`);
    
    // Delete in batches
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await this.client.delete(this.collection, {
        points: batch
      });
      console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toDelete.length / batchSize)}`);
    }
    
    console.log('  ✅ Cleanup complete');
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Get configuration from environment
  const config: QdrantConfig = {
    url: process.env.QDRANT_URL as string,
    apiKey: process.env.QDRANT_API_KEY,
    collection: process.env.QDRANT_COLLECTION || 'materials_passages'
  };

  if (!config.url) {
    console.error('❌ QDRANT_URL not set in environment');
    process.exit(1);
  }

  console.log('🚀 Qdrant Admin Tool');
  console.log('====================');
  console.log(`URL: ${config.url}`);
  console.log(`Collection: ${config.collection}`);

  const admin = new QdrantAdmin(config);

  try {
    switch (command) {
      case 'info':
        await admin.getCollectionInfo();
        break;
      
      case 'analyze':
        await admin.analyzeDataQuality(500);
        break;
      
      case 'delete':
        console.log('\n⚠️ WARNING: This will delete all data in the collection!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await admin.deleteCollection();
        break;
      
      case 'create':
        await admin.createCollection();
        break;
      
      case 'reset':
        console.log('\n⚠️ WARNING: This will delete and recreate the collection!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await admin.resetCollection();
        break;
      
      case 'cleanup':
        await admin.cleanupInvalidRecords();
        break;
      
      default:
        console.log('\nUsage: tsx scripts/qdrant-admin.ts <command>');
        console.log('\nCommands:');
        console.log('  info     - Show collection information');
        console.log('  analyze  - Analyze data quality');
        console.log('  delete   - Delete the collection');
        console.log('  create   - Create a new collection');
        console.log('  reset    - Delete and recreate the collection');
        console.log('  cleanup  - Remove invalid records');
        
        // Show current status
        console.log('\nCurrent status:');
        await admin.getCollectionInfo();
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { QdrantAdmin };