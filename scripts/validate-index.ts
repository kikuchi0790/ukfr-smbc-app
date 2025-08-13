#!/usr/bin/env tsx
/**
 * Material Index Validator
 * 
 * Validates the integrity and correctness of the material index:
 * - materialId format validation
 * - Page number range validation
 * - Embedding completeness check
 * - Statistical analysis
 */

import fs from 'node:fs/promises';
import path from 'node:path';
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

interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  materials: Record<string, MaterialStats>;
  issues: ValidationIssues;
  summary: string;
}

interface MaterialStats {
  recordCount: number;
  pageCount: number;
  pageNumbers: number[];
  minPage: number;
  maxPage: number;
  averageChunkSize: number;
  hasEmbeddings: boolean;
}

interface ValidationIssues {
  invalidMaterialId: Array<{ id: string; materialId: string }>;
  invalidPageNumber: Array<{ id: string; materialId: string; page: number }>;
  missingEmbedding: Array<{ id: string }>;
  duplicateIds: Array<{ id: string; count: number }>;
  invalidFormat: Array<{ id: string; issue: string }>;
  warnings: string[];
}

class IndexValidator {
  private records: IndexRecord[] = [];
  private report: ValidationReport;

  constructor() {
    this.report = {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      materials: {},
      issues: {
        invalidMaterialId: [],
        invalidPageNumber: [],
        missingEmbedding: [],
        duplicateIds: [],
        invalidFormat: [],
        warnings: []
      },
      summary: ''
    };
  }

  /**
   * Load and validate index file
   */
  async loadIndex(filePath: string): Promise<boolean> {
    console.log(`\n📂 Loading index from: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        throw new Error('Index file must contain an array of records');
      }
      
      this.records = data;
      this.report.totalRecords = this.records.length;
      console.log(`  ✅ Loaded ${this.records.length} records`);
      
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to load index: ${error}`);
      return false;
    }
  }

  /**
   * Validate all records
   */
  async validate(): Promise<ValidationReport> {
    console.log('\n🔍 Validating index...');
    
    const idCounts = new Map<string, number>();
    const materialPages = new Map<string, Set<number>>();
    
    for (const record of this.records) {
      let isValid = true;
      
      // Check for duplicate IDs
      const count = (idCounts.get(record.id) || 0) + 1;
      idCounts.set(record.id, count);
      
      // Validate required fields
      if (!record.id || !record.materialId || typeof record.pageNumber !== 'number') {
        this.report.issues.invalidFormat.push({
          id: record.id || 'unknown',
          issue: 'Missing required fields'
        });
        isValid = false;
      }
      
      // Validate materialId format
      const normalizedId = normalizeMaterialId(record.materialId);
      if (!normalizedId) {
        this.report.issues.invalidMaterialId.push({
          id: record.id,
          materialId: record.materialId
        });
        isValid = false;
      } else if (normalizedId !== record.materialId) {
        this.report.issues.warnings.push(
          `Record ${record.id}: materialId '${record.materialId}' should be '${normalizedId}'`
        );
      }
      
      // Validate page number
      if (!validatePageNumber(normalizedId || record.materialId, record.pageNumber)) {
        this.report.issues.invalidPageNumber.push({
          id: record.id,
          materialId: record.materialId,
          page: record.pageNumber
        });
        isValid = false;
      }
      
      // Check embedding
      if (!record.embedding || record.embedding.length === 0) {
        this.report.issues.missingEmbedding.push({ id: record.id });
        isValid = false;
      } else if (record.embedding.length !== 1536) {
        this.report.issues.warnings.push(
          `Record ${record.id}: Unexpected embedding dimension ${record.embedding.length} (expected 1536)`
        );
      }
      
      // Update statistics
      if (isValid) {
        this.report.validRecords++;
        
        const mid = normalizedId || record.materialId;
        if (!materialPages.has(mid)) {
          materialPages.set(mid, new Set());
        }
        materialPages.get(mid)!.add(record.pageNumber);
        
        if (!this.report.materials[mid]) {
          this.report.materials[mid] = {
            recordCount: 0,
            pageCount: 0,
            pageNumbers: [],
            minPage: Infinity,
            maxPage: -Infinity,
            averageChunkSize: 0,
            hasEmbeddings: true
          };
        }
        
        const stats = this.report.materials[mid];
        stats.recordCount++;
        stats.minPage = Math.min(stats.minPage, record.pageNumber);
        stats.maxPage = Math.max(stats.maxPage, record.pageNumber);
        stats.averageChunkSize += record.plainText?.length || 0;
        stats.hasEmbeddings = stats.hasEmbeddings && (record.embedding?.length > 0);
      } else {
        this.report.invalidRecords++;
      }
    }
    
    // Find duplicate IDs
    for (const [id, count] of idCounts.entries()) {
      if (count > 1) {
        this.report.issues.duplicateIds.push({ id, count });
      }
    }
    
    // Finalize material statistics
    for (const [mid, pages] of materialPages.entries()) {
      const stats = this.report.materials[mid];
      stats.pageCount = pages.size;
      stats.pageNumbers = Array.from(pages).sort((a, b) => a - b);
      stats.averageChunkSize = Math.round(stats.averageChunkSize / stats.recordCount);
    }
    
    // Generate summary
    this.generateSummary();
    
    return this.report;
  }

  /**
   * Generate validation summary
   */
  private generateSummary() {
    const { totalRecords, validRecords, invalidRecords, issues } = this.report;
    const validPercent = ((validRecords / totalRecords) * 100).toFixed(1);
    
    let summary = `Validation Complete:\n`;
    summary += `  Total Records: ${totalRecords}\n`;
    summary += `  Valid: ${validRecords} (${validPercent}%)\n`;
    summary += `  Invalid: ${invalidRecords}\n`;
    
    if (invalidRecords > 0) {
      summary += `\nIssues Found:\n`;
      if (issues.invalidMaterialId.length > 0) {
        summary += `  - Invalid materialId: ${issues.invalidMaterialId.length}\n`;
      }
      if (issues.invalidPageNumber.length > 0) {
        summary += `  - Invalid page numbers: ${issues.invalidPageNumber.length}\n`;
      }
      if (issues.missingEmbedding.length > 0) {
        summary += `  - Missing embeddings: ${issues.missingEmbedding.length}\n`;
      }
      if (issues.duplicateIds.length > 0) {
        summary += `  - Duplicate IDs: ${issues.duplicateIds.length}\n`;
      }
    }
    
    this.report.summary = summary;
  }

  /**
   * Print detailed report
   */
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(60));
    
    // Overall statistics
    console.log('\n📈 Overall Statistics:');
    console.log(`  Total Records: ${this.report.totalRecords}`);
    console.log(`  Valid Records: ${this.report.validRecords} (${((this.report.validRecords / this.report.totalRecords) * 100).toFixed(1)}%)`);
    console.log(`  Invalid Records: ${this.report.invalidRecords}`);
    
    // Material breakdown
    console.log('\n📚 Material Breakdown:');
    for (const [materialId, stats] of Object.entries(this.report.materials)) {
      console.log(`\n  ${materialId}:`);
      console.log(`    - Records: ${stats.recordCount}`);
      console.log(`    - Pages: ${stats.pageCount} (${stats.minPage}-${stats.maxPage})`);
      console.log(`    - Avg chunk size: ${stats.averageChunkSize} chars`);
      console.log(`    - Has embeddings: ${stats.hasEmbeddings ? '✅' : '❌'}`);
      
      // Check for missing pages
      const expectedPages = stats.maxPage - stats.minPage + 1;
      if (stats.pageCount < expectedPages) {
        const missing = [];
        for (let p = stats.minPage; p <= stats.maxPage; p++) {
          if (!stats.pageNumbers.includes(p)) {
            missing.push(p);
          }
        }
        if (missing.length > 0) {
          console.log(`    ⚠️ Missing pages: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);
        }
      }
    }
    
    // Issues
    if (this.report.invalidRecords > 0) {
      console.log('\n⚠️ Issues Found:');
      
      if (this.report.issues.invalidMaterialId.length > 0) {
        console.log(`\n  Invalid materialId (${this.report.issues.invalidMaterialId.length}):`);
        this.report.issues.invalidMaterialId.slice(0, 5).forEach(issue => {
          console.log(`    - ${issue.id}: ${issue.materialId}`);
        });
        if (this.report.issues.invalidMaterialId.length > 5) {
          console.log(`    ... and ${this.report.issues.invalidMaterialId.length - 5} more`);
        }
      }
      
      if (this.report.issues.invalidPageNumber.length > 0) {
        console.log(`\n  Invalid page numbers (${this.report.issues.invalidPageNumber.length}):`);
        this.report.issues.invalidPageNumber.slice(0, 5).forEach(issue => {
          console.log(`    - ${issue.id}: page ${issue.page} for ${issue.materialId}`);
        });
        if (this.report.issues.invalidPageNumber.length > 5) {
          console.log(`    ... and ${this.report.issues.invalidPageNumber.length - 5} more`);
        }
      }
      
      if (this.report.issues.missingEmbedding.length > 0) {
        console.log(`\n  Missing embeddings: ${this.report.issues.missingEmbedding.length} records`);
      }
      
      if (this.report.issues.duplicateIds.length > 0) {
        console.log(`\n  Duplicate IDs (${this.report.issues.duplicateIds.length}):`);
        this.report.issues.duplicateIds.slice(0, 5).forEach(issue => {
          console.log(`    - ${issue.id}: appears ${issue.count} times`);
        });
      }
    }
    
    // Warnings
    if (this.report.issues.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.report.issues.warnings.slice(0, 10).forEach(warning => {
        console.log(`  - ${warning}`);
      });
      if (this.report.issues.warnings.length > 10) {
        console.log(`  ... and ${this.report.issues.warnings.length - 10} more warnings`);
      }
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (this.report.invalidRecords === 0) {
      console.log('✅ Index validation PASSED - All records are valid!');
    } else if (this.report.invalidRecords < this.report.totalRecords * 0.01) {
      console.log('⚠️ Index validation PASSED WITH WARNINGS - Less than 1% invalid records');
    } else {
      console.log('❌ Index validation FAILED - Too many invalid records');
    }
    console.log('='.repeat(60));
  }

  /**
   * Export issues to file for further analysis
   */
  async exportIssues(outputPath: string) {
    const issuesFile = {
      timestamp: new Date().toISOString(),
      report: this.report
    };
    
    await fs.writeFile(outputPath, JSON.stringify(issuesFile, null, 2));
    console.log(`\n💾 Issues exported to: ${outputPath}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const indexPath = args[0] || path.join(process.cwd(), 'services/data/materials_index.json');
  
  console.log('🚀 Material Index Validator');
  console.log('===========================');
  
  const validator = new IndexValidator();
  
  // Load index
  const loaded = await validator.loadIndex(indexPath);
  if (!loaded) {
    process.exit(1);
  }
  
  // Validate
  const report = await validator.validate();
  
  // Print report
  validator.printReport();
  
  // Export issues if requested
  if (args.includes('--export')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(process.cwd(), `validation-report-${timestamp}.json`);
    await validator.exportIssues(outputPath);
  }
  
  // Exit with appropriate code
  if (report.invalidRecords === 0) {
    process.exit(0);
  } else if (report.invalidRecords < report.totalRecords * 0.01) {
    process.exit(0); // Warning but pass
  } else {
    process.exit(1); // Fail
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { IndexValidator };