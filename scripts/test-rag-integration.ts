#!/usr/bin/env tsx
/*
  RAG Integration Test Script
  Tests the retrieve and rerank endpoints with the FSCS £85,000 question
*/

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load environment variables
const envLocal = path.join(process.cwd(), '.env.local');
const envFile = fs.existsSync(envLocal) ? envLocal : path.join(process.cwd(), '.env');
dotenv.config({ path: envFile });

const baseUrl = 'http://localhost:3000';

// Test question about FSCS £85,000
const testQuestion = {
  question: "一時的な高額残高の保護を受けるために、預金保険スキームで保証される金額の上限はいくらですか？",
  explanation: "FSCSの標準的な預金保護限度額£85,000についての質問です",
  questionId: "test-fscs-85000"
};

async function testRetrieveEndpoint() {
  console.log('\n=== Testing /api/retrieve endpoint ===');
  console.log('Question:', testQuestion.question);
  
  try {
    const response = await fetch(`${baseUrl}/api/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: testQuestion.question,
        explanation: testQuestion.explanation,
        questionId: testQuestion.questionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n✅ Retrieve successful!');
    
    // Handle different response formats
    let passages = data.passages || data;
    if (data.success && data.data && data.data.passages) {
      passages = data.data.passages;
    }
    if (!Array.isArray(passages)) {
      console.error('Unexpected response format:', data);
      return null;
    }
    
    console.log(`Found ${passages.length} passages`);
    
    // Show top 3 results
    console.log('\nTop 3 results:');
    passages.slice(0, 3).forEach((p: any, i: number) => {
      console.log(`\n${i + 1}. Material: ${p.materialId}, Page: ${p.page}, Score: ${p.score.toFixed(3)}`);
      console.log(`   Quote: ${p.quote.substring(0, 150)}...`);
    });

    return passages;
  } catch (error) {
    console.error('❌ Retrieve failed:', error);
    return null;
  }
}

async function testRerankEndpoint(passages: any[]) {
  if (!passages || passages.length === 0) {
    console.log('\n⚠️ Skipping rerank test - no passages available');
    return;
  }

  console.log('\n=== Testing /api/rerank endpoint ===');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${baseUrl}/api/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: testQuestion.question,
        passages: passages.slice(0, 6) // Top 6 for reranking
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;
    
    console.log(`\n✅ Rerank successful! (Response time: ${responseTime.toFixed(2)}s)`);
    
    // Handle different response formats
    const data = result.data || result;
    console.log('Raw response:', JSON.stringify(data, null, 2));
    
    console.log('Best result:');
    console.log(`  Page: ${data.page}`);
    console.log(`  Quote: ${data.exactQuote}`);
    console.log(`  Rationale: ${data.reasoning || data.rationale}`);
    
    // Check if it found the correct section
    const rationale = data.reasoning || data.rationale || '';
    if (rationale.toLowerCase().includes('£85,000') || 
        rationale.toLowerCase().includes('85000') ||
        rationale.toLowerCase().includes('fscs')) {
      console.log('\n🎯 Correctly identified FSCS limit information!');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Rerank failed:', error);
    return null;
  }
}

async function checkMaterialId(passages: any[]) {
  console.log('\n=== Checking Material ID Format ===');
  
  const materialIds = new Set(passages.map(p => p.materialId));
  console.log('Unique material IDs found:', Array.from(materialIds));
  
  // Check for old format
  const hasOldFormat = Array.from(materialIds).some(id => 
    id.includes('.html') || id.includes('_backup')
  );
  
  if (hasOldFormat) {
    console.log('⚠️ Warning: Old material ID format detected');
  } else {
    console.log('✅ Material IDs are in correct format');
  }
}

async function main() {
  console.log('Starting RAG Integration Test...');
  console.log('Make sure the dev server is running (npm run dev)');
  
  // Test retrieve endpoint
  const passages = await testRetrieveEndpoint();
  
  if (passages) {
    // Check material ID format
    checkMaterialId(passages);
    
    // Test rerank endpoint
    await testRerankEndpoint(passages);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the test
main().catch(console.error);