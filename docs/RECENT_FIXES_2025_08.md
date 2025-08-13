# 2025年8月 修正履歴（Claude Code → GPT-5 移行分含む）

## 📅 2025-08-13 修正内容

### 1. セキュリティ/API
- Geminiキーをクライアント露出しない方針へ移行（`GEMINI_API_KEY` サーバ専用）
- `app/api/extract-keywords` に zod 入力バリデーション、強化したレート制限キー（clientId+IP+UAのSHA-256）
- クライアント側のAPIレスポンス解釈の不整合を修正（`{ success, data: { keywords }, cached }` に対応）

### 2. HTMLレンダラ/XSS
- DOMPurifyの設定強化（`style` 禁止、リンクに `rel="noopener noreferrer nofollow ugc"`、許可スキーム制限）
- DOMPurifyフックの多重登録防止（初回のみ）
- 検索ハイライトにデバウンス（150ms）

### 3. ハイライト機能
- `MaterialViewer` に `HighlightManager` を統合（HTML表示で選択→ハイライト作成が可能に）
- DOM操作は `Range.surroundContents` で安全化。セレクタ不一致時は `textQuote` による文脈照合でフォールバック
- `HighlightAnchor` に `textQuote/textPosition` を追加

### 4. PDFビューア
- pdf.js ワーカーの信頼性改善：jsDelivr CDNに切替（CORS/Accessブロック回避）
- テキストレイヤ検索ハイライトを実装。可視ページ範囲のみに適用してパフォーマンスを確保

### 5. 教材ページの戻る動作
- `localStorage('materialNavigationState')` が無い場合に `return*` パラメータからフォールバック復元
- 学習→教材遷移前に `studySessionState` スナップショットを明示保存し、戻り復元を確実化
- 学習画面での復元は認証準備完了後に実施（早過ぎる復元による初期化を防止）

### 6. Cypress/E2E
- ドラッグ選択の安定化（座標ドラッグヘルパー `dragSelect` 追加）
- ハイライトポップアップのボタンに `data-color` を付与しセレクタを安定化
- PDFエラーの intercept を正規表現に修正

### 7. デプロイ/設定
- `next.config.ts` の `/materials/*.pdf` カスタムヘッダを削除（Vercel標準に委譲）
- `tsconfig.json` で `cypress` を型チェック対象外に（CIビルド安定化）

### 8. RAG導入（2025-08-13）
- `/api/retrieve` を新設。OpenAIの `text-embedding-3-small` + コサイン類似度 + MMRで上位パッセージ返却
- 前処理スクリプト `scripts/build-material-index.ts` でHTML教材をチャンク化・正規化・埋め込み生成
- `services/vector-client-qdrant.ts` を追加し、`VECTOR_BACKEND=qdrant` でQdrantに切替
- `scripts/upload-to-qdrant.ts` により、生成JSONをQdrantへ一括アップサート
- 学習→教材連携をRAG結果ベースに更新し、対象ページ自動ジャンプ/スニペットハイライトを実装

---

## 既知事項/今後の課題（要改善）
- PDFワーカーは現状CDN。さらに堅牢化する場合は自己ホスト（`public/pdf.worker.min.mjs`）に切替
- RAG導入により、教材内の該当箇所提示精度を抜本的に改善（BM25→ベクタ検索→rerank の段階導入）
- サーバAPIでの外部Web検索（公式サイト優先）対応を検討


