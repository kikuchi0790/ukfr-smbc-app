#!/usr/bin/env tsx
/**
 * Comprehensive RAG Accuracy and Speed Test
 * 
 * Tests multiple GPT model combinations for:
 * - Speed performance
 * - Accuracy of results
 * - Cost-effectiveness analysis
 * - Generates detailed comparison report
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
}

// Model configurations to test
interface ModelConfig {
  id: string;
  name: string;
  queryExpansionModel: string;
  rerankModel: string;
  expectedSpeed: string;
  expectedAccuracy: number;
  monthlyCost: number;
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'A',
    name: 'Production (GPT-5/5mini)',
    queryExpansionModel: 'gpt-5-2025-08-07',
    rerankModel: 'gpt-5-mini-2025-08-07',
    expectedSpeed: '24s',
    expectedAccuracy: 95,
    monthlyCost: 2000
  },
  {
    id: 'B',
    name: 'Balanced Plus (GPT-5mini/5mini)',
    queryExpansionModel: 'gpt-5-mini-2025-08-07',
    rerankModel: 'gpt-5-mini-2025-08-07',
    expectedSpeed: '18-20s',
    expectedAccuracy: 88,
    monthlyCost: 1500
  },
  {
    id: 'C',
    name: 'Balanced (GPT-4.1/4.1)',
    queryExpansionModel: 'gpt-4.1-2025-04-14',
    rerankModel: 'gpt-4.1-2025-04-14',
    expectedSpeed: '12-15s',
    expectedAccuracy: 82,
    monthlyCost: 800
  },
  {
    id: 'D',
    name: 'Speed Priority (GPT-5nano/5nano)',
    queryExpansionModel: 'gpt-5-nano-2025-08-07',
    rerankModel: 'gpt-5-nano-2025-08-07',
    expectedSpeed: '8-10s',
    expectedAccuracy: 65,
    monthlyCost: 200
  },
  {
    id: 'E',
    name: 'Hybrid Fast (GPT-5nano/4.1)',
    queryExpansionModel: 'gpt-5-nano-2025-08-07',
    rerankModel: 'gpt-4.1-2025-04-14',
    expectedSpeed: '10-12s',
    expectedAccuracy: 72,
    monthlyCost: 400
  },
  {
    id: 'F',
    name: 'Hybrid Accurate (GPT-4.1/5mini)',
    queryExpansionModel: 'gpt-4.1-2025-04-14',
    rerankModel: 'gpt-5-mini-2025-08-07',
    expectedSpeed: '15-18s',
    expectedAccuracy: 85,
    monthlyCost: 1200
  }
];

// Comprehensive test cases (20 questions across 4 categories)
interface TestCase {
  id: string;
  category: string;
  question: string;
  questionJa: string;
  explanation?: string;
  expectedMaterial?: string;
  expectedPageRange?: [number, number];
  keywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  weight: number; // Importance weight for scoring
}

const TEST_CASES: TestCase[] = [
  // Category 1: Numerical/Amount Questions (5)
  {
    id: 'num-1',
    category: 'Numerical',
    question: 'What is the FSCS compensation limit for deposits?',
    questionJa: 'FSCSの預金補償限度額はいくらですか？',
    explanation: 'The Financial Services Compensation Scheme provides compensation up to £85,000 for deposits.',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    expectedPageRange: [49, 52],
    keywords: ['FSCS', '£85,000', 'deposit', 'compensation'],
    difficulty: 'easy',
    weight: 1.5
  },
  {
    id: 'num-2',
    category: 'Numerical',
    question: 'What is the FSCS limit for joint accounts?',
    questionJa: '共同口座のFSCS限度額はいくらですか？',
    expectedMaterial: 'UKFR_ED32_Study_Companion',
    expectedPageRange: [49, 52],
    keywords: ['FSCS', '£150,000', 'joint account'],
    difficulty: 'medium',
    weight: 1.2
  },
  {
    id: 'num-3',
    category: 'Numerical',
    question: 'How long must MiFID complaint records be kept?',
    questionJa: 'MiFIDの苦情記録はどのくらいの期間保管する必要がありますか？',
    explanation: 'MiFID business complaint records must be kept for at least five years.',
    keywords: ['MiFID', 'complaint', 'five years', 'record'],
    difficulty: 'medium',
    weight: 1.0
  },
  {
    id: 'num-4',
    category: 'Numerical',
    question: 'What is the temporary high balance protection period?',
    questionJa: '一時的高額残高保護期間はどのくらいですか？',
    keywords: ['temporary', 'high balance', '6 months', 'protection'],
    difficulty: 'hard',
    weight: 1.1
  },
  {
    id: 'num-5',
    category: 'Numerical',
    question: 'Within how many months must the FCA annual report be submitted?',
    questionJa: 'FCA年次報告書は何ヶ月以内に提出する必要がありますか？',
    keywords: ['FCA', 'annual report', '4 months', 'submission'],
    difficulty: 'medium',
    weight: 0.9
  },

  // Category 2: Regulatory Framework (5)
  {
    id: 'reg-1',
    category: 'Regulatory',
    question: 'What are the FCA Principles for Businesses?',
    questionJa: 'FCAのビジネス原則とは何ですか？',
    explanation: 'The FCA has 11 Principles for Businesses that apply to all authorized firms.',
    expectedMaterial: 'UKFR_ED32_Checkpoint',
    keywords: ['FCA', 'principles', 'business', '11'],
    difficulty: 'easy',
    weight: 1.3
  },
  {
    id: 'reg-2',
    category: 'Regulatory',
    question: 'What is the Senior Managers and Certification Regime (SMCR)?',
    questionJa: 'シニアマネージャー・認証制度（SMCR）とは何ですか？',
    keywords: ['SMCR', 'senior managers', 'certification', 'accountability'],
    difficulty: 'medium',
    weight: 1.2
  },
  {
    id: 'reg-3',
    category: 'Regulatory',
    question: 'Explain the TCF (Treating Customers Fairly) principles',
    questionJa: 'TCF（顧客の公正な扱い）原則を説明してください',
    keywords: ['TCF', 'treating customers fairly', 'consumer', 'outcomes'],
    difficulty: 'medium',
    weight: 1.1
  },
  {
    id: 'reg-4',
    category: 'Regulatory',
    question: 'What are the main COBS rules for retail clients?',
    questionJa: 'リテール顧客向けの主要なCOBS規則は何ですか？',
    keywords: ['COBS', 'conduct of business', 'retail', 'clients'],
    difficulty: 'hard',
    weight: 1.0
  },
  {
    id: 'reg-5',
    category: 'Regulatory',
    question: 'What is covered under PRIN regulations?',
    questionJa: 'PRIN規制の対象は何ですか？',
    keywords: ['PRIN', 'principles', 'businesses', 'FCA'],
    difficulty: 'medium',
    weight: 1.0
  },

  // Category 3: Practical Procedures (5)
  {
    id: 'proc-1',
    category: 'Procedures',
    question: 'How should a firm handle a customer complaint?',
    questionJa: '企業は顧客の苦情をどのように処理すべきですか？',
    expectedMaterial: 'UKFR_ED32_Checkpoint',
    keywords: ['complaint', 'handling', 'acknowledge', 'investigate'],
    difficulty: 'easy',
    weight: 1.2
  },
  {
    id: 'proc-2',
    category: 'Procedures',
    question: 'What is the financial promotion approval process?',
    questionJa: '金融プロモーション承認プロセスとは何ですか？',
    keywords: ['financial promotion', 'approval', 'process', 'compliance'],
    difficulty: 'medium',
    weight: 1.0
  },
  {
    id: 'proc-3',
    category: 'Procedures',
    question: 'What are the KYC requirements for new clients?',
    questionJa: '新規顧客のKYC要件は何ですか？',
    keywords: ['KYC', 'know your customer', 'identification', 'verification'],
    difficulty: 'easy',
    weight: 1.1
  },
  {
    id: 'proc-4',
    category: 'Procedures',
    question: 'Describe the AML monitoring procedures',
    questionJa: 'AMLモニタリング手順を説明してください',
    keywords: ['AML', 'anti money laundering', 'monitoring', 'suspicious'],
    difficulty: 'medium',
    weight: 1.2
  },
  {
    id: 'proc-5',
    category: 'Procedures',
    question: 'What is the risk assessment process for new products?',
    questionJa: '新商品のリスク評価プロセスとは何ですか？',
    keywords: ['risk assessment', 'new products', 'evaluation', 'approval'],
    difficulty: 'hard',
    weight: 0.9
  },

  // Category 4: Complex Integrated Questions (5)
  {
    id: 'complex-1',
    category: 'Complex',
    question: 'How do FCA and PRA regulations interact for dual-regulated firms?',
    questionJa: '二重規制企業におけるFCAとPRA規制の相互作用はどのようなものですか？',
    keywords: ['FCA', 'PRA', 'dual-regulated', 'interaction'],
    difficulty: 'hard',
    weight: 1.5
  },
  {
    id: 'complex-2',
    category: 'Complex',
    question: 'What are the exceptions to the general prohibition under FSMA 2000?',
    questionJa: 'FSMA 2000における一般的禁止の例外は何ですか？',
    keywords: ['FSMA', 'general prohibition', 'exceptions', 'authorized'],
    difficulty: 'hard',
    weight: 1.3
  },
  {
    id: 'complex-3',
    category: 'Complex',
    question: 'How do UK regulations align with MiFID II requirements?',
    questionJa: '英国規制はMiFID II要件とどのように整合していますか？',
    keywords: ['MiFID II', 'UK regulations', 'alignment', 'implementation'],
    difficulty: 'hard',
    weight: 1.2
  },
  {
    id: 'complex-4',
    category: 'Complex',
    question: 'What are the implications of recent regulatory changes post-Brexit?',
    questionJa: 'Brexit後の最近の規制変更の影響は何ですか？',
    keywords: ['Brexit', 'regulatory changes', 'divergence', 'UK'],
    difficulty: 'hard',
    weight: 1.4
  },
  {
    id: 'complex-5',
    category: 'Complex',
    question: 'How do case law precedents affect FCA enforcement actions?',
    questionJa: '判例がFCA執行措置にどのように影響しますか？',
    keywords: ['case law', 'precedents', 'FCA', 'enforcement'],
    difficulty: 'hard',
    weight: 1.1
  }
];

// Test result interface
interface TestResult {
  configId: string;
  configName: string;
  testCaseId: string;
  category: string;
  passed: boolean;
  materialCorrect: boolean;
  pageCorrect: boolean;
  responseTime: number;
  score: number;
  confidence?: string;
  error?: string;
}

// Summary statistics
interface ConfigSummary {
  configId: string;
  configName: string;
  totalTests: number;
  passed: number;
  accuracy: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  categoryScores: Record<string, number>;
  totalScore: number;
  monthlyCost: number;
  speedImprovement: number; // vs baseline
  costEfficiency: number; // accuracy per dollar
}

class ComprehensiveRagTester {
  private results: TestResult[] = [];
  private summaries: ConfigSummary[] = [];
  private apiUrl: string;
  private baselineSpeed: number = 24000; // 24 seconds baseline

  constructor(apiUrl: string = 'http://localhost:3002') {
    this.apiUrl = apiUrl;
  }

  /**
   * Set environment variables for a specific model configuration
   */
  private async setModelConfig(config: ModelConfig): Promise<void> {
    process.env.OPENAI_QUERY_EXPANSION_MODEL = config.queryExpansionModel;
    process.env.OPENAI_RERANK_MODEL = config.rerankModel;
    
    console.log(`\n🔧 Configuration set:`);
    console.log(`  Query Expansion: ${config.queryExpansionModel}`);
    console.log(`  Reranking: ${config.rerankModel}`);
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(testCase: TestCase, config: ModelConfig): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      configId: config.id,
      configName: config.name,
      testCaseId: testCase.id,
      category: testCase.category,
      passed: false,
      materialCorrect: false,
      pageCorrect: false,
      responseTime: 0,
      score: 0
    };

    try {
      // Call retrieve API
      const retrieveResponse = await fetch(`${this.apiUrl}/api/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: testCase.questionJa, // Use Japanese question
          explanation: testCase.explanation,
          k: 10,
          useAdvancedSearch: true
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

      // Call rerank API
      if (passages.length > 0) {
        const rerankResponse = await fetch(`${this.apiUrl}/api/rerank`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: testCase.questionJa,
            passages: passages.slice(0, 10),
            explanation: testCase.explanation
          })
        });

        if (rerankResponse.ok) {
          const rerankData = await rerankResponse.json();
          
          if (rerankData.success && rerankData.data) {
            const topResult = passages.find((p: any) => p.page === rerankData.data.page) || passages[0];
            
            // Evaluate accuracy
            if (testCase.expectedMaterial) {
              result.materialCorrect = topResult.materialId === testCase.expectedMaterial;
              
              if (testCase.expectedPageRange) {
                const [minPage, maxPage] = testCase.expectedPageRange;
                result.pageCorrect = topResult.page >= minPage && topResult.page <= maxPage;
              }
            }
            
            result.confidence = rerankData.data.confidence;
            
            // Calculate score based on multiple factors
            let score = 0;
            if (result.materialCorrect) score += 40;
            if (result.pageCorrect) score += 30;
            if (result.confidence === 'high') score += 20;
            else if (result.confidence === 'medium') score += 10;
            
            // Keyword matching bonus
            const contentLower = (topResult.quote || '').toLowerCase();
            const keywordMatches = testCase.keywords.filter(k => 
              contentLower.includes(k.toLowerCase())
            ).length;
            score += Math.min(10, keywordMatches * 2);
            
            result.score = score;
            result.passed = score >= 70; // 70% threshold for passing
          }
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    result.responseTime = Date.now() - startTime;
    return result;
  }

  /**
   * Run all tests for a specific configuration
   */
  private async runConfigTests(config: ModelConfig): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Testing Configuration: ${config.name}`);
    console.log(`${'='.repeat(60)}`);
    
    await this.setModelConfig(config);
    
    const configResults: TestResult[] = [];
    
    for (const testCase of TEST_CASES) {
      console.log(`\n🧪 Test ${testCase.id} (${testCase.category})`);
      console.log(`  Question: ${testCase.question.slice(0, 60)}...`);
      
      const result = await this.runSingleTest(testCase, config);
      configResults.push(result);
      this.results.push(result);
      
      console.log(`  Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Score: ${result.score}/100`);
      console.log(`  Time: ${(result.responseTime / 1000).toFixed(1)}s`);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate summary for this configuration
    this.generateConfigSummary(config, configResults);
  }

  /**
   * Generate summary statistics for a configuration
   */
  private generateConfigSummary(config: ModelConfig, results: TestResult[]): void {
    const passed = results.filter(r => r.passed).length;
    const responseTimes = results.map(r => r.responseTime);
    
    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    for (const category of ['Numerical', 'Regulatory', 'Procedures', 'Complex']) {
      const categoryResults = results.filter(r => r.category === category);
      const categoryScore = categoryResults.reduce((sum, r) => sum + r.score, 0) / 
                           (categoryResults.length * 100) * 100;
      categoryScores[category] = Math.round(categoryScore);
    }
    
    // Calculate weighted total score
    const totalScore = results.reduce((sum, r) => {
      const testCase = TEST_CASES.find(tc => tc.id === r.testCaseId);
      return sum + (r.score * (testCase?.weight || 1));
    }, 0);
    
    const maxPossibleScore = TEST_CASES.reduce((sum, tc) => sum + (100 * tc.weight), 0);
    const normalizedScore = (totalScore / maxPossibleScore) * 100;
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    const summary: ConfigSummary = {
      configId: config.id,
      configName: config.name,
      totalTests: results.length,
      passed,
      accuracy: Math.round((passed / results.length) * 100),
      avgResponseTime,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      categoryScores,
      totalScore: Math.round(normalizedScore),
      monthlyCost: config.monthlyCost,
      speedImprovement: Math.round(((this.baselineSpeed - avgResponseTime) / this.baselineSpeed) * 100),
      costEfficiency: Math.round(normalizedScore / (config.monthlyCost / 100))
    };
    
    this.summaries.push(summary);
  }

  /**
   * Run all configurations
   */
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting Comprehensive RAG Tests');
    console.log(`Testing ${MODEL_CONFIGS.length} configurations with ${TEST_CASES.length} test cases each`);
    console.log(`Total tests: ${MODEL_CONFIGS.length * TEST_CASES.length}`);
    
    for (const config of MODEL_CONFIGS) {
      await this.runConfigTests(config);
      
      // Longer delay between configurations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.generateFinalReport();
  }

  /**
   * Generate comprehensive final report
   */
  private generateFinalReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    
    // Sort summaries by total score
    const sortedSummaries = [...this.summaries].sort((a, b) => b.totalScore - a.totalScore);
    
    console.log('\n📈 OVERALL RANKINGS:');
    console.log('─'.repeat(80));
    console.log('Rank | Configuration         | Score | Speed   | Cost    | Efficiency');
    console.log('─'.repeat(80));
    
    sortedSummaries.forEach((summary, index) => {
      const avgSpeed = (summary.avgResponseTime / 1000).toFixed(1);
      console.log(
        `${(index + 1).toString().padStart(4)} | ${summary.configName.padEnd(20)} | ` +
        `${summary.totalScore.toString().padStart(4)}% | ${avgSpeed.padStart(6)}s | ` +
        `$${summary.monthlyCost.toString().padStart(6)} | ${summary.costEfficiency.toString().padStart(10)}`
      );
    });
    
    console.log('\n📊 DETAILED METRICS:');
    for (const summary of sortedSummaries) {
      console.log(`\n${summary.configName}:`);
      console.log(`  Overall Score: ${summary.totalScore}%`);
      console.log(`  Test Pass Rate: ${summary.accuracy}%`);
      console.log(`  Avg Response Time: ${(summary.avgResponseTime / 1000).toFixed(1)}s`);
      console.log(`  Speed Improvement: ${summary.speedImprovement > 0 ? '+' : ''}${summary.speedImprovement}%`);
      console.log(`  Category Scores:`);
      for (const [category, score] of Object.entries(summary.categoryScores)) {
        console.log(`    ${category}: ${score}%`);
      }
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('─'.repeat(80));
    
    // Find best configurations for different use cases
    const bestOverall = sortedSummaries[0];
    const bestSpeed = [...this.summaries].sort((a, b) => a.avgResponseTime - b.avgResponseTime)[0];
    const bestValue = [...this.summaries].sort((a, b) => b.costEfficiency - a.costEfficiency)[0];
    const bestBalance = sortedSummaries.find(s => 
      s.totalScore >= 80 && s.avgResponseTime <= 15000
    ) || sortedSummaries[1];
    
    console.log(`\n🏆 Best Overall Performance:`);
    console.log(`  ${bestOverall.configName}`);
    console.log(`  Score: ${bestOverall.totalScore}%, Speed: ${(bestOverall.avgResponseTime/1000).toFixed(1)}s, Cost: $${bestOverall.monthlyCost}/mo`);
    
    console.log(`\n⚡ Fastest Configuration:`);
    console.log(`  ${bestSpeed.configName}`);
    console.log(`  Score: ${bestSpeed.totalScore}%, Speed: ${(bestSpeed.avgResponseTime/1000).toFixed(1)}s, Cost: $${bestSpeed.monthlyCost}/mo`);
    
    console.log(`\n💰 Best Value (Score per Dollar):`);
    console.log(`  ${bestValue.configName}`);
    console.log(`  Efficiency: ${bestValue.costEfficiency} points/$100`);
    console.log(`  Score: ${bestValue.totalScore}%, Cost: $${bestValue.monthlyCost}/mo`);
    
    console.log(`\n⚖️ Best Balanced (80%+ accuracy, <15s):`);
    console.log(`  ${bestBalance.configName}`);
    console.log(`  Score: ${bestBalance.totalScore}%, Speed: ${(bestBalance.avgResponseTime/1000).toFixed(1)}s, Cost: $${bestBalance.monthlyCost}/mo`);
    
    // Save detailed results to JSON
    const reportData = {
      timestamp: new Date().toISOString(),
      configurations: MODEL_CONFIGS,
      testCases: TEST_CASES,
      results: this.results,
      summaries: this.summaries,
      recommendations: {
        bestOverall: bestOverall.configId,
        bestSpeed: bestSpeed.configId,
        bestValue: bestValue.configId,
        bestBalance: bestBalance.configId
      }
    };
    
    const reportPath = path.join(process.cwd(), 'interview-documents', 'rag-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed results saved to: ${reportPath}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ COMPREHENSIVE TESTING COMPLETE');
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const tester = new ComprehensiveRagTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveRagTester, MODEL_CONFIGS, TEST_CASES };