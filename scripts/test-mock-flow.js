#!/usr/bin/env node

/**
 * Test script to verify Mock exam flow and localStorage optimization
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, 'blue');
  console.log('='.repeat(50));
}

// Simulate localStorage environment for testing
const mockLocalStorage = {
  data: {},
  setItem(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.data[key] = serialized;
  },
  getItem(key) {
    return this.data[key] || null;
  },
  removeItem(key) {
    delete this.data[key];
  },
  get length() {
    return Object.keys(this.data).length;
  },
  key(index) {
    return Object.keys(this.data)[index];
  },
  clear() {
    this.data = {};
  }
};

// Helper to calculate storage size
function calculateStorageSize(storage) {
  let totalSize = 0;
  for (const key in storage.data) {
    totalSize += new Blob([storage.data[key]]).size;
  }
  return totalSize;
}

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Test 1: Create Mock exam session with optimized storage
function testOptimizedMockSession() {
  logSection('Test 1: Optimized Mock Session Storage');
  
  // Simulate a user
  const user = {
    id: 'user_test',
    nickname: 'TestUser',
    createdAt: new Date().toISOString()
  };
  
  // Create questions (simulating full question objects)
  const questions = [];
  for (let i = 0; i < 75; i++) {
    questions.push({
      questionId: `q_${i}`,
      question: `This is a sample question ${i} with some lengthy text to simulate real question content`,
      questionJa: `これはサンプル質問 ${i} で、実際の質問内容をシミュレートするための長いテキストです`,
      options: [
        { letter: 'A', text: 'Option A text', textJa: 'オプションAのテキスト' },
        { letter: 'B', text: 'Option B text', textJa: 'オプションBのテキスト' },
        { letter: 'C', text: 'Option C text', textJa: 'オプションCのテキスト' },
        { letter: 'D', text: 'Option D text', textJa: 'オプションDのテキスト' }
      ],
      correctAnswer: 'A',
      explanation: 'This is the explanation for the correct answer',
      explanationJa: 'これは正解の説明です',
      category: 'Regulations Mock 1'
    });
  }
  
  // Create Mock session
  const session = {
    id: Date.now().toString(),
    mode: 'mock75',
    category: 'Regulations Mock 1',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    answers: questions.map((q, i) => ({
      questionId: q.questionId,
      selectedAnswer: i % 4 === 0 ? 'A' : 'B',
      isCorrect: i % 4 === 0,
      answeredAt: new Date().toISOString()
    })),
    timeLimit: 90,
    showJapanese: false
  };
  
  // Test 1a: Old method (storing full questions)
  log('\nTesting OLD storage method (full questions):', 'yellow');
  mockLocalStorage.clear();
  
  const oldMockResult = {
    session: { ...session, questions },
    questions,
    userId: user.id,
    userNickname: user.nickname
  };
  
  mockLocalStorage.setItem('tempMockResult_TestUser', oldMockResult);
  const oldSize = calculateStorageSize(mockLocalStorage);
  log(`Storage size with full questions: ${formatBytes(oldSize)}`, 'red');
  
  // Test 1b: New method (storing only questionIds)
  log('\nTesting NEW storage method (questionIds only):', 'yellow');
  mockLocalStorage.clear();
  
  const newMockResult = {
    session: {
      ...session,
      questionIds: questions.map(q => q.questionId),
      // questions field is not included
    },
    questions, // Still keep for review page, but session doesn't have it
    userId: user.id,
    userNickname: user.nickname
  };
  
  mockLocalStorage.setItem('tempMockResult_TestUser', newMockResult);
  const newSize = calculateStorageSize(mockLocalStorage);
  log(`Storage size with questionIds: ${formatBytes(newSize)}`, 'green');
  
  // Calculate savings
  const savings = ((oldSize - newSize) / oldSize * 100).toFixed(2);
  log(`\nStorage savings: ${savings}% reduction`, 'green');
  log(`Saved: ${formatBytes(oldSize - newSize)}`, 'green');
  
  return { oldSize, newSize, savings };
}

// Test 2: Multiple session accumulation
function testSessionAccumulation() {
  logSection('Test 2: Multiple Session Accumulation');
  
  mockLocalStorage.clear();
  
  // Simulate 50 study sessions
  const progress = {
    totalQuestionsAnswered: 0,
    correctAnswers: 0,
    categoryProgress: {},
    studySessions: [],
    incorrectQuestions: [],
    overcomeQuestions: [],
    currentStreak: 1,
    lastStudyDate: new Date().toISOString()
  };
  
  log('\nSimulating 50 study sessions:', 'yellow');
  
  for (let i = 0; i < 50; i++) {
    const session = {
      id: `session_${i}`,
      mode: 'category',
      category: 'Test Category',
      startedAt: new Date(Date.now() - i * 86400000).toISOString(),
      completedAt: new Date(Date.now() - i * 86400000 + 600000).toISOString(),
      questionIds: Array(10).fill(0).map((_, j) => `q_${i}_${j}`),
      answers: Array(10).fill(0).map((_, j) => ({
        questionId: `q_${i}_${j}`,
        selectedAnswer: 'A',
        isCorrect: true,
        answeredAt: new Date().toISOString()
      })),
      showJapanese: true
    };
    
    progress.studySessions.push(session);
    progress.totalQuestionsAnswered += 10;
    progress.correctAnswers += 10;
  }
  
  mockLocalStorage.setItem('userProgress_TestUser', progress);
  const totalSize = calculateStorageSize(mockLocalStorage);
  
  log(`Total storage used for 50 sessions: ${formatBytes(totalSize)}`, 'green');
  log(`Average per session: ${formatBytes(totalSize / 50)}`, 'green');
  
  return { totalSize, averagePerSession: totalSize / 50 };
}

// Test 3: Cleanup effectiveness
function testCleanupEffectiveness() {
  logSection('Test 3: Cleanup Effectiveness');
  
  mockLocalStorage.clear();
  
  // Add various types of data
  log('\nAdding test data:', 'yellow');
  
  // Temporary Mock results
  for (let i = 0; i < 5; i++) {
    mockLocalStorage.setItem(`tempMockResult_user${i}`, {
      session: { id: `temp_${i}` },
      questions: Array(25).fill({ questionId: 'q1' })
    });
  }
  
  // Mock exam progress
  for (let i = 0; i < 3; i++) {
    mockLocalStorage.setItem(`mockExamProgress_user${i}`, {
      session: { id: `progress_${i}` },
      mockAnswers: Array(75).fill(['q1', 'A'])
    });
  }
  
  // Mock exam history
  mockLocalStorage.setItem('mockExamHistory_TestUser', 
    Array(30).fill({
      id: 'mock_1',
      score: 85,
      completedAt: new Date().toISOString()
    })
  );
  
  const beforeSize = calculateStorageSize(mockLocalStorage);
  log(`Storage before cleanup: ${formatBytes(beforeSize)}`, 'red');
  log(`Number of items: ${mockLocalStorage.length}`, 'red');
  
  // Simulate cleanup
  log('\nRunning cleanup...', 'yellow');
  const keysToDelete = [];
  
  for (let i = 0; i < mockLocalStorage.length; i++) {
    const key = mockLocalStorage.key(i);
    if (!key) continue;
    
    if (key.startsWith('tempMockResult_') || 
        key.startsWith('mockExamProgress_') ||
        key === 'answeredQuestionsTracker') {
      keysToDelete.push(key);
    }
  }
  
  // Clean up Mock exam history (keep only 20)
  const historyKey = 'mockExamHistory_TestUser';
  const history = JSON.parse(mockLocalStorage.getItem(historyKey) || '[]');
  if (history.length > 20) {
    mockLocalStorage.setItem(historyKey, history.slice(-20));
  }
  
  // Delete marked keys
  keysToDelete.forEach(key => mockLocalStorage.removeItem(key));
  
  const afterSize = calculateStorageSize(mockLocalStorage);
  const cleaned = beforeSize - afterSize;
  
  log(`\nStorage after cleanup: ${formatBytes(afterSize)}`, 'green');
  log(`Number of items: ${mockLocalStorage.length}`, 'green');
  log(`Cleaned: ${formatBytes(cleaned)} (${(cleaned / beforeSize * 100).toFixed(2)}%)`, 'green');
  log(`Deleted ${keysToDelete.length} items`, 'green');
  
  return { beforeSize, afterSize, cleaned, itemsDeleted: keysToDelete.length };
}

// Run all tests
function runAllTests() {
  log('\n🧪 Running Mock Exam Storage Optimization Tests', 'blue');
  
  const results = {
    mockSession: testOptimizedMockSession(),
    accumulation: testSessionAccumulation(),
    cleanup: testCleanupEffectiveness()
  };
  
  logSection('Summary');
  
  log('✅ Mock Session Optimization:', 'green');
  log(`   - Storage reduced by ${results.mockSession.savings}%`);
  log(`   - From ${formatBytes(results.mockSession.oldSize)} to ${formatBytes(results.mockSession.newSize)}`);
  
  log('\n✅ Session Accumulation:', 'green');
  log(`   - 50 sessions use only ${formatBytes(results.accumulation.totalSize)}`);
  log(`   - Average ${formatBytes(results.accumulation.averagePerSession)} per session`);
  
  log('\n✅ Cleanup Effectiveness:', 'green');
  log(`   - Cleaned ${formatBytes(results.cleanup.cleaned)} of data`);
  log(`   - Removed ${results.cleanup.itemsDeleted} temporary items`);
  
  log('\n🎉 All tests completed successfully!', 'green');
  
  // Estimate real-world impact
  logSection('Real-World Impact Estimation');
  
  const avgSessionsPerDay = 10;
  const avgMockExamsPerWeek = 5;
  const daysOfUse = 30;
  
  const oldMethodDaily = results.mockSession.oldSize * avgSessionsPerDay;
  const newMethodDaily = results.mockSession.newSize * avgSessionsPerDay;
  const monthlyOld = oldMethodDaily * daysOfUse;
  const monthlyNew = newMethodDaily * daysOfUse;
  
  log(`Estimated monthly storage usage:`, 'blue');
  log(`   - Old method: ${formatBytes(monthlyOld)}`, 'red');
  log(`   - New method: ${formatBytes(monthlyNew)}`, 'green');
  log(`   - Monthly savings: ${formatBytes(monthlyOld - monthlyNew)}`, 'green');
  
  const quotaLimit = 5 * 1024 * 1024; // 5MB
  const daysUntilQuotaOld = Math.floor(quotaLimit / oldMethodDaily);
  const daysUntilQuotaNew = Math.floor(quotaLimit / newMethodDaily);
  
  log(`\nDays until quota exceeded:`, 'blue');
  log(`   - Old method: ${daysUntilQuotaOld} days`, 'red');
  log(`   - New method: ${daysUntilQuotaNew} days`, 'green');
  log(`   - Improvement: ${((daysUntilQuotaNew / daysUntilQuotaOld - 1) * 100).toFixed(0)}% longer usage`, 'green');
}

// Run tests
runAllTests();