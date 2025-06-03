const fs = require('fs');
const path = require('path');

// 翻訳サンプル（実際の実装では翻訳APIを使用）
const sampleTranslations = {
  // Questions
  "Which of the following statements about the Financial Conduct Authority is FALSE?": "金融行為規制機構（FCA）に関する以下の記述のうち、誤っているものはどれですか？",
  "Under the Financial Services Act 2012, which of the following is NOT a statutory objective of the Financial Conduct Authority?": "2012年金融サービス法の下で、以下のうち金融行為規制機構（FCA）の法定目的でないものはどれですか？",
  "Under the Financial Services Act 2012, who is the prudential regulator for the UK insurance industry?": "2012年金融サービス法の下で、英国保険業界の健全性規制機関はどこですか？",
  "Who regulates UK banks?": "英国の銀行を規制するのはどこですか？",
  
  // Options
  ". The Treasury appoints the board of the FCA": "財務省がFCAの理事会を任命する",
  ". The FCA is a company": "FCAは会社である",
  ". The board of the FCA can delegate its statutory objectives to another body": "FCAの理事会は法定目的を他の機関に委任できる",
  ". The FCA is the conduct regulator for the financial services industry": "FCAは金融サービス業界の行為規制機関である",
  ". Protecting the integrity of the UK financial system": "英国金融システムの健全性を保護する",
  ". Promoting effective competition in the interests of consumers": "消費者の利益のために効果的な競争を促進する",
  ". Securing an appropriate degree of protection for consumers": "消費者に適切な程度の保護を確保する",
  ". Reducing financial crime": "金融犯罪を削減する",
  ". His Majesty's Treasury": "英国財務省",
  ". The Prudential Regulation Authority": "健全性規制機構（PRA）",
  ". Parliament": "議会",
  ". The Department for Business, Innovation and Skills": "ビジネス・イノベーション・技能省",
  ". The London Stock Exchange": "ロンドン証券取引所",
  ". The European Central Bank": "欧州中央銀行",
  
  // Explanations
  "Although answerable to the Treasury, the FCA is a company - it is limited by guarantee, directly by the UK government. Its board cannot delegate its statutory objectives to another body.": "FCAは財務省に対して責任を負いますが、会社組織です - 英国政府による保証有限責任会社です。その理事会は法定目的を他の機関に委任することはできません。",
  "The need to reduce financial crime was a statutory objective of the FSA. The FCA is accountable for reducing financial crime - but this is now subsumed into the integrity objective.": "金融犯罪の削減はFSAの法定目的でした。FCAは金融犯罪の削減に責任を負いますが、これは現在、健全性目的に含まれています。",
  "The PRA, or Prudential Regulation Authority, is the prudential regulator for the UK Insurance industry.": "PRA（健全性規制機構）は、英国保険業界の健全性規制機関です。",
  "The PRA is the regulator - it is part of The Bank of England.": "PRAが規制機関です - これはイングランド銀行の一部です。"
};

// メイン処理
async function addTranslations() {
  try {
    // 全問題データを読み込み
    const questionsFile = path.join(__dirname, '../public/data/all-questions.json');
    const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
    
    // 翻訳を追加（サンプルデータのみ）
    const translatedQuestions = questions.map((question, index) => {
      // 最初の10問のみサンプル翻訳を追加
      if (index < 10) {
        return {
          ...question,
          questionJa: sampleTranslations[question.question] || `【翻訳準備中】${question.question}`,
          options: question.options.map(option => ({
            ...option,
            textJa: sampleTranslations[option.text] || `【翻訳準備中】${option.text}`
          })),
          explanationJa: sampleTranslations[question.explanation] || `【翻訳準備中】${question.explanation}`
        };
      }
      
      // 残りの問題は翻訳準備中として処理
      return {
        ...question,
        questionJa: `【翻訳準備中】${question.question}`,
        options: question.options.map(option => ({
          ...option,
          textJa: `【翻訳準備中】${option.text}`
        })),
        explanationJa: `【翻訳準備中】${question.explanation}`
      };
    });
    
    // 翻訳済みデータを保存
    fs.writeFileSync(questionsFile, JSON.stringify(translatedQuestions, null, 2));
    
    // カテゴリ別ファイルも更新
    const categories = [
      "The Regulatory Environment",
      "The Financial Services and Markets Act 2000 and Financial Services Act 2012",
      "Associated Legislation and Regulation",
      "The FCA Conduct of Business Sourcebook/Client Assets",
      "Complaints and Redress",
      "Regulations: Mock 1",
      "Regulations: Mock 2",
      "Regulations: Mock 3",
      "Regulations: Mock 4",
      "Regulations: Mock 5",
      "Regulations: Final Study Questions"
    ];
    
    categories.forEach(categoryName => {
      const categoryQuestions = translatedQuestions.filter(q => q.category === categoryName);
      const fileName = categoryName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const categoryFile = path.join(__dirname, `../public/data/category-${fileName}.json`);
      fs.writeFileSync(categoryFile, JSON.stringify(categoryQuestions, null, 2));
    });
    
    console.log('翻訳サンプルを追加しました！');
    console.log('注意: これはサンプル翻訳です。実際の運用では翻訳APIを使用してください。');
    
  } catch (error) {
    console.error('翻訳の追加中にエラーが発生しました:', error);
  }
}

addTranslations();