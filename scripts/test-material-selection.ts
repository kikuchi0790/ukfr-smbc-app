#!/usr/bin/env tsx
/**
 * Material Selection Accuracy Test
 * 
 * Tests the MaterialSelector's ability to choose between
 * Study Companion and Checkpoint materials
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { MaterialSelector, type MaterialSelection, type SearchPassage } from '../services/material-selector';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
}

interface TestCase {
  id: string;
  question: string;
  expectedMaterial: 'UKFR_ED32_Study_Companion' | 'UKFR_ED32_Checkpoint';
  explanation: string;
  mockPassages: SearchPassage[];
}

// Test cases with known expected outcomes
const TEST_CASES: TestCase[] = [
  {
    id: 'fscs-limit',
    question: 'What is the FSCS compensation limit for deposits?',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    explanation: 'FSCS detailed information is in Study Companion',
    mockPassages: [
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 49,
        quote: 'The FSCS provides compensation up to £85,000 for deposits held by authorised firms',
        score: 0.92
      },
      {
        materialId: 'UKFR_ED32_Checkpoint',
        page: 15,
        quote: 'FSCS scheme limits apply to different products',
        score: 0.75
      }
    ]
  },
  {
    id: 'practical-complaint',
    question: 'How should a firm handle a customer complaint?',
    expectedMaterial: 'UKFR_ED32_Checkpoint',
    explanation: 'Practical procedures are better covered in Checkpoint',
    mockPassages: [
      {
        materialId: 'UKFR_ED32_Checkpoint',
        page: 22,
        quote: 'Step 1: Acknowledge the complaint within 48 hours. Step 2: Investigate thoroughly',
        score: 0.88
      },
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 78,
        quote: 'The theoretical framework for complaint handling involves multiple considerations',
        score: 0.72
      }
    ]
  },
  {
    id: 'regulatory-framework',
    question: 'Explain the FCA regulatory framework and its principles',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    explanation: 'Detailed regulatory explanations are in Study Companion',
    mockPassages: [
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 12,
        quote: 'The FCA regulatory framework consists of 11 Principles for Businesses which form the fundamental obligations',
        score: 0.94
      },
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 13,
        quote: 'These principles are supplemented by detailed rules and guidance',
        score: 0.89
      }
    ]
  },
  {
    id: 'calculation-example',
    question: 'Calculate the interest rate swap margin for a £1,000,000 transaction',
    expectedMaterial: 'UKFR_ED32_Checkpoint',
    explanation: 'Calculation examples are typically in Checkpoint',
    mockPassages: [
      {
        materialId: 'UKFR_ED32_Checkpoint',
        page: 38,
        quote: 'Example: For a £1,000,000 swap, calculate margin as follows: Base rate + 2.5%',
        score: 0.91
      },
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 95,
        quote: 'Interest rate swaps are derivative instruments used for hedging',
        score: 0.68
      }
    ]
  },
  {
    id: 'definition-mifid',
    question: 'What is MiFID and its main objectives?',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    explanation: 'Definitions and detailed objectives are in Study Companion',
    mockPassages: [
      {
        materialId: 'UKFR_ED32_Study_Companion',
        page: 55,
        quote: 'MiFID (Markets in Financial Instruments Directive) is a European Union law that provides harmonized regulation',
        score: 0.93
      },
      {
        materialId: 'UKFR_ED32_Checkpoint',
        page: 28,
        quote: 'MiFID compliance checklist',
        score: 0.65
      }
    ]
  }
];

class MaterialSelectionTester {
  private selector: MaterialSelector;
  private results: Array<{
    testId: string;
    question: string;
    expected: string;
    actual: string;
    confidence: string;
    passed: boolean;
    reasoning: string;
    scores: { studyCompanion: number; checkpoint: number };
  }> = [];

  constructor() {
    this.selector = new MaterialSelector();
  }

  /**
   * Run a single test case
   */
  runTest(testCase: TestCase): boolean {
    console.log(`\n🧪 Testing: ${testCase.id}`);
    console.log(`  Question: ${testCase.question}`);
    
    // Run material selection
    const selection = this.selector.selectOptimalMaterial(
      testCase.question,
      testCase.mockPassages
    );
    
    // Check if selection matches expectation
    const passed = selection.primary === testCase.expectedMaterial;
    
    // Record result
    this.results.push({
      testId: testCase.id,
      question: testCase.question,
      expected: testCase.expectedMaterial,
      actual: selection.primary,
      confidence: selection.confidence,
      passed,
      reasoning: selection.reasoning,
      scores: selection.scores
    });
    
    // Display result
    const expectedName = testCase.expectedMaterial.includes('Study_Companion') ? 'Study Companion' : 'Checkpoint';
    const actualName = selection.primary.includes('Study_Companion') ? 'Study Companion' : 'Checkpoint';
    
    console.log(`  Expected: ${expectedName}`);
    console.log(`  Actual: ${actualName} (${selection.confidence} confidence)`);
    console.log(`  Scores: SC=${selection.scores.studyCompanion}, CP=${selection.scores.checkpoint}`);
    console.log(`  ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    return passed;
  }

  /**
   * Run all test cases
   */
  runAllTests(): void {
    console.log('🚀 Material Selection Test Suite');
    console.log('================================\n');
    
    for (const testCase of TEST_CASES) {
      this.runTest(testCase);
    }
  }

  /**
   * Test with real API data
   */
  async testWithRealData(question: string): Promise<void> {
    console.log('\n🌐 Testing with Real API Data');
    console.log('==============================');
    console.log(`Question: ${question}\n`);
    
    try {
      // Call retrieve API
      const response = await fetch('http://localhost:3000/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data?.passages) {
        throw new Error('No passages returned');
      }
      
      const passages = data.data.passages.map((p: any) => ({
        materialId: p.materialId,
        page: p.page,
        quote: p.quote,
        score: p.score
      }));
      
      console.log(`Retrieved ${passages.length} passages\n`);
      
      // Run material selection
      const selection = this.selector.selectOptimalMaterial(question, passages);
      
      console.log('📊 Selection Result:');
      console.log(`  Primary: ${selection.primary.includes('Study_Companion') ? 'Study Companion' : 'Checkpoint'}`);
      console.log(`  Confidence: ${selection.confidence}`);
      console.log(`  Scores: SC=${selection.scores.studyCompanion}, CP=${selection.scores.checkpoint}`);
      console.log(`  Reasoning: ${selection.reasoning}`);
      
      // Show top passages from selected material
      const filteredPassages = this.selector.filterPassagesByMaterial(passages, selection.primary);
      console.log(`\n📄 Top passages from selected material (${filteredPassages.length} total):`);
      filteredPassages.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. Page ${p.page} (score: ${p.score.toFixed(3)})`);
        console.log(`     "${p.quote.slice(0, 100)}..."`);
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }

  /**
   * Generate test report
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST REPORT');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const accuracy = (passed / total * 100).toFixed(1);
    
    console.log(`\n📈 Overall Results:`);
    console.log(`  Total Tests: ${total}`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${total - passed}`);
    console.log(`  Accuracy: ${accuracy}%`);
    
    // Confidence distribution
    const highConf = this.results.filter(r => r.confidence === 'high').length;
    const medConf = this.results.filter(r => r.confidence === 'medium').length;
    const lowConf = this.results.filter(r => r.confidence === 'low').length;
    
    console.log(`\n🎯 Confidence Distribution:`);
    console.log(`  High: ${highConf} (${(highConf/total*100).toFixed(1)}%)`);
    console.log(`  Medium: ${medConf} (${(medConf/total*100).toFixed(1)}%)`);
    console.log(`  Low: ${lowConf} (${(lowConf/total*100).toFixed(1)}%)`);
    
    // Failed tests
    const failed = this.results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      failed.forEach(r => {
        const expectedName = r.expected.includes('Study_Companion') ? 'Study Companion' : 'Checkpoint';
        const actualName = r.actual.includes('Study_Companion') ? 'Study Companion' : 'Checkpoint';
        console.log(`  ${r.testId}:`);
        console.log(`    Expected: ${expectedName}, Got: ${actualName}`);
        console.log(`    Confidence: ${r.confidence}`);
        console.log(`    Scores: SC=${r.scores.studyCompanion}, CP=${r.scores.checkpoint}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (accuracy === '100.0') {
      console.log('🎉 PERFECT! All tests passed!');
    } else if (parseFloat(accuracy) >= 80) {
      console.log('✅ Good accuracy - material selection is working well');
    } else if (parseFloat(accuracy) >= 60) {
      console.log('⚠️ Moderate accuracy - tuning needed');
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
  const tester = new MaterialSelectionTester();
  
  console.log('🎯 Material Selection Tester');
  console.log('============================');
  
  // Run mock tests
  tester.runAllTests();
  tester.generateReport();
  
  // Test with real data if --real flag is provided
  if (args.includes('--real')) {
    const testQuestions = [
      'What is the FSCS compensation limit for deposits?',
      'How should a firm handle MiFID compliance?',
      'Explain the Senior Managers and Certification Regime'
    ];
    
    for (const question of testQuestions) {
      await tester.testWithRealData(question);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
  }
  
  // Export results if requested
  if (args.includes('--export')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(process.cwd(), `material-selection-${timestamp}.json`);
    await tester.exportResults(outputPath);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MaterialSelectionTester };