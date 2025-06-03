const fs = require('fs');
const path = require('path');

// JSONファイルを読み込む
const questionsPath = path.join(__dirname, '../public/data/all-questions.json');
let questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// 1. 重複の削除（questionIdでユニークにする）
const uniqueQuestions = [];
const seenIds = new Set();

questions.forEach(q => {
  if (!seenIds.has(q.questionId)) {
    seenIds.add(q.questionId);
    uniqueQuestions.push(q);
  } else {
    // 重複がある場合、翻訳がある方を優先
    const existingIndex = uniqueQuestions.findIndex(uq => uq.questionId === q.questionId);
    const existing = uniqueQuestions[existingIndex];
    
    // より完全な翻訳がある方を採用
    let useNew = false;
    
    // questionJaの比較
    if (q.questionJa && !q.questionJa.includes('【翻訳準備中】') && 
        (!existing.questionJa || existing.questionJa.includes('【翻訳準備中】'))) {
      useNew = true;
    }
    
    // optionsの翻訳を比較
    if (q.options && existing.options) {
      const newTranslatedOptions = q.options.filter(o => o.textJa && !o.textJa.includes('【翻訳準備中】')).length;
      const existingTranslatedOptions = existing.options.filter(o => o.textJa && !o.textJa.includes('【翻訳準備中】')).length;
      if (newTranslatedOptions > existingTranslatedOptions) {
        useNew = true;
      }
    }
    
    if (useNew) {
      uniqueQuestions[existingIndex] = q;
    }
  }
});

// 2. 残っている【翻訳準備中】を削除（オプションのみ）
uniqueQuestions.forEach(question => {
  if (question.options) {
    question.options.forEach(option => {
      if (option.textJa && option.textJa.includes('【翻訳準備中】')) {
        // テキストから【翻訳準備中】を除去して、英語テキストのみにする
        option.textJa = option.text.replace(/^[A-D]\.\s*/, '');
      }
    });
  }
});

// 更新されたJSONを保存
fs.writeFileSync(questionsPath, JSON.stringify(uniqueQuestions, null, 2), 'utf8');

// 統計情報を表示
const untranslatedCount = uniqueQuestions.filter(q => 
  (q.questionJa && q.questionJa.includes('【翻訳準備中】')) ||
  (q.explanationJa && q.explanationJa.includes('【翻訳準備中】')) ||
  (q.options && q.options.some(o => o.textJa && o.textJa.includes('【翻訳準備中】')))
).length;

console.log(`✅ 処理が完了しました！`);
console.log(`📊 重複削除後の問題数: ${uniqueQuestions.length}問（元: ${questions.length}問）`);
console.log(`🔄 削除された重複: ${questions.length - uniqueQuestions.length}問`);
console.log(`❌ 未翻訳の問題数: ${untranslatedCount}問`);