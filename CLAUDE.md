# Claude.md - プロジェクトコンテキスト

## プロジェクト概要
英国財務報告（UKFR）学習アプリケーション。Next.js 15とTypeScriptで構築され、Firebase認証とFirestoreを使用。

## 最近の重要な変更（2025-08-13）

### RAG検索（OpenAI Embeddings + Qdrant）を導入・改善
問題→教材の該当箇所特定精度と到達速度を改善するため、RAG（ベクタ検索）を追加し、大幅な改善を実施しました。

#### 初期実装
1. サーバAPI
   - `POST /api/retrieve`（新規）: 質問文（questionId任意）→ ベクタ検索（MMR）で上位パッセージを返却
   - `POST /api/rerank`（任意）: 上位パッセージをLLMで再ランキング/根拠整形（JSON固定出力）
2. 前処理スクリプト
   - `scripts/build-material-index.ts`: `public/materials/*.html` からテキスト抽出→チャンク→正規化/エイリアス展開→OpenAI埋め込み→`services/data/materials_index.json` 生成
   - `scripts/upload-to-qdrant.ts`: 生成したJSONをQdrantへ一括アップサート（UUID化ID）
3. ベクタバックエンド
   - ローカル: `services/vector-client.ts`（JSONベース）
   - Qdrant: `services/vector-client-qdrant.ts`（`@qdrant/js-client-rest`）
   - 切替: `.env.local` の `VECTOR_BACKEND=qdrant` でQdrantを優先。未設定時はローカルJSONにフォールバック
4. UI連携
   - 学習画面 `app/study/session/page.tsx` で「教材で詳しく確認」時に `/api/retrieve` を実行し、結果を `localStorage(retrieveResults_*)` に保存
   - 教材画面 `app/materials/page.tsx` が保存結果を読み取り、対象教材・ページへ自動ジャンプし、スニペットでハイライト

#### 本日の大幅改善（精度向上）
1. **インデックス再構築**
   - HTMLファイルではなくテキストファイル（`_ja_fixed.txt`）から構築に変更
   - 新スクリプト: `scripts/build-material-index-from-text.ts`
   - チャンクサイズ: 2000文字→350文字に縮小（overlap: 400→100文字）
   - 正確なページ番号抽出（Checkpoint: 44ページ、StudyCompanion: 112ページ）
   - チャンク数: 165→699個（4.2倍増加）

2. **検索アルゴリズム改善**
   - クエリ最適化: 問題文全体ではなくキーフレーズ（200文字以内）を抽出
   - MMRλ: 0.5→0.7（精度重視）
   - スコア閾値: 0.7未満の低関連度結果を自動除外
   - キャッシュTTL: 7日→24時間に短縮
   - エイリアスマップ: 5→15項目に拡張

3. **GPT-4リランキング強化**
   - 日英クロスリンガル対応を明示的にプロンプトに追加
   - 金融規制用語への注意喚起
   - パッセージの番号付けで選択を明確化
   - temperature: 0→0.1、max_tokens: 200→300

4. **デバッグ機能**
   - 詳細なRAGデバッグログを追加
   - 検索結果のスコアと内容をサーバーログに出力

#### 環境変数（.env.local）
```
# OpenAI
OPENAI_API_KEY=...  # text-embedding-3-small を使用（1536次元）

# ベクタバックエンド切替
VECTOR_BACKEND=qdrant  # または削除してローカルJSON使用

# Qdrant（マネージド推奨）
QDRANT_URL=...
QDRANT_API_KEY=...
QDRANT_COLLECTION=materials_passages
```

#### コマンド
```
npm run build:index          # HTMLからインデックス生成（旧）
npm run build:index:text     # テキストファイルからインデックス生成（新・推奨）
npm run upload:qdrant        # JSONをQdrantへ一括アップサート
```

#### 実装メモ
- チャンク: 350文字（overlap 100文字）
- 正規化: 小文字化・空白縮約・ハイフン結合、15種類のエイリアス展開
- 検索: コサイン類似度 + MMR(λ=0.7, k=6) + スコア閾値0.7
- フォールバック: Qdrant不可時はローカルJSON検索

---

## 最近の重要な変更（2025-08-12）

### 教材ビューア＆ハイライト機能の完全リビルド
不完全だった教材ビューアとハイライト機能を完全に再設計・実装しました：

#### 実装された機能：
1. **セキュアなAIキーワード抽出**
   - Gemini APIキーを環境変数へ移行（セキュリティ修正）
   - 問題文からキーワードを自動抽出
   - 教材内でのキーワード自動ハイライト

2. **マルチフォーマット教材ビューア**
   - PDF表示（react-pdf使用）
   - HTML表示（DOMPurify使用でXSS対策）
   - テキスト表示
   - ページネーション機能

3. **ハイライト機能**
   - テキスト選択で4色ハイライト作成（黄・緑・赤・青）
   - ノート追加機能
   - LocalStorageによる永続化
   - ハイライト一覧ページ（/highlights）
   - 統計情報表示

4. **学習連携機能**
   - 問題演習から教材へのジャンプ
   - キーワードの自動検索・ハイライト
   - ナビゲーション状態の保持

#### 削除・簡素化された部分：
- Vercel KV依存の削除（ローカル開発可能に）
- Shadow DOM実装の削除（過度に複雑）
- unique-selector依存の削除
- 不要なFirestore同期コードの削除

#### 次の推奨作業：
- Gemini APIキーを`.env.local`に設定：`NEXT_PUBLIC_GEMINI_API_KEY=your-api-key`
- `npm run dev`で動作確認

## 過去の重要な変更（2025-06-28）

### 1. コード重複削減リファクタリング完了
`similarity-ts`を使用してコード重複を分析し、以下の改善を実施：

1. **3Dビルディング作成の抽象化** - `utils/3d-building-factory.ts`
   - Factory Patternを使用して70%の重複削減
   - THREE.jsのビルディング作成ロジックを統一

2. **データマージ処理の統一化** - `utils/data-merge-utils.ts`
   - DataMergerクラスで進捗・カテゴリ・セッションのマージ処理を共通化
   - コンフリクト解決戦略の一元化

3. **バリデーション処理の共通化**
   - `utils/validation-utils.ts` - 汎用バリデーションユーティリティ
   - `utils/type-guards.ts` - 型ガード関数の集約

4. **ストレージ操作の統一化** - `services/storage-service.ts`
   - キャッシュ機能とエラーハンドリングを備えた統一ストレージサービス

5. **その他の共通化**
   - `utils/question-filters.ts` - 質問フィルタリング処理
   - `utils/formatters.ts` - 時間・日付・パーセンテージのフォーマット処理

### 2. MaterialViewer 機能完全実装
教材ビューア機能の統合と強化を完了：

#### Phase 1: HighlightManager統合
- `app/materials/page.tsx`にHighlightManagerコンポーネントを統合
- PDFとHTMLビューの両方でハイライト機能を有効化
- `unique-selector`パッケージの型エラーを`@ts-ignore`と`require`で解決

#### Phase 2: 統合MaterialViewerコンポーネント作成
- `components/MaterialViewer/index.tsx`を新規作成
- PDF/HTML/Textの全レンダラーを統合した再利用可能なコンポーネント
- 既存のレンダラーコンポーネントの再エクスポート対応

#### Phase 3: Firestore統合実装
- `services/data/highlight.service.ts`にFirestore保存・取得・削除機能を実装
- リアルタイム同期機能（onSnapshot）の実装
- バージョンベースのコンフリクト解決機能
- オフライン時のLocalStorageフォールバック

#### Phase 4: E2Eテスト認証フロー修正
- Cypressコマンドの更新（Firebase認証対応）
- 適切なセレクタ（IDベース）への変更
- `package.json`にE2Eテストスクリプト追加（`test:e2e`, `test:e2e:ci`）

#### 実装した主要機能（詳細）

1. **Contextual Anchoringモデル**
   - `unique-selector`パッケージを使用した堅牢なCSS選択子生成
   - テキストコンテキストベースのフォールバック検索
   - 自己修復機能（ハイライト位置の自動更新）
   - データ構造: `HighlightAnchor`インターフェースを更新

2. **高度な検索機能**
   - Shadow DOM内でのリアルタイム検索ハイライト
   - 検索結果のナビゲーション（前/次）機能
   - 検索結果カウンター表示

3. **レスポンシブPDFビューア**
   - 動的なページサイズ計算
   - react-windowによる仮想スクロール
   - エラーハンドリングとローディング状態

4. **セキュリティ強化**
   - `isomorphic-dompurify`によるXSS対策
   - Shadow DOMによるスタイル隔離

5. **パフォーマンス最適化**
   - 全MaterialViewerコンポーネントにReact.memo適用
   - useMemoによる高価な計算の最適化

6. **エラーハンドリング**
   - ErrorBoundaryコンポーネントの実装
   - ユーザーフレンドリーなエラーメッセージ

#### 技術的詳細

**更新されたデータモデル:**
```typescript
export interface HighlightAnchor {
  selector: string;        // CSS選択子
  startOffset: number;     // テキスト開始位置
  endOffset: number;       // テキスト終了位置
  selectedText: string;    // 選択されたテキスト
  beforeText: string;      // 前方コンテキスト
  afterText: string;       // 後方コンテキスト
  pageNumber: number;      // ページ番号（PDF用）
}
```

**新しいサービスメソッド:**
- `HighlightService.updateAnchor()` - 自己修復用
- `HighlightService.saveNote()` - ノート保存
- `HighlightService.deleteNote()` - ノート削除

#### コンポーネント構成
```
components/MaterialViewer/
├── ErrorBoundary.tsx    # エラーハンドリング
├── HighlightLayer.tsx   # ハイライト表示層（自己修復機能付き）
├── HtmlRenderer.tsx     # HTMLコンテンツ表示（検索機能付き）
├── NoteEditor.tsx       # ノート編集
├── PdfRenderer.tsx      # PDF表示（レスポンシブ対応）
└── TableOfContents.tsx  # 目次表示
```

#### ビルドコマンド
```bash
npm run build      # ビルド実行
npm run dev        # 開発サーバー起動
npm run test       # Vitestテスト実行
npm run test:e2e   # Cypress E2Eテスト（UI）
npm run test:e2e:ci # Cypress E2Eテスト（ヘッドレス）
```

#### 環境変数
- Firebase設定（.env.local）
- Gemini API キー
- Vercel KV設定（使用する場合）

#### E2Eテスト
Cypressカスタムコマンドを実装:
- `cy.login(email, password)` - ログイン
- `cy.visitMaterial(filename)` - 教材表示
- `cy.createHighlight(text, color)` - ハイライト作成

#### 現在の状態（2025-06-28 時点）
- ✅ HighlightManager統合完了
- ✅ 統合MaterialViewerコンポーネント作成完了
- ✅ Firestore統合実装完了（リアルタイム同期含む）
- ✅ E2Eテスト認証フロー修正完了
- ✅ ビルド成功確認済み

#### 未解決の課題
1. **セキュリティ問題** - APIキーのハードコーディング（`app/api/extract-keywords/route.ts`）
   - Gemini APIキーが直接コードに記載されている
   - 環境変数への移行が必要

2. **Firestore セキュリティルール**
   - 現在はデフォルトルールの可能性
   - 認証ユーザーのみアクセス可能なルールへの更新推奨

#### 次回起動時の推奨作業
1. 開発サーバー起動: `npm run dev`
2. ハイライト機能の動作確認
3. APIキーの環境変数移行
4. Firebaseコンソールでセキュリティルール設定
5. E2Eテストの実行: `npm run test:e2e:ci`

詳細な実装状況は以下のドキュメントを参照：
- `MATERIAL_VIEWER_REFACTOR_PLAN.md` - リファクタリング計画
- `CODE_DUPLICATION_REFACTORING_PLAN.md` - コード重複削減計画
- `HIGHLIGHT_DATA_MODEL.md` - ハイライトデータモデル仕様