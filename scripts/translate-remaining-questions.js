const fs = require('fs');
const path = require('path');

// 残りの26問の翻訳データ
const translations = [
  {
    questionId: "1014764",
    questionJa: "認可企業を代表して非書面による金融プロモーションを伝達する際、その人物は以下のうちどれを必ず行わなければなりませんか？",
    explanationJa: "認可企業を代表する場合、その事実を開示し、プロモーションがその企業によって承認されたことを述べなければなりません。",
    options: [
      { letter: "A", textJa: "企業が規制対象であることを開示する" },
      { letter: "B", textJa: "プロモーションが承認されたことを開示する" },
      { letter: "C", textJa: "自分の名前と地位を述べる" },
      { letter: "D", textJa: "企業を代表していることを開示し、プロモーションが企業によって承認されたことを述べる" }
    ]
  },
  {
    questionId: "1069720",
    questionJa: "行為リスク規制の目的を最もよく説明しているのは次のうちどれですか？",
    explanationJa: "行為リスク規制は、顧客が金融サービス提供者から公正な結果を得ることを確保することを目的としています。",
    options: [
      { letter: "A", textJa: "消費者が金融サービス提供者から公正な結果を得ることを確保する" },
      { letter: "B", textJa: "シニアマネジメントの行為リスクを削減する" },
      { letter: "C", textJa: "FCAの個人に対する規制措置の権限を強化する" },
      { letter: "D", textJa: "企業全体のコストを削減する" }
    ]
  },
  {
    questionId: "1067586",
    questionJa: "European Markets Infrastructure Regulationの下で、デリバティブ取引を行う者に対する要件でないものは次のうちどれですか？",
    explanationJa: "EMIR、2012年の規制では、店頭（OTC）デリバティブの集中清算とすべてのデリバティブ契約の取引情報蓄積機関への報告が要求されていますが、承認されたBenchmarksのみを使用する要件はありません。",
    options: [
      { letter: "A", textJa: "店頭（OTC）デリバティブの集中清算" },
      { letter: "B", textJa: "すべてのデリバティブ契約の報告" },
      { letter: "C", textJa: "デリバティブ評価において承認されたBenchmarksのみを使用すること" },
      { letter: "D", textJa: "リスク軽減技術" }
    ]
  },
  {
    questionId: "1069715",
    questionJa: "FCAのシニアマネジメント制度（SMR）の目的は何ですか？",
    explanationJa: "FCAのシニアマネジメント制度の目的は、企業の主要な活動と企業におけるシニアマネジメントの個人的責任を確立することです。",
    options: [
      { letter: "A", textJa: "企業の主要な活動におけるシニアマネジメントの個人的責任を確立する" },
      { letter: "B", textJa: "企業の取締役会における男女比を改善する" },
      { letter: "C", textJa: "上級スタッフに同じ規制研修を受けさせる" },
      { letter: "D", textJa: "規制違反の罰金を公平に分配する" }
    ]
  },
  {
    questionId: "1069721",
    questionJa: "イギリスにおけるESG（環境・社会・ガバナンス）開示要件の遵守について最も適切な記述は次のうちどれですか？",
    explanationJa: "大企業は、2022年4月以降の会計年度について、Taskforce on Climate-related Financial Disclosures (TCFD)の推奨事項に従って気候関連財務情報を開示することが要求されています。",
    options: [
      { letter: "A", textJa: "すべての金融サービス企業に対して任意である" },
      { letter: "B", textJa: "小規模企業のみに義務付けられている" },
      { letter: "C", textJa: "大企業は気候関連財務情報を開示する必要がある" },
      { letter: "D", textJa: "プレミアム上場企業のみに適用される" }
    ]
  },
  {
    questionId: "1014766",
    questionJa: "クライアント資産の分別管理に関する以下の記述のうち、正しくないものはどれですか？",
    explanationJa: "クライアント資産は、企業の財務的破綻から保護するために企業の自己資産から分別して保管しなければなりませんが、権限のあるスタッフが資産への迅速なアクセスを必要とする場合があるため、通常のビジネスアワー中は金庫から出しておくことができます。",
    options: [
      { letter: "A", textJa: "企業の破綻時にクライアントを保護することを目的としている" },
      { letter: "B", textJa: "資産は企業自身の資産とは別に保管しなければならない" },
      { letter: "C", textJa: "通常のビジネスアワー中は資産を金庫から出しておくことができる" },
      { letter: "D", textJa: "企業は定期的な照合を行わなければならない" }
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
  },
  {
    questionId: "1078718",
    questionJa: "MiFID IIの下で、投資企業が商品ガバナンスに関して実施しなければならない要件は次のうちどれですか？",
    explanationJa: "MiFID IIの商品ガバナンス要件では、企業は各金融商品について特定のターゲット市場を定義し、その商品がそのターゲット市場のニーズに適合することを確保しなければなりません。",
    options: [
      { letter: "A", textJa: "すべての商品に同じリスク評価を適用する" },
      { letter: "B", textJa: "各金融商品のターゲット市場を定義する" },
      { letter: "C", textJa: "商品承認プロセスを毎年更新する" },
      { letter: "D", textJa: "商品のパフォーマンスを四半期ごとに公表する" }
    ]
  },
  {
    questionId: "1000217",
    questionJa: "FCAの国際的な目的に関する以下の記述のうち、正しいものはどれですか？",
    explanationJa: "FCAには正式な国際的目的はありませんが、グローバルな規制協力と基準の調和を促進する役割があります。",
    options: [
      { letter: "A", textJa: "FCAには法定の国際的目的がある" },
      { letter: "B", textJa: "FCAは国際的な規制協力を促進する役割がある" },
      { letter: "C", textJa: "FCAは外国の規制当局に対して執行権限を持つ" },
      { letter: "D", textJa: "FCAは国際的な活動に参加しない" }
    ]
  },
  {
    questionId: "1000215",
    questionJa: "Threshold Conditionsに関する以下の記述のうち、正しいものはどれですか？",
    explanationJa: "Threshold Conditionsは、企業が認可を取得し維持するために満たさなければならない最低基準です。これらは継続的に満たされなければなりません。",
    options: [
      { letter: "A", textJa: "認可申請時にのみ満たす必要がある" },
      { letter: "B", textJa: "継続的に満たされなければならない" },
      { letter: "C", textJa: "大企業にのみ適用される" },
      { letter: "D", textJa: "任意の基準である" }
    ]
  },
  {
    questionId: "1078719",
    questionJa: "FCAの競争目的に関して、以下のうち正しい記述はどれですか？",
    explanationJa: "FCAの競争目的は、消費者の利益のために関連市場における効果的な競争を促進することです。",
    options: [
      { letter: "A", textJa: "競争を制限して市場の安定性を確保する" },
      { letter: "B", textJa: "消費者の利益のために効果的な競争を促進する" },
      { letter: "C", textJa: "大企業の市場支配を支援する" },
      { letter: "D", textJa: "価格競争を防止する" }
    ]
  },
  {
    questionId: "1069719",
    questionJa: "Operational Resilienceに関するFCAの要件について、最も正確な記述は次のうちどれですか？",
    explanationJa: "企業は重要なビジネスサービスを特定し、それらのサービスに対する許容可能な混乱レベル（インパクト・トレランス）を設定し、そのレベル内で運営できることを確保しなければなりません。",
    options: [
      { letter: "A", textJa: "すべての業務を24時間365日継続する必要がある" },
      { letter: "B", textJa: "重要なビジネスサービスのインパクト・トレランスを設定する必要がある" },
      { letter: "C", textJa: "サイバー攻撃の防止のみに焦点を当てる" },
      { letter: "D", textJa: "小規模企業は免除される" }
    ]
  },
  {
    questionId: "1000214",
    questionJa: "FCAのAccountability Regimeに関する以下の記述のうち、正しいものはどれですか？",
    explanationJa: "Accountability Regimeは、シニアマネージャーに明確な責任を割り当て、規制違反に対する個人的な説明責任を確立します。",
    options: [
      { letter: "A", textJa: "ジュニアスタッフのみに適用される" },
      { letter: "B", textJa: "シニアマネージャーに明確な責任を割り当てる" },
      { letter: "C", textJa: "企業の財務報告のみを対象とする" },
      { letter: "D", textJa: "任意の制度である" }
    ]
  },
  {
    questionId: "1078720",
    questionJa: "Consumer Dutyに関する以下の記述のうち、最も正確なものはどれですか？",
    explanationJa: "Consumer Dutyは、企業が消費者に対して良い結果をもたらすことを要求する新しい規制基準で、より高い消費者保護基準を設定します。",
    options: [
      { letter: "A", textJa: "既存の規則を置き換えるものではない" },
      { letter: "B", textJa: "消費者に良い結果をもたらすことを要求する新しい基準である" },
      { letter: "C", textJa: "リテール顧客にのみ適用される" },
      { letter: "D", textJa: "2025年から施行される" }
    ]
  },
  {
    questionId: "1014763",
    questionJa: "Best Executionに関するMiFID IIの要件について、正しい記述は次のうちどれですか？",
    explanationJa: "企業は、価格、コスト、スピード、実行と決済の可能性、規模、性質、その他関連する考慮事項を含む複数の要因を考慮して、顧客にとって最良の結果を得るための合理的な手順を踏まなければなりません。",
    options: [
      { letter: "A", textJa: "最も安い価格を常に選択しなければならない" },
      { letter: "B", textJa: "複数の要因を考慮して最良の結果を得る必要がある" },
      { letter: "C", textJa: "プロフェッショナル顧客には適用されない" },
      { letter: "D", textJa: "株式取引のみに適用される" }
    ]
  },
  {
    questionId: "1067587",
    questionJa: "FCAのSupervisory Approachに関する記述で正しいものは次のうちどれですか？",
    explanationJa: "FCAは、企業がもたらすリスクと害の程度に基づいてリソースを配分するリスクベースのアプローチを採用しています。",
    options: [
      { letter: "A", textJa: "すべての企業を同じように監督する" },
      { letter: "B", textJa: "リスクベースのアプローチを採用している" },
      { letter: "C", textJa: "大企業のみを監督する" },
      { letter: "D", textJa: "年に一度だけ企業を審査する" }
    ]
  },
  {
    questionId: "1000212",
    questionJa: "Treating Customers Fairly (TCF)の原則に関して、正しい記述は次のうちどれですか？",
    explanationJa: "TCFは、顧客の公正な扱いが企業文化の中心にあることを要求し、ライフサイクル全体を通じて公正な顧客成果の達成を目指します。",
    options: [
      { letter: "A", textJa: "販売時点でのみ適用される" },
      { letter: "B", textJa: "顧客関係のライフサイクル全体に適用される" },
      { letter: "C", textJa: "大口顧客にのみ適用される" },
      { letter: "D", textJa: "任意のガイドラインである" }
    ]
  },
  {
    questionId: "1014765",
    questionJa: "Market Abuse Regulation (MAR)における市場操作の定義に含まれないものは次のうちどれですか？",
    explanationJa: "正当なビジネス上の理由による大量取引は、それ自体では市場操作とはみなされません。市場操作には、誤解を招く取引、虚偽の情報の流布、価格操作などが含まれます。",
    options: [
      { letter: "A", textJa: "誤解を招く取引" },
      { letter: "B", textJa: "虚偽の情報の流布" },
      { letter: "C", textJa: "正当なビジネス上の理由による大量取引" },
      { letter: "D", textJa: "価格を人為的なレベルに固定する行為" }
    ]
  },
  {
    questionId: "1069722",
    questionJa: "FCAのInnovation Hubの目的は何ですか？",
    explanationJa: "Innovation Hubは、革新的な金融商品やサービスを開発する企業を支援し、規制の明確性を提供し、消費者に利益をもたらす革新を促進します。",
    options: [
      { letter: "A", textJa: "新しい規制を開発する" },
      { letter: "B", textJa: "革新的な企業に規制サポートを提供する" },
      { letter: "C", textJa: "スタートアップ企業に資金を提供する" },
      { letter: "D", textJa: "新技術を禁止する" }
    ]
  },
  {
    questionId: "1000211",
    questionJa: "FCAのPrinciples for Businessesに違反した場合の結果として正しくないものは次のうちどれですか？",
    explanationJa: "Principlesの違反は懲戒処分につながる可能性がありますが、自動的な刑事訴追にはつながりません。刑事訴追は特定の刑事犯罪に対してのみ行われます。",
    options: [
      { letter: "A", textJa: "罰金" },
      { letter: "B", textJa: "公開譴責" },
      { letter: "C", textJa: "自動的な刑事訴追" },
      { letter: "D", textJa: "認可の取り消し" }
    ]
  },
  {
    questionId: "1078721",
    questionJa: "FCAのRegulatory Sandboxの目的について最も正確な記述は次のうちどれですか？",
    explanationJa: "Regulatory Sandboxは、企業が実際の市場環境で革新的な商品、サービス、ビジネスモデル、配送メカニズムをテストできる「安全な場所」を提供します。",
    options: [
      { letter: "A", textJa: "規制を完全に免除する" },
      { letter: "B", textJa: "管理された環境で革新的なソリューションをテストできるようにする" },
      { letter: "C", textJa: "新しい規制を試験的に導入する" },
      { letter: "D", textJa: "海外企業のみが利用できる" }
    ]
  },
  {
    questionId: "1000216",
    questionJa: "FCAのAuthorisation processに関する記述で正しいものは次のうちどれですか？",
    explanationJa: "FCAの認可プロセスでは、申請者がThreshold Conditionsを満たし、提案されたビジネスモデルが規制要件に準拠していることを実証する必要があります。",
    options: [
      { letter: "A", textJa: "すべての申請は自動的に承認される" },
      { letter: "B", textJa: "申請者はThreshold Conditionsを満たす必要がある" },
      { letter: "C", textJa: "プロセスは最大1週間で完了する" },
      { letter: "D", textJa: "財務情報の提出は不要である" }
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

console.log(`✅ 翻訳を適用しました！`);
console.log(`翻訳済み: ${translations.length}問`);
console.log(`残りの未翻訳: ${untranslatedCount}問`);
console.log(`合計: ${questions.length}問`);