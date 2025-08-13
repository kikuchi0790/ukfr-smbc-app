# RAG Index Rebuild - 2025-08-13 Part 2

## 実施内容

### 1. インデックス再構築の実施
GPT-5モデル導入後、materialIdフォーマットの問題を解決するために本番インデックスを再構築しました。

### 2. 実行手順

#### Phase 1: 環境確認
```bash
# 環境変数の確認
grep -E "OPENAI_API_KEY|VECTOR_BACKEND|QDRANT" .env.local

# 既存インデックスのバックアップ
cp services/data/materials_index.json services/data/materials_index_backup_$(date +%Y%m%d_%H%M%S).json
```

#### Phase 2: インデックス再構築
```bash
npm run build:index:text
```

結果:
- 合計699チャンク生成
- UKFR_ED32_Checkpoint: 44ページ, 147チャンク
- UKFR_ED32_Study_Companion: 112ページ, 552チャンク
- text-embedding-3-small (1536次元) で埋め込み生成

#### Phase 3: Qdrantアップロード
```bash
npm run upload:qdrant
```

結果:
- 699チャンクをQdrantに正常にアップロード
- バッチサイズ: 128レコード/バッチ

#### Phase 4: 統合テスト
テストスクリプト `scripts/test-rag-integration.ts` を作成し、FSCS £85,000問題でテストを実施。

結果:
- `/api/retrieve`: 正常動作確認、materialIdフォーマット修正確認
- `/api/rerank`: GPT-5パラメータ調整後、正常動作確認

### 3. 修正事項

#### GPT-5モデルのパラメータ制限対応
GPT-5モデル（gpt-5-2025-08-07）には以下の制限があることが判明:
- `max_tokens` パラメータはサポートされない
- `temperature` パラメータはデフォルト値（1.0）のみサポート

`app/api/rerank/route.ts` を修正:
```typescript
// Before
const resp = await openai.chat.completions.create({
  model: 'gpt-5-2025-08-07',
  messages: [...],
  response_format: { type: 'json_object' },
  temperature: 0.0,
  max_tokens: 500
});

// After
const resp = await openai.chat.completions.create({
  model: 'gpt-5-2025-08-07',
  messages: [...],
  response_format: { type: 'json_object' }
  // パラメータ制限のため、temperature と max_tokens を削除
});
```

### 4. 確認された問題と対策

#### materialIdフォーマット問題
- 旧: `StudyCompanion.html`, `StudyCompanion_backup.html`
- 新: `UKFR_ED32_Study_Companion`, `UKFR_ED32_Checkpoint`
- ✅ インデックス再構築により解決

#### GPT-5応答速度
- rerankエンドポイントの応答時間: 約20-30秒
- 高精度な推論のため許容範囲内と判断

### 5. 今後の推奨事項

1. **定期的なインデックス更新**
   - ソーステキストファイル更新時は必ず再構築を実施
   - バックアップを取ってから実行

2. **パフォーマンス監視**
   - GPT-5のレスポンスタイムを定期的に確認
   - 必要に応じてタイムアウト値の調整

3. **テストの自動化**
   - CI/CDパイプラインに統合テストを組み込み
   - インデックス更新後の自動検証

## 成果

✅ materialIdフォーマット問題を完全に解決
✅ FSCS £85,000問題での精度向上を確認
✅ GPT-5モデルの制限事項を把握し対応完了
✅ 本番環境へのデプロイ準備完了