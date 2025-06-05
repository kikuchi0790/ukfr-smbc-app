#!/usr/bin/env node

// このスクリプトはブラウザのコンソールで実行してください
// localStorageの内容を調査するためのスクリプト

console.log("=== localStorage Debug Info ===");
console.log("Total keys:", localStorage.length);
console.log("\n=== All Keys ===");

const keys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  keys.push(key);
}

keys.sort().forEach(key => {
  console.log(`- ${key}`);
});

console.log("\n=== userProgress Keys ===");
const userProgressKeys = keys.filter(key => key.startsWith('userProgress'));
userProgressKeys.forEach(key => {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    console.log(`\nKey: ${key}`);
    console.log("Total Questions Answered:", data.totalQuestionsAnswered);
    console.log("Category Progress:");
    if (data.categoryProgress) {
      Object.entries(data.categoryProgress).forEach(([category, progress]) => {
        console.log(`  - ${category}: ${progress.answeredQuestions}/${progress.totalQuestions} (${Math.round(progress.answeredQuestions/progress.totalQuestions*100)}%)`);
      });
    }
  } catch (e) {
    console.log(`  Error parsing data for ${key}:`, e.message);
  }
});

console.log("\n=== authUser Info ===");
try {
  const authUser = JSON.parse(localStorage.getItem('authUser'));
  console.log("Current user nickname:", authUser?.nickname);
} catch (e) {
  console.log("No authUser found or error parsing:", e.message);
}

console.log("\n=== Looking for old data patterns ===");
// アカウント機能実装前のデータパターンを探す
const oldDataPatterns = [
  'userProgress', // ニックネームなしのキー
  'tempMockResult',
  'tempMockQuestions',
  'mockExamProgress',
  'latestMockExam'
];

oldDataPatterns.forEach(pattern => {
  const matchingKeys = keys.filter(key => key === pattern || (key.startsWith(pattern) && !key.includes('_')));
  if (matchingKeys.length > 0) {
    console.log(`\nFound old data pattern "${pattern}":`);
    matchingKeys.forEach(key => {
      console.log(`  - ${key}`);
      if (key === 'userProgress') {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          console.log("    Total Questions:", data.totalQuestionsAnswered);
          if (data.categoryProgress) {
            console.log("    Categories with progress:");
            Object.entries(data.categoryProgress).forEach(([cat, prog]) => {
              if (prog.answeredQuestions > 0) {
                console.log(`      - ${cat}: ${prog.answeredQuestions}/${prog.totalQuestions}`);
              }
            });
          }
        } catch (e) {
          console.log("    Error reading data:", e.message);
        }
      }
    });
  }
});

console.log("\n=== Storage Size ===");
let totalSize = 0;
keys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    totalSize += key.length + value.length;
  }
});
console.log(`Total storage used: ${(totalSize / 1024).toFixed(2)} KB`);