#!/usr/bin/env tsx
/**
 * RAG Accuracy Test Script
 * 
 * Tests the accuracy of RAG search results:
 * - Tests with real questions
 * - Verifies materialId and page number accuracy
 * - Measures performance
 * - Generates accuracy report
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeMaterialId, validatePageNumber } from '../utils/material-utils';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
}

interface TestCase {
  id: string;
  question: string;
  explanation?: string;
  expectedMaterial?: string;
  expectedPageRange?: [number, number];
  keywords?: string[];
}

interface TestResult {
  testId: string;
  question: string;
  passed: boolean;
  materialId?: string;
  pageNumber?: number;
  responseTime: number;
  error?: string;
  details?: any;
}

// Test cases based on known issues and important topics
const TEST_CASES: TestCase[] = [
  {
    id: 'fscs-limit',
    question: 'What is the FSCS compensation limit for deposits?',
    explanation: 'The Financial Services Compensation Scheme provides compensation up to £85,000 for deposits.',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    expectedPageRange: [49, 52],
    keywords: ['FSCS', '£85,000', 'deposit', 'compensation']
  },
  {
    id: 'fscs-claim',
    question: 'In what circumstances could a claim on the Financial Services Compensation Scheme be made?',
    explanation: 'The Financial Services Compensation Scheme was established to provide compensation where authorised persons are unable to satisfy claims against them.',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    expectedPageRange: [49, 52],
    keywords: ['FSCS', 'authorised', 'insolvent', 'claim']
  },
  {
    id: 'mifid-complaint',
    question: 'If a firm receives a complaint with respect to MiFID business and deals with it within two weeks, how long is it necessary to keep the record of the complaint?',
    explanation: 'With MiFID business, the records must be kept for at least five years.',
    keywords: ['MiFID', 'complaint', 'record', 'five years']
  },
  {
    id: 'fca-principles',
    question: 'What are the FCA Principles for Businesses?',
    explanation: 'The FCA has 11 Principles for Businesses that apply to all authorized firms.',
    expectedMaterial: 'UKFR_ED32_Checkpoint',
    keywords: ['FCA', 'principles', 'business']
  },
  {
    id: 'senior-managers',
    question: 'What is the Senior Managers and Certification Regime (SMCR)?',
    explanation: 'The SMCR aims to reduce harm to consumers and strengthen market integrity.',
    keywords: ['SMCR', 'senior managers', 'certification', 'regime']
  }
];

class RagAccuracyTester {
  private results: TestResult[] = [];
  private apiUrl: string;

  constructor(apiUrl: string = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  /**
   * Run a single test case
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    console.log(`\n🧪 Testing: ${testCase.id}`);
    console.log(`  Question: ${testCase.question.slice(0, 80)}...`);
    
    const startTime = Date.now();
    const result: TestResult = {
      testId: testCase.id,
      question: testCase.question,
      passed: false,
      responseTime: 0
    };

    try {
      // Call retrieve API
      const retrieveResponse = await fetch(`${this.apiUrl}/api/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testCase.question,
          explanation: testCase.explanation,
          k: 6,
          useFullQuestion: false
        })
      });

      if (!retrieveResponse.ok) {
        throw new Error(`Retrieve API failed: ${retrieveResponse.status}`);
      }

      const retrieveData = await retrieveResponse.json();
      
      if (!retrieveData.success || !retrieveData.data?.passages) {
        throw new Error('No passages returned');
      }

      const passages = retrieveData.data.passages;
      console.log(`  Retrieved ${passages.length} passages`);

      // Call rerank API if passages exist
      if (passages.length > 0) {
        const rerankResponse = await fetch(`${this.apiUrl}/api/rerank`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: testCase.question,
            passages: passages.slice(0, 10),
            explanation: testCase.explanation
          })
        });

        if (rerankResponse.ok) {
          const rerankData = await rerankResponse.json();
          
          if (rerankData.success && rerankData.data) {
            const topResult = passages.find((p: any) => p.page === rerankData.data.page) || passages[0];
            
            // Normalize materialId
            const normalizedId = normalizeMaterialId(topResult.materialId);
            
            result.materialId = normalizedId;
            result.pageNumber = topResult.page;
            result.details = {
              score: topResult.score,
              confidence: rerankData.data.confidence,
              reasoning: rerankData.data.reasoning
            };
            
            console.log(`  Result: ${normalizedId} page ${topResult.page}`);
            
            // Check if result matches expectations
            if (testCase.expectedMaterial) {
              if (normalizedId === testCase.expectedMaterial) {
                console.log(`  ✅ Correct material`);
                
                if (testCase.expectedPageRange) {
                  const [minPage, maxPage] = testCase.expectedPageRange;
                  if (topResult.page >= minPage && topResult.page <= maxPage) {
                    console.log(`  ✅ Page in expected range [${minPage}-${maxPage}]`);
                    result.passed = true;
                  } else {
                    console.log(`  ❌ Page ${topResult.page} outside expected range [${minPage}-${maxPage}]`);
                  }
                } else {
                  result.passed = true;
                }
              } else {
                console.log(`  ❌ Wrong material: expected ${testCase.expectedMaterial}`);
              }
            } else {
              // No specific expectation, just check validity
              if (validatePageNumber(normalizedId, topResult.page)) {
                result.passed = true;
                console.log(`  ✅ Valid result`);
              } else {
                console.log(`  ❌ Invalid page number for material`);
              }
            }
          }
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error: ${result.error}`);
    }

    result.responseTime = Date.now() - startTime;
    console.log(`  Response time: ${result.responseTime}ms`);
    
    this.results.push(result);
    return result;
  }

  /**
   * Run all test cases
   */
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting RAG Accuracy Tests');
    console.log('================================\n');
    
    for (const testCase of TEST_CASES) {
      await this.runTest(testCase);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Generate accuracy report
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ACCURACY REPORT');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const accuracy = (passed / total * 100).toFixed(1);
    
    console.log(`\n📈 Overall Results:`);
    console.log(`  Total Tests: ${total}`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${total - passed}`);
    console.log(`  Accuracy: ${accuracy}%`);
    
    // Performance statistics
    const responseTimes = this.results.map(r => r.responseTime);
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);
    const minTime = Math.min(...responseTimes);
    
    console.log(`\n⏱️ Performance:`);
    console.log(`  Average Response Time: ${avgTime.toFixed(0)}ms`);
    console.log(`  Min Response Time: ${minTime}ms`);
    console.log(`  Max Response Time: ${maxTime}ms`);
    
    // Material distribution
    const materialCounts: Record<string, number> = {};
    this.results.forEach(r => {
      if (r.materialId) {
        materialCounts[r.materialId] = (materialCounts[r.materialId] || 0) + 1;
      }
    });
    
    console.log(`\n📚 Material Distribution:`);
    for (const [material, count] of Object.entries(materialCounts)) {
      console.log(`  ${material}: ${count} results`);
    }
    
    // Failed tests details
    const failed = this.results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      failed.forEach(r => {
        console.log(`\n  ${r.testId}:`);
        console.log(`    Question: ${r.question.slice(0, 60)}...`);
        if (r.error) {
          console.log(`    Error: ${r.error}`);
        } else {
          console.log(`    Result: ${r.materialId} page ${r.pageNumber}`);
        }
      });
    }
    
    // Successful tests with high confidence
    const highConfidence = this.results.filter(r => 
      r.passed && r.details?.confidence === 'high'
    );
    
    if (highConfidence.length > 0) {
      console.log(`\n✅ High Confidence Results: ${highConfidence.length}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (accuracy === '100.0') {
      console.log('🎉 PERFECT SCORE! All tests passed!');
    } else if (parseFloat(accuracy) >= 80) {
      console.log('✅ Good accuracy - system is working well');
    } else if (parseFloat(accuracy) >= 60) {
      console.log('⚠️ Moderate accuracy - some improvements needed');
    } else {
      console.log('❌ Low accuracy - significant improvements required');
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Export results to JSON
   */
  async exportResults(outputPath: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        accuracy: (this.results.filter(r => r.passed).length / this.results.length * 100).toFixed(1) + '%'
      },
      results: this.results
    };
    
    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Results exported to: ${outputPath}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const apiUrl = args[0] || 'http://localhost:3000';
  
  console.log('🎯 RAG Accuracy Tester');
  console.log('======================');
  console.log(`API URL: ${apiUrl}`);
  
  const tester = new RagAccuracyTester(apiUrl);
  
  // Run tests
  await tester.runAllTests();
  
  // Generate report
  tester.generateReport();
  
  // Export results if requested
  if (args.includes('--export')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(process.cwd(), `rag-accuracy-${timestamp}.json`);
    await tester.exportResults(outputPath);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { RagAccuracyTester };