const fs = require('fs');
const path = require('path');

// 翻訳データ（最初の10問）
const translations = [
  {
    questionId: "1078714",
    questionJa: "FCAが発行する一般ガイダンスに関して、以下のうち正しくないものはどれですか？ガイダンスノートは：",
    explanationJa: "ガイダンスノートは企業に対して拘束力がなく、関連する規則への準拠を達成するために必ずしも従う必要はありません。",
    options: [
      { letter: "A", textJa: "規則を取り巻く問題を強調し、詳しく説明する" },
      { letter: "B", textJa: "企業に対して拘束力がある" },
      { letter: "C", textJa: "企業が規則について明確化を求めることを可能にし、違反の可能性を減らす" },
      { letter: "D", textJa: "FCAハンドブックに含まれており、文字Gで示される" }
    ]
  },
  {
    questionId: "1000207",
    questionJa: "以下のうち、FCAの資金調達に責任を持つのはどれですか？",
    explanationJa: "FCAは保証有限責任会社です。保証人は財務省です。しかし、継続的な運営資金は、加盟企業に年次賦課金を課すことで調達されています。",
    options: [
      { letter: "A", textJa: "認可企業" },
      { letter: "B", textJa: "英国財務省" },
      { letter: "C", textJa: "イングランド銀行" },
      { letter: "D", textJa: "英国歳入関税庁" }
    ]
  },
  {
    questionId: "1078715",
    questionJa: "FCAに関する以下の記述のうち、正しくないものはどれですか？",
    explanationJa: "FCA理事会は「国王」ではなく財務省によって任命されます（「国王」は一般的に君主自身を指します）。FCAには1つの戦略的目的と3つの運営目的があります。FCAは単独規制企業であれ二重規制企業であれ、すべての企業の行為規制機関です。",
    options: [
      { letter: "A", textJa: "FCAの保証人は財務省である" },
      { letter: "B", textJa: "FCA理事会は国王によって任命された執行役員と非執行役員で構成される" },
      { letter: "C", textJa: "2012年金融サービス法に定められた法定目的がある" },
      { letter: "D", textJa: "すべての認可企業の行為規制に責任を持つ" }
    ]
  },
  {
    questionId: "1000209",
    questionJa: "FCAは規則を執行し、それに従わない者を制裁・懲戒する権限を与えられています。以下のうち、FCAが懲戒処分を求めないものはどれですか？",
    explanationJa: "企業はFCAガイドライン（例えば、電話勧誘の時間帯など）に従わないことを選択できますが、規則や原則の遵守に失敗することは違反行為です。",
    options: [
      { letter: "A", textJa: "金融プロモーションの承認を得ることに失敗した場合" },
      { letter: "B", textJa: "FCAガイドラインに従わない場合" },
      { letter: "C", textJa: "FCA規則に従わない場合" },
      { letter: "D", textJa: "FCA原則に従わない場合" }
    ]
  },
  {
    questionId: "1000251",
    questionJa: "金融行為規制機構は、以下のうちどれからの拠出金によって資金調達されていますか？",
    explanationJa: "FCAは財務省に対して責任を負いますが、実際は有限責任会社です。また、金融サービス業界、つまりFSMA 2000の下で認可された事業者によって資金調達されています。",
    options: [
      { letter: "A", textJa: "税金を通じて間接的に財務省から" },
      { letter: "B", textJa: "取引に課される賦課金を通じてLSEから" },
      { letter: "C", textJa: "2000年金融サービス市場法の下で認可された規制対象企業から" },
      { letter: "D", textJa: "市場での自身の活動を通じてFCAから" }
    ]
  },
  {
    questionId: "1000213",
    questionJa: "次のうち、FCAの戦略的目的はどれですか？",
    explanationJa: "FCAの戦略的目的は、金融市場が適切に機能することを確保することです。",
    options: [
      { letter: "A", textJa: "関連市場が適切に機能することを確保すること" },
      { letter: "B", textJa: "英国金融システムの健全性を保護すること" },
      { letter: "C", textJa: "消費者に適切な程度の保護を確保すること" },
      { letter: "D", textJa: "消費者の利益のために競争を促進すること" }
    ]
  },
  {
    questionId: "1000210",
    questionJa: "FCAのビジネスプランについて正しいのは以下のうちどれですか？",
    explanationJa: "FCAのビジネスプランは年次ベースで発行され、今後1年間に予想される費用とそれに応じた賦課金を設定します。",
    options: [
      { letter: "A", textJa: "年次ベースで発行される" },
      { letter: "B", textJa: "3年間にわたる" },
      { letter: "C", textJa: "政府によって設定される" },
      { letter: "D", textJa: "一定で不変である" }
    ]
  },
  {
    questionId: "1004316",
    questionJa: "以下のうち、FCAがその規則または基準を執行し、それらに従わない者を制裁または懲戒する際に使用できる権限ではないものはどれですか？",
    explanationJa: "個人の自宅の取得はFCAの執行権限ではありません。",
    options: [
      { letter: "A", textJa: "無制限の罰金" },
      { letter: "B", textJa: "認可の制限、停止、または取り消し" },
      { letter: "C", textJa: "個人の自宅の取得" },
      { letter: "D", textJa: "その他の執行権限、例えばインジャンクション（差止命令）など" }
    ]
  },
  {
    questionId: "1078716",
    questionJa: "金融サービス市場法2000（FSMA）におけるFCAに関する以下の記述のうち、正しくないものはどれですか？",
    explanationJa: "FCAにはスタッフを任命する権限がありますが、ある程度の上級スタッフは財務省によって任命されます。",
    options: [
      { letter: "A", textJa: "法定権限を持つ有限責任会社である" },
      { letter: "B", textJa: "財務省によって理事会が任命される" },
      { letter: "C", textJa: "すべてのスタッフを任命する権限がある" },
      { letter: "D", textJa: "すべての認可企業の行為規制に責任を持つ" }
    ]
  },
  {
    questionId: "1078717",
    questionJa: "次のうち、FCAの責任ではないものはどれですか？",
    explanationJa: "FCAは、個々の消費者の決定から彼らを保護する責任はありません。責任ある選択をするために必要な情報を消費者に提供しますが、個々の決定の結果には責任を負いません。",
    options: [
      { letter: "A", textJa: "消費者を彼ら自身の決定から保護すること" },
      { letter: "B", textJa: "金融サービス業界を規制すること" },
      { letter: "C", textJa: "消費者に適切な程度の保護を確保すること" },
      { letter: "D", textJa: "金融市場が適切に機能することを確保すること" }
    ]
  }
];

// JSONファイルを読み込む
const questionsPath = path.join(__dirname, '../public/data/all-questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// 翻訳を適用
questions.forEach(question => {
  const translation = translations.find(t => t.questionId === question.questionId);
  if (translation) {
    // 既存の【翻訳準備中】を含む翻訳を置き換える
    question.questionJa = translation.questionJa;
    question.explanationJa = translation.explanationJa;
    
    // オプションの翻訳を適用
    if (question.options && translation.options) {
      question.options.forEach(option => {
        const translatedOption = translation.options.find(o => o.letter === option.letter);
        if (translatedOption) {
          option.textJa = translatedOption.textJa;
        }
      });
    }
  }
});

// 更新されたJSONを保存
fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf8');

// 統計情報を表示
const untranslatedCount = questions.filter(q => 
  (q.questionJa && q.questionJa.includes('【翻訳準備中】')) ||
  (q.explanationJa && q.explanationJa.includes('【翻訳準備中】'))
).length;

console.log(`翻訳を適用しました！`);
console.log(`翻訳済み: ${translations.length}問`);
console.log(`残りの未翻訳: ${untranslatedCount}問`);
console.log(`合計: ${questions.length}問`);