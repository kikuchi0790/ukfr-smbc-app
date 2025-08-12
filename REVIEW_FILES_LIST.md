# レビュー対象ファイルリスト

## 優先度：最高（セキュリティ・アーキテクチャの中核）

### APIとセキュリティ
- `/lib/gemini.ts` - Gemini API統合（APIキー管理）
- `/app/api/extract-keywords/route.ts` - キーワード抽出API
- `/lib/firebase.ts` - Firebase設定

### 中核コンポーネント
- `/components/MaterialViewer/index.tsx` - 統合教材ビューア
- `/components/HighlightManager.tsx` - ハイライト管理ロジック
- `/app/materials/page.tsx` - 教材ビューアページ
- `/app/study/session/page.tsx` - 学習セッション（連携部分）

## 優先度：高（主要機能）

### MaterialViewerコンポーネント群
- `/components/MaterialViewer/PdfRenderer.tsx` - PDF表示
- `/components/MaterialViewer/HtmlRenderer.tsx` - HTML表示・キーワードハイライト
- `/components/MaterialViewer/NoteEditor.tsx` - ノート編集
- `/components/MaterialViewer/TextRenderer.tsx` - テキスト表示

### ハイライト関連
- `/components/HighlightsList.tsx` - ハイライト一覧
- `/components/HighlightPopup.tsx` - ハイライト作成UI
- `/app/highlights/page.tsx` - ハイライト一覧ページ

### サービス層
- `/services/keyword-extraction.ts` - キーワード抽出サービス
- `/services/storage-service.ts` - ストレージ統一サービス

## 優先度：中（型定義・ユーティリティ）

### 型定義
- `/types/index.ts` - 主要な型定義（Highlight, HighlightAnchor等）

### ユーティリティ
- `/utils/storage-utils.ts` - LocalStorage安全ラッパー
- `/utils/formatters.ts` - フォーマット処理
- `/utils/validation-utils.ts` - バリデーション

### コンテキスト
- `/contexts/AuthContext.tsx` - 認証コンテキスト

## 優先度：低（テスト・設定）

### テストファイル
- `/components/MaterialViewer/TableOfContents.test.tsx` - 目次テスト
- `/cypress/e2e/` - E2Eテスト

### 設定ファイル
- `/package.json` - 依存関係
- `/next.config.js` - Next.js設定
- `/tsconfig.json` - TypeScript設定
- `/.env.local.example` - 環境変数例

## レビュー時の確認観点

### 各ファイルで特に注意すべき点

1. **`/lib/gemini.ts`**
   - APIキーの管理方法
   - エラーハンドリング
   - レート制限対応

2. **`/components/HighlightManager.tsx`**
   - LocalStorage操作の安全性
   - DOM操作のパフォーマンス
   - メモリリーク可能性

3. **`/components/MaterialViewer/HtmlRenderer.tsx`**
   - XSS対策の完全性
   - キーワードハイライトのパフォーマンス
   - DOMPurifyの設定

4. **`/app/api/extract-keywords/route.ts`**
   - キャッシュ戦略
   - エラーレスポンス
   - メモリ使用量

5. **`/services/storage-service.ts`**
   - エラーハンドリング
   - データ整合性
   - 容量制限対応

## コードレビュー実施手順

1. **REVIEW_CONTEXT.md**を読んで全体像を把握
2. 優先度「最高」のファイルから順にレビュー
3. 特にセキュリティ、パフォーマンス、エラーハンドリングに注目
4. 改善提案は具体的なコード例を含めて提示
5. 重要度に応じて改善提案を分類（必須/推奨/任意）