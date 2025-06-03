const fs = require('fs');
const path = require('path');

// JSONファイルを読み込む
const questionsPath = path.join(__dirname, '../public/data/all-questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// questionId 4167737の解説を修正
questions.forEach(question => {
  if (question.questionId === "4167737") {
    if (question.explanation === "") {
      question.explanationJa = "刑事上の市場操作は、FSA 2012のセクション89-91で定義され、最大7年の懲役刑を含む刑事罰の対象となります。一方、UK MARに基づく民事上の市場濫用は、罰金や制裁を受ける可能性がありますが、懲役刑にはなりません。これが両者の主要な違いです。";
    }
  }
});

// 更新されたJSONを保存
fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf8');

// 統計情報を表示
const untranslatedCount = questions.filter(q => 
  (q.questionJa && q.questionJa.includes('【翻訳準備中】')) ||
  (q.explanationJa && q.explanationJa.includes('【翻訳準備中】')) ||
  (q.options && q.options.some(o => o.textJa && o.textJa.includes('【翻訳準備中】')))
).length;

console.log(`✅ 最後の翻訳を修正しました！`);
console.log(`📊 全問題数: ${questions.length}問`);
console.log(`✅ 翻訳完了: ${questions.length - untranslatedCount}問`);
console.log(`❌ 未翻訳: ${untranslatedCount}問`);