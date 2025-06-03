const fs = require('fs');
const path = require('path');

// すべてのカテゴリファイルから翻訳をall-questions.jsonにマージするスクリプト

function mergeTranslations() {
  try {
    // all-questions.jsonを読み込む
    const allQuestionsPath = path.join(__dirname, '../public/data/all-questions.json');
    const allQuestions = JSON.parse(fs.readFileSync(allQuestionsPath, 'utf8'));
    
    // dataディレクトリのすべてのcategory-*.jsonファイルを取得
    const dataDir = path.join(__dirname, '../public/data');
    const categoryFiles = fs.readdirSync(dataDir)
      .filter(file => file.startsWith('category-') && file.endsWith('.json'));
    
    console.log(`📁 ${categoryFiles.length}個のカテゴリファイルを処理します...`);
    
    let totalUpdatedCount = 0;
    const categoryStats = {};
    
    // 各カテゴリファイルを処理
    categoryFiles.forEach(categoryFile => {
      const categoryPath = path.join(dataDir, categoryFile);
      const categoryQuestions = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));
      let categoryUpdatedCount = 0;
      
      // カテゴリファイルの各質問を処理
      categoryQuestions.forEach(categoryQuestion => {
      // all-questions.json内の対応する質問を見つける
      const index = allQuestions.findIndex(q => q.questionId === categoryQuestion.questionId);
      
      if (index !== -1) {
        const allQuestion = allQuestions[index];
        let hasUpdate = false;
        
        // 翻訳フィールドをチェックして更新
        if (categoryQuestion.questionJa && 
            (!allQuestion.questionJa || allQuestion.questionJa.includes('【翻訳準備中】'))) {
          allQuestion.questionJa = categoryQuestion.questionJa;
          hasUpdate = true;
        }
        
        if (categoryQuestion.explanationJa && 
            (!allQuestion.explanationJa || allQuestion.explanationJa.includes('【翻訳準備中】'))) {
          allQuestion.explanationJa = categoryQuestion.explanationJa;
          hasUpdate = true;
        }
        
        // オプションの翻訳をチェック
        if (categoryQuestion.options && allQuestion.options) {
          categoryQuestion.options.forEach((catOption, optIndex) => {
            if (catOption.textJa && allQuestion.options[optIndex]) {
              if (!allQuestion.options[optIndex].textJa || 
                  allQuestion.options[optIndex].textJa.includes('【翻訳準備中】')) {
                allQuestion.options[optIndex].textJa = catOption.textJa;
                hasUpdate = true;
              }
            }
          });
        }
        
        if (hasUpdate) {
          categoryUpdatedCount++;
        }
      }
    });
    
    categoryStats[categoryFile] = categoryUpdatedCount;
    totalUpdatedCount += categoryUpdatedCount;
  });
    
    // 更新されたデータを保存
    fs.writeFileSync(allQuestionsPath, JSON.stringify(allQuestions, null, 2), 'utf8');
    
    console.log(`\n✅ 翻訳のマージが完了しました！`);
    console.log(`📊 合計更新数: ${totalUpdatedCount}問`);
    
    // カテゴリ別の統計を表示
    console.log(`\n📈 カテゴリ別更新数:`);
    Object.entries(categoryStats).forEach(([file, count]) => {
      if (count > 0) {
        console.log(`   ${file}: ${count}問`);
      }
    });
    
    // 統計情報を表示
    const untranslatedCount = allQuestions.filter(q => 
      (q.questionJa && q.questionJa.includes('【翻訳準備中】')) ||
      (q.explanationJa && q.explanationJa.includes('【翻訳準備中】'))
    ).length;
    
    console.log(`📝 全質問数: ${allQuestions.length}問`);
    console.log(`❌ 未翻訳の質問数: ${untranslatedCount}問`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// スクリプトを実行
mergeTranslations();