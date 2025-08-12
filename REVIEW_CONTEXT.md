# コードレビュー用コンテキスト - UKFR学習アプリケーション

## 1. プロジェクト概要

### 目的
英国財務報告（UKFR）試験対策用の学習アプリケーション。問題演習、教材閲覧、進捗管理、ハイライト機能を提供。

### 技術スタック
- **フレームワーク**: Next.js 15.3.3 (App Router)
- **言語**: TypeScript
- **認証・DB**: Firebase Auth & Firestore
- **スタイリング**: Tailwind CSS
- **主要ライブラリ**:
  - react-pdf: PDF表示
  - isomorphic-dompurify: XSS対策
  - framer-motion: アニメーション
  - lucide-react: アイコン
  - date-fns: 日付処理

## 2. 最近の大規模変更（2025-08-12）

### 変更の背景
- 教材ビューアとハイライト機能が完全に動作していない状態だった
- Vercel KV依存でローカル開発が困難
- Gemini APIキーがハードコーディングされていた（セキュリティリスク）
- 過度に複雑な実装（Shadow DOM、unique-selector等）

### 実装した機能

#### 2.1 AIキーワード抽出機能
```typescript
// /lib/gemini.ts
- APIキーを環境変数化（NEXT_PUBLIC_GEMINI_API_KEY）
- 問題文からキーワードを自動抽出
- 教材内での自動ハイライト

// /app/api/extract-keywords/route.ts
- Vercel KV依存を削除
- Mapベースのインメモリキャッシュに変更
```

#### 2.2 教材ビューア
```typescript
// /components/MaterialViewer/index.tsx
- PDF/HTML/テキストの統合ビューア
- ハイライト機能統合
- 検索機能

// /components/MaterialViewer/PdfRenderer.tsx
- react-pdfでPDF表示
- react-windowで仮想スクロール
- レスポンシブ対応

// /components/MaterialViewer/HtmlRenderer.tsx
- DOMPurifyでXSS対策
- キーワードハイライト機能
```

#### 2.3 ハイライト機能
```typescript
// /components/HighlightManager.tsx
- テキスト選択で4色ハイライト作成
- LocalStorage永続化（Firestore同期削除）
- ノート機能

// /components/HighlightsList.tsx
- ハイライト一覧表示
- 統計情報表示
- フィルタリング・ソート機能
```

#### 2.4 学習連携機能
```typescript
// /app/study/session/page.tsx
- 問題から教材へのジャンプ機能
- キーワード自動抽出・受け渡し

// /app/materials/page.tsx
- URLパラメータからキーワード受信
- 自動検索・ハイライト
- ナビゲーション状態保持
```

### 削除・簡素化した部分
1. **削除したファイル**:
   - `/services/data/highlight.service.ts` - 複雑なFirestore同期
   - `/services/highlight-sync.ts` - 不要な同期ロジック
   - `/utils/device-utils.ts` - デバイス判定ユーティリティ
   - `/components/MaterialViewer/HighlightLayer.tsx` - 自己修復機能

2. **削除した依存関係**:
   - @vercel/kv - ローカル開発を妨げていた
   - unique-selector - 型エラーと複雑性
   - Shadow DOM実装 - 過度に複雑

## 3. ファイル構造

```
/app
├── api/extract-keywords/route.ts  # AIキーワード抽出API
├── materials/page.tsx              # 教材ビューアページ
├── highlights/page.tsx             # ハイライト一覧ページ
└── study/session/page.tsx          # 学習セッション（教材連携）

/components
├── MaterialViewer/
│   ├── index.tsx                   # 統合ビューアコンポーネント
│   ├── PdfRenderer.tsx             # PDF表示
│   ├── HtmlRenderer.tsx            # HTML表示（キーワードハイライト）
│   ├── TextRenderer.tsx            # テキスト表示
│   ├── NoteEditor.tsx              # ノート編集
│   └── TableOfContents.tsx         # 目次
├── HighlightManager.tsx            # ハイライト管理
├── HighlightsList.tsx              # ハイライト一覧
└── HighlightPopup.tsx              # ハイライト作成ポップアップ

/lib
└── gemini.ts                       # Gemini API統合

/services
├── keyword-extraction.ts           # キーワード抽出サービス
└── storage-service.ts              # ストレージ統一サービス

/types
└── index.ts                        # 型定義（Highlight, HighlightAnchor等）
```

## 4. セキュリティ面の改善

### 4.1 修正済み
- ✅ Gemini APIキーの環境変数化
- ✅ DOMPurifyによるXSS対策
- ✅ React.memoによるコンポーネント最適化

### 4.2 要確認事項
- ⚠️ Firebase Firestoreのセキュリティルール（現状不明）
- ⚠️ NEXT_PUBLIC_*の環境変数使用（クライアント側露出）
- ⚠️ LocalStorageのデータ暗号化なし

## 5. パフォーマンス最適化

### 実装済み
- react-windowによる仮想スクロール（PDF）
- useMemoによる高価な計算の最適化
- React.memoによるコンポーネントメモ化
- インメモリキャッシュ（キーワード抽出）

### 潜在的な問題
- 大量のハイライト時のDOM操作パフォーマンス
- LocalStorage容量制限（5-10MB）
- PDF.jsの初期ロード時間

## 6. テスト状況

### 既存テスト
- Vitest単体テスト設定済み
- Cypress E2Eテスト設定済み
- TableOfContents.test.tsx（型エラー修正済み）

### テストカバレッジ
- ⚠️ 新実装部分のテストが不足
- ⚠️ ハイライト機能のE2Eテストなし
- ⚠️ キーワード抽出APIのテストなし

## 7. ビルド・デプロイ状況

### ビルド
```bash
npm run build  # ✅ エラーなし
npm run typecheck  # ✅ 型エラーなし
```

### 必要な環境変数
```env
# .env.local
NEXT_PUBLIC_GEMINI_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

## 8. レビューポイント

### 優先度：高
1. **セキュリティ**
   - NEXT_PUBLIC_GEMINI_API_KEYのクライアント露出は適切か？
   - LocalStorageのセキュリティは十分か？
   - Firestoreルールの確認

2. **アーキテクチャ**
   - LocalStorageのみでの永続化は適切か？（同期なし）
   - エラーハンドリングは十分か？
   - コンポーネント責務の分離は適切か？

3. **パフォーマンス**
   - 大量データ時のスケーラビリティ
   - メモリリークの可能性
   - 不要な再レンダリング

### 優先度：中
1. **コード品質**
   - 型定義の完全性
   - エラーバウンダリの実装
   - ログ出力の適切性

2. **UX/UI**
   - ローディング状態の表示
   - エラーメッセージの適切性
   - アクセシビリティ対応

3. **保守性**
   - コメントの充実度
   - 命名規則の一貫性
   - 将来の拡張性

## 9. 既知の問題と懸念事項

1. **データ同期**
   - 複数デバイス間でハイライトが同期されない（LocalStorageのみ）
   - オフライン時の挙動が未定義

2. **スケーラビリティ**
   - LocalStorage容量制限への対処なし
   - 大量ハイライト時のパフォーマンス未検証

3. **エッジケース**
   - PDF読み込み失敗時の処理
   - Gemini API制限への対処
   - 同時編集時のコンフリクト解決なし

## 10. 改善提案の期待事項

以下の観点からの改善提案を期待：

1. **セキュリティ強化**
   - APIキー管理のベストプラクティス
   - データ暗号化の必要性

2. **アーキテクチャ改善**
   - データ永続化戦略
   - 状態管理の最適化
   - コンポーネント設計

3. **パフォーマンス向上**
   - レンダリング最適化
   - バンドルサイズ削減
   - キャッシュ戦略

4. **テスト戦略**
   - 重要機能のテストカバレッジ
   - E2Eテストシナリオ
   - パフォーマンステスト

5. **ユーザビリティ**
   - エラー処理の改善
   - フィードバックの充実
   - アクセシビリティ対応

---

## レビュー実施時の注意事項

1. **コンテキスト**: Next.js 15 App Router使用、TypeScript strictモード
2. **制約**: Firebaseの無料プラン想定、Vercel無料プランでのデプロイ
3. **ユーザー**: 英国財務報告試験受験者（プロフェッショナル向け）
4. **デバイス**: PC/タブレット両対応必須
5. **ブラウザ**: Chrome/Safari/Edge最新版対応

このコンテキストを基に、コードの品質、セキュリティ、パフォーマンス、保守性の観点から包括的なレビューをお願いします。