# 問題演習と教材の連携機能 - 実装ドキュメント

## 概要

このドキュメントは、2025年6月24日に実装された問題演習と教材の連携機能について詳細に記録したものです。この機能により、ユーザーは問題演習中に関連する教材を即座に参照でき、重要な部分をハイライトして学習効率を向上させることができます。

## 実装背景

### 課題
- 問題演習で正解・不正解になった際、該当する教材箇所を探すのが困難
- 問題と教材が結びついていない
- 間違えた箇所を教材から復習する手段がない

### 解決策
1. AI（Gemini API）を使用した問題文からのキーワード抽出（補助）
2. RAG（OpenAI埋め込み + ベクタ検索）により該当パッセージを特定
3. ハイライト機能による重要箇所のマーキング
4. 問題と教材間のシームレスなナビゲーション

## 技術スタック

- **AI API**: Google Gemini API（キーワード抽出補助）、OpenAI Embeddings（text-embedding-3-small）
- **Vector DB**: Qdrant（推奨、マネージド）/ ローカルJSONフォールバック
- **フレームワーク**: Next.js 15.3.3 (App Router)
- **データベース**: Firebase Firestore
- **認証**: Firebase Authentication
- **UI**: TypeScript + React + Tailwind CSS

## 実装フェーズ

### Phase 1: 基盤整備

#### 1. 型定義の追加 (`types/index.ts`)
```typescript
// ハイライト関連の型定義
export interface Highlight {
  id: string;
  userId: string;
  materialId: string;
  pageNumber?: number;
  text: string;
  startOffset: number;
  endOffset: number;
  color: HighlightColor;
  note?: string;
  relatedQuestionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type HighlightColor = 'yellow' | 'green' | 'red' | 'blue';

// キーワードキャッシュの型定義
export interface KeywordCache {
  questionId: string;
  keywords: string[];
  createdAt: string;
  expiresAt: string;
}

// 教材連携のナビゲーション情報
export interface MaterialNavigationState {
  from: 'study' | 'mock' | 'review';
  sessionId: string;
  questionIndex: number;
  questionId: string;
  keywords?: string[];
}
```

#### 2. Gemini API設定 (`lib/gemini.ts`)
- APIキー設定
- キーワード抽出関数の実装
- フォールバック処理

#### 3. ハイライト同期サービス (`services/highlight-sync.ts`)
- Firebaseとの同期機能
- ローカルストレージへのキャッシュ
- リアルタイム同期のセットアップ

### Phase 2: AIキーワード抽出

#### 1. APIエンドポイント (`app/api/extract-keywords/route.ts`)
- レート制限（1分あたり10リクエスト）
- サーバーサイドキャッシュ（24時間）
- エラーハンドリング

#### 2. キーワード抽出サービス (`services/keyword-extraction.ts`)
- クライアントサイドキャッシュ（7日間）
- フォールバックキーワード抽出
- バッチ処理対応

### Phase 3: 教材連携機能（RAG検索）

#### 1. 問題画面の拡張 (`app/study/session/page.tsx`)
```typescript
// 教材確認ボタンの追加
<button
  onClick={handleCheckInMaterials}
  disabled={extractingKeywords}
  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all"
>
  <BookOpen className="w-5 h-5" />
  {extractingKeywords ? 'キーワードを抽出中...' : '教材で詳しく確認'}
</button>
```

#### 2. 教材ビューアの拡張 (`app/materials/page.tsx`)
- URLパラメータからのナビゲーション情報取得
- `/api/retrieve` を呼び出し、RAG結果を `localStorage(retrieveResults_*)` に保存
- 教材画面で結果を読み取り、教材/ページへ自動ジャンプ（スニペット一致でハイライト）
- 戻るボタンの動的制御

### Phase 4: ハイライト機能

#### 1. UIコンポーネント
- **HighlightPopup.tsx**: 色選択ポップアップ
- **HighlightManager.tsx**: ハイライト管理ロジック
- **HighlightsList.tsx**: ハイライト一覧表示

#### 2. 機能実装
- テキスト選択検出
- ハイライトの作成・削除
- Firebase同期
- リアルタイム更新

#### 3. ハイライト一覧ページ (`app/highlights/page.tsx`)
- フィルタリング（全て/Checkpoint/Study Companion）
- ソート（日付順/教材順）
- 統計情報表示

## 主要機能

### 1. キーワード抽出
- 問題文、選択肢、正解、解説から重要キーワードを抽出
- 金融規制専門用語を優先
- 最大2個のキーワードを抽出

### 2. RAG検索
- 教材ビューアへの遷移前に `/api/retrieve` を実行
- 上位パッセージ（materialId/page/quote/score/offset）を保存→教材画面で読み取り
- 最上位ページへジャンプし、スニペット一致でハイライト

### 3. ハイライト機能
- 4色のハイライト（黄、緑、赤、青）
- ノート機能
- 問題IDとの関連付け
- マルチデバイス同期

### 4. ナビゲーション
- 問題→教材：キーワード付きで遷移
- 教材→問題：元のセッションに復帰
- ハイライト一覧→教材：該当箇所へ直接移動

## 使用方法

### 問題演習から教材へ
1. 問題に回答
2. 正解・不正解表示後、「教材で詳しく確認」ボタンをクリック
3. AIがキーワードを抽出（ローディング表示）
4. 教材ビューアに遷移し、自動的に検索実行

### ハイライト作成
1. 教材でテキストを選択（3文字以上）
2. ポップアップから色を選択
3. 必要に応じてノートを追加
4. 自動的にFirebaseに保存

### ハイライト管理
1. ダッシュボードから「ハイライト一覧」へアクセス
2. フィルターやソートで整理
3. ハイライトをクリックして該当教材へ移動

## 技術的な工夫

### パフォーマンス最適化
- 多層キャッシュシステム（メモリ/ローカルストレージ）
- レート制限による API 使用量の管理
- 非同期処理による UI のブロッキング防止

### エラーハンドリング
- API エラー時のフォールバック
- ネットワークエラーの適切な処理
- ユーザーフレンドリーなエラーメッセージ

### モバイル対応
- タッチ操作に最適化された UI
- iPad での検索機能
- レスポンシブデザイン

## 今後の拡張可能性

1. **ハイライトの共有機能**
   - 他のユーザーとハイライトを共有
   - 学習グループでの活用

2. **AI による学習提案**
   - ハイライトパターンの分析
   - 弱点分野の特定と学習提案

3. **統計・分析機能**
   - ハイライト頻度の分析
   - 学習効率の可視化

4. **エクスポート機能**
   - ハイライトのPDF出力
   - 学習ノートの生成

## 関連ファイル

### 新規作成ファイル
- `/lib/gemini.ts` - Gemini API 設定
- `/app/api/extract-keywords/route.ts` - キーワード抽出 API
- `/services/keyword-extraction.ts` - キーワード抽出サービス
- `/services/highlight-sync.ts` - ハイライト同期サービス
- `/components/HighlightPopup.tsx` - ハイライトポップアップ
- `/components/HighlightManager.tsx` - ハイライト管理
- `/components/HighlightsList.tsx` - ハイライト一覧
- `/app/highlights/page.tsx` - ハイライト一覧ページ

### 修正ファイル
- `/types/index.ts` - 型定義の追加
- `/app/study/session/page.tsx` - 教材確認ボタンの追加
- `/app/materials/page.tsx` - ハイライト機能の統合
- `/app/dashboard/page.tsx` - ハイライト一覧へのリンク追加

## まとめ

この実装により、問題演習と教材学習がシームレスに連携し、より効率的な学習体験を提供できるようになりました。AI によるキーワード抽出とハイライト機能の組み合わせにより、ユーザーは重要なポイントを見逃すことなく、効果的に知識を定着させることができます。