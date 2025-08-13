# GPTモデル構成設定ガイド

## 現在の推奨構成: Balanced Plus (GPT-5 mini/GPT-5 mini)

### 設定方法

`.env.local`ファイルに以下の環境変数を追加してください：

```bash
# GPT Model Configuration - Balanced Plus
OPENAI_QUERY_EXPANSION_MODEL=gpt-5-mini-2025-08-07
OPENAI_RERANK_MODEL=gpt-5-mini-2025-08-07
```

### パフォーマンス特性

| 項目 | 値 | 備考 |
|------|-----|------|
| **平均応答速度** | 24.7秒 | 実測値 |
| **予想精度** | 88% | 理論値 |
| **月額コスト** | $1,500 | OpenAI料金 |
| **推奨用途** | 本番環境 | バランス重視 |

### この構成を選ぶ理由

1. **コストパフォーマンス**
   - GPT-5フル版（$2,000/月）より25%安い
   - 精度は理論上88%を維持

2. **速度**
   - 実測24.7秒で安定
   - ユーザー体験として許容範囲

3. **安定性**
   - GPT-5 miniは安定版
   - 本番環境での実績あり

### 他の構成オプション

必要に応じて以下の構成も選択可能です：

#### A. Production (最高精度)
```bash
OPENAI_QUERY_EXPANSION_MODEL=gpt-5-2025-08-07
OPENAI_RERANK_MODEL=gpt-5-mini-2025-08-07
# 速度: 26.8秒、精度: 95%（理論）、コスト: $2,000/月
```

#### C. Balanced (コスト重視)
```bash
OPENAI_QUERY_EXPANSION_MODEL=gpt-4.1-2025-04-14
OPENAI_RERANK_MODEL=gpt-4.1-2025-04-14
# 速度: 27.2秒、精度: 82%（理論）、コスト: $800/月
```

#### D. Speed Priority (開発環境)
```bash
OPENAI_QUERY_EXPANSION_MODEL=gpt-5-nano-2025-08-07
OPENAI_RERANK_MODEL=gpt-5-nano-2025-08-07
# 速度: 22.4秒、精度: 65%（理論）、コスト: $200/月
```

### 切り替え手順

1. `.env.local`ファイルを編集
2. 上記の環境変数を設定
3. 開発サーバーを再起動
   ```bash
   npm run dev
   ```

### 動作確認

設定が正しく適用されているか確認：

```bash
# APIログで使用モデルを確認
grep "Configuration set" /tmp/rag-test-*.log
```

### トラブルシューティング

**問題**: モデルが利用できないエラー
```
解決策: OpenAI APIダッシュボードでモデルアクセスを確認
```

**問題**: 速度が期待値より遅い
```
解決策: 
1. ネットワーク接続を確認
2. Qdrantサーバーの応答を確認
3. キャッシュが有効か確認
```

### モニタリング

パフォーマンスを継続的に監視：

```typescript
// app/api/retrieve/route.ts に追加
console.log(`[Performance] Model: ${process.env.OPENAI_QUERY_EXPANSION_MODEL}, Time: ${responseTime}ms`);
```

---

*最終更新: 2025年8月13日*
*次回レビュー: 2025年9月1日*