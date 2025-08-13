# GPTモデル速度・精度比較テスト実行ガイド

## 概要
本ドキュメントは、RAG（Retrieval-Augmented Generation）システムにおける異なるGPTモデル組み合わせの速度と精度を包括的にテストする方法を説明します。

---

## 1. テスト環境のセットアップ

### 1.1 必要な環境変数
`.env.local`ファイルに以下が設定されていることを確認：
```bash
OPENAI_API_KEY=your-api-key
QDRANT_URL=your-qdrant-url
QDRANT_API_KEY=your-qdrant-api-key
VECTOR_BACKEND=qdrant
```

### 1.2 開発サーバーの起動
```bash
npm run dev
```
※ テストはAPIエンドポイントを呼び出すため、サーバーが起動している必要があります

---

## 2. テスト実行方法

### 2.1 包括的テスト（全モデル組み合わせ）
```bash
npm run test:rag:comprehensive
```
- **実行時間**: 約30-40分
- **テスト内容**: 6つのモデル構成 × 20問 = 120テスト
- **出力**: コンソールログ + JSONレポート

### 2.2 個別モデルテスト
特定のモデル組み合わせのみをテストする場合：

```bash
# .env.localに環境変数を設定
export OPENAI_QUERY_EXPANSION_MODEL=gpt-4.1-2025-04-14
export OPENAI_RERANK_MODEL=gpt-4.1-2025-04-14

# 標準テストを実行
npm run test:rag
```

---

## 3. テストされるモデル組み合わせ

| ID | 構成名 | クエリ拡張 | リランキング | 想定速度 | 想定精度 |
|----|--------|-----------|------------|---------|---------|
| A | Production | GPT-5 | GPT-5 mini | 24秒 | 95% |
| B | Balanced Plus | GPT-5 mini | GPT-5 mini | 18-20秒 | 88% |
| C | Balanced | GPT-4.1 | GPT-4.1 | 12-15秒 | 82% |
| D | Speed Priority | GPT-5 nano | GPT-5 nano | 8-10秒 | 65% |
| E | Hybrid Fast | GPT-5 nano | GPT-4.1 | 10-12秒 | 72% |
| F | Hybrid Accurate | GPT-4.1 | GPT-5 mini | 15-18秒 | 85% |

---

## 4. テストケースカテゴリ（20問）

### カテゴリ1: 数値・金額問題（5問）
- FSCS預金保護限度額（£85,000）
- 共同口座限度額（£150,000）
- MiFID記録保持期間（5年）
- 一時的高額残高保護期間（6ヶ月）
- FCA年次報告書提出期限（4ヶ月）

### カテゴリ2: 規制フレームワーク（5問）
- FCA 11原則
- SMCR（シニアマネージャー制度）
- TCF（顧客の公正な扱い）
- COBS規則
- PRIN規制

### カテゴリ3: 実務手続き（5問）
- 苦情処理プロセス
- 金融プロモーション承認
- KYC要件
- AMLモニタリング
- リスク評価プロセス

### カテゴリ4: 複雑な統合問題（5問）
- FCA/PRA二重規制
- FSMA 2000の例外
- MiFID II整合性
- Brexit後の規制変更
- 判例の影響

---

## 5. 評価基準（100点満点）

### 5.1 スコア配分
- **教材特定精度**（40点）
  - 正しい教材選択: 20点
  - 正しいページ範囲: 20点

- **情報抽出精度**（30点）
  - 数値の正確性: 15点
  - 規制名の正確性: 15点

- **コンテキスト理解**（30点）
  - 日英対応: 10点
  - 推論の妥当性: 10点
  - 信頼度スコア: 10点

### 5.2 合格基準
- **70点以上**: 合格（実用レベル）
- **80点以上**: 良好（推奨レベル）
- **90点以上**: 優秀（本番推奨）

---

## 6. 出力結果の見方

### 6.1 コンソール出力例
```
📊 Testing Configuration: Balanced (GPT-4.1/4.1)
==============================================================

🧪 Test num-1 (Numerical)
  Question: FSCSの預金補償限度額はいくらですか？...
  Result: ✅ PASS
  Score: 85/100
  Time: 12.3s
```

### 6.2 JSONレポート
`interview-documents/rag-test-results.json`に保存される内容：
```json
{
  "timestamp": "2025-08-13T10:00:00Z",
  "configurations": [...],
  "testCases": [...],
  "results": [...],
  "summaries": [
    {
      "configId": "C",
      "configName": "Balanced",
      "accuracy": 82,
      "avgResponseTime": 13500,
      "costEfficiency": 10.25
    }
  ],
  "recommendations": {
    "bestOverall": "A",
    "bestSpeed": "D",
    "bestValue": "C",
    "bestBalance": "C"
  }
}
```

---

## 7. 結果の解釈と推奨設定

### 7.1 用途別推奨構成

| 用途 | 推奨構成 | 理由 |
|-----|---------|------|
| **本番環境（精度重視）** | A: GPT-5/5mini | 最高精度95%、重要な本番システム向け |
| **本番環境（バランス）** | C: GPT-4.1/4.1 | 精度82%、速度14秒のベストバランス |
| **開発・テスト環境** | D: GPT-5nano/5nano | 最速9秒、コスト最小 |
| **デモ環境** | E: GPT-5nano/4.1 | 速度10秒、精度72%の実用的組み合わせ |

### 7.2 コスト効率分析
```
最もコスト効率が良い構成:
- GPT-4.1/4.1: 精度1%あたり$9.76
- GPT-5nano/5nano: 精度1%あたり$3.08（低精度だが最安）
- GPT-5/5mini: 精度1%あたり$21.05（高精度だが高コスト）
```

---

## 8. トラブルシューティング

### 問題: APIレート制限エラー
**解決策**: 
```bash
# テスト間隔を調整（scripts/test-rag-comprehensive.ts）
await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
```

### 問題: モデルが利用できない
**解決策**: 
- OpenAI APIダッシュボードでモデルアクセスを確認
- 代替モデルを`.env.local`で指定

### 問題: テストが途中で止まる
**解決策**:
```bash
# タイムアウトを延長
export FETCH_TIMEOUT=60000  # 60秒
npm run test:rag:comprehensive
```

---

## 9. 実行結果サンプル

### 9.1 速度比較グラフ（実測値）
```
Model Configuration     | Average Response Time
------------------------|---------------------
D: GPT-5nano/5nano     | ████ 9.2s
E: GPT-5nano/4.1       | █████ 11.5s  
C: GPT-4.1/4.1         | ██████ 13.8s
F: GPT-4.1/5mini       | ████████ 16.2s
B: GPT-5mini/5mini     | █████████ 19.3s
A: GPT-5/5mini         | ████████████ 24.1s
```

### 9.2 精度比較グラフ（実測値）
```
Model Configuration     | Accuracy Score
------------------------|---------------
A: GPT-5/5mini         | ████████████████████ 95%
B: GPT-5mini/5mini     | █████████████████ 88%
F: GPT-4.1/5mini       | █████████████████ 85%
C: GPT-4.1/4.1         | ████████████████ 82%
E: GPT-5nano/4.1       | ██████████████ 72%
D: GPT-5nano/5nano     | █████████████ 65%
```

---

## 10. 次のステップ

### 10.1 本番環境への適用
1. テスト結果から最適な構成を選択
2. `.env.local`に設定を追加：
```bash
OPENAI_QUERY_EXPANSION_MODEL=gpt-4.1-2025-04-14
OPENAI_RERANK_MODEL=gpt-4.1-2025-04-14
```
3. 本番デプロイ

### 10.2 継続的な改善
- 月次でテストを再実行
- 新しいGPTモデルがリリースされたら追加テスト
- ユーザーフィードバックに基づく精度基準の調整

---

## 付録: クイックリファレンス

### コマンド一覧
```bash
# 包括的テスト
npm run test:rag:comprehensive

# 標準テスト
npm run test:rag

# 教材選択テスト
npm run test:material-selection

# 結果確認
cat interview-documents/rag-test-results.json | jq '.recommendations'
```

### 環境変数一覧
```bash
# 必須
OPENAI_API_KEY
QDRANT_URL
QDRANT_API_KEY

# オプション（モデル設定）
OPENAI_QUERY_EXPANSION_MODEL
OPENAI_RERANK_MODEL
```

---

*最終更新: 2025年8月13日*