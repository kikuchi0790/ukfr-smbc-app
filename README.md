# 🎓 UK Financial Regulation 学習支援アプリ v2.0

日本人銀行員向けのCISI UK Financial Regulation (ED31) 試験対策アプリケーション

## 📋 プロジェクト概要

このドキュメントは、他のAIや開発者がプロジェクトの構造と実装を理解できるように、詳細な技術情報を含んでいます。

## 🏗️ プロジェクト構造

```
ukfr-smbc-app/
├── app/                          # Next.js App Router
│   ├── ... (same as before)
│
├── components/
│   ├── MaterialViewer/          # Refactored material viewer components
│   │   ├── PdfRenderer.tsx
│   │   ├── HtmlRenderer.tsx
│   │   ├── TableOfContents.tsx
│   │   ├── HighlightLayer.tsx
│   │   └── NoteEditor.tsx
│   └── ... (other components)
│
├── services/
│   ├── data/                    # New data abstraction layer
│   │   └── highlight.service.ts
│   └── ... (other services)
│
├── utils/
│   ├── device-utils.ts          # New utility for getting device ID
│   └── ... (other utils)
│
├── cypress/
│   ├── e2e/
│   │   └── study-flow.cy.ts     # New E2E test for the study flow
│   └── ... (other cypress files)
│
├── vitest.config.ts             # Vitest configuration
├── vitest.setup.ts              # Vitest setup file
├── HIGHLIGHT_DATA_MODEL.md      # Documentation for the new highlight data model
├── CONFLICT_RESOLUTION_STRATEGY.md # Documentation for the data sync strategy
└── ... (other files)
```

## 🏛️ 新しいアーキテクチャ (v2.0)

このプロジェクトは、保守性と拡張性を向上させるために、v2.0で大幅なリファクタリングが行われました。

### データ永続化層の抽象化

*   **`services/data`**: データ操作ロジックをコンポーネントから分離するための新しいディレクトリです。
*   **`HighlightService`**: ハイライトに関するすべてのCRUD操作（作成、読み取り、更新、削除）を担当します。このサービスは、FirestoreとLocalStorageの両方への書き込みを抽象化し、オフラインファーストの体験を提供します。

### 新しいデータモデル

*   **`HIGHLIGHT_DATA_MODEL.md`**: ハイライトの新しいデータモデルに関する詳細なドキュメントです。不安定なオフセットベースのハイライトを廃止し、CSSセレクタとテキストコンテキストを組み合わせた、より堅牢なアンカーモデルを導入しました。
*   **`CONFLICT_RESOLUTION_STRATEGY.md`**: 複数のデバイス間でのデータ同期と競合解決のための新しい戦略に関するドキュメントです。

### コンポーネントの再設計

*   **`components/MaterialViewer`**: 教材ビューアに関連するすべてのコンポーネントを格納する新しいディレクトリです。
*   **`PdfRenderer`**: `react-pdf`と`react-window`を使用して、PDFのレンダリングと仮想化を担当します。
*   **`HtmlRenderer`**: Shadow DOMを使用して、HTMLコンテンツを安全にレンダリングします。
*   **`TableOfContents`**: 教材のメタデータをフェッチして、目次を表示します。
*   **`HighlightLayer`**: 新しいアンカーモデルを使用して、ハイライトをコンテンツの上にレンダリングします。
*   **`NoteEditor`**: ハイライトにノートを追加・編集するためのUIを提供します。

### テスト

*   **`vitest`**: ユニットテストとコンポーネントテストのために導入されました。
*   **`@testing-library/react`**: コンポーネントのテストに使用されます。
*   **`cypress`**: E2Eテストに使用されます。



### ダークモード実装
アプリ全体でダークモードを採用しており、以下の配色を使用：

- **背景色**: 
  - メイン: `bg-gray-900`
  - カード: `bg-gray-800`
  - ホバー: `bg-gray-700`
- **テキスト色**:
  - 主要: `text-gray-100`
  - 補助: `text-gray-400`
  - 無効: `text-gray-500`
- **ボーダー**: `border-gray-700`
- **アクセント色**:
  - プライマリ: `bg-indigo-600`, `text-indigo-500`
  - 成功: `bg-green-600`, `text-green-400`
  - エラー: `bg-red-600`, `text-red-400`

### Wire Art 3D背景
`BackgroundBuildings`コンポーネントで実装された3D背景：
- **建物の色**: `#FFD4A3` (温かい街灯色)
- **透明度**: 全体50% × 建物70% = 実効35%
- **表示レベル**: 25%完成度（level0のみ）
- **アニメーション**: Y軸回転（0.003ラジアン/フレーム）
- **ライティング**: 夜景をイメージした暖色系

## 🚀 主な特徴

### 📱 新しい学習システム
- **カテゴリ別学習**: 各カテゴリから10問ランダム出題
- **Mock試験モード**: 25問(30分)または75問(90分)の実践形式
- **間違えた問題の自動管理**: 復習モードで重点的に学習
- **日英対訳表示**: 英語が苦手でも安心の日本語翻訳付き
- **AI連携教材確認**: 問題から関連教材へ直接アクセス（v2.2.0 新機能）
- **ハイライト機能**: 教材の重要箇所をマーキング（v2.2.0 新機能）

### 📊 11カテゴリ・836問の充実コンテンツ
1. **The Regulatory Environment** (42問)
2. **The Financial Services and Markets Act 2000 and Financial Services Act 2012** (99問)
3. **Associated Legislation and Regulation** (100問)
4. **The FCA Conduct of Business Sourcebook/Client Assets** (125問)
5. **Complaints and Redress** (32問)
6. **Regulations: Mock 1-5** (各75問)
7. **Regulations: Final Study Questions** (62問)

### 🎯 効果的な学習機能
- **10問単位の学習**: 集中力を保ちながら効率的に学習
- **間違えた問題の自動混入**: 新しい問題と過去の間違いを組み合わせて出題
- **Mock試験タイマー**: 本番同様の時間制限で実力をチェック
- **Mock 25問試験のパート分割**: 25問試験を3つのパート（Part 1, 2, 3）に分割して受験可能
- **日本語ON/OFF切り替え**: 学習段階に応じて表示を調整
- **教材ビューア**: PDFとHTML教材の並列表示（v2.2.0 強化）
- **iPadフレンドリー検索**: タッチデバイスでも快適な検索機能（v2.2.0 新機能）

### 🔗 v2.2.0 AI連携学習機能
- **問題→教材の自動連携**: AIが問題から重要キーワードを抽出し、関連教材へ自動ナビゲート
- **ハイライト機能**: 重要箇所を4色（黄・緑・赤・青）でマーキング
- **ノート機能**: ハイライトにメモを追加
- **クラウド同期**: FirebaseでハイライトをリアルタイムSync
- **ハイライト一覧**: 保存したハイライトを一元管理

## 🚀 Vercelへのデプロイ方法

### 方法1: Vercel CLIを使用

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# プロジェクトディレクトリで実行
vercel
```

### 方法2: GitHubリポジトリから

1. このプロジェクトをGitHubにプッシュ
2. [Vercel](https://vercel.com)でアカウントを作成
3. "New Project"をクリック
4. GitHubリポジトリをインポート
5. 環境変数は自動的に設定されます（vercel.jsonに記載済み）

## 🛠 ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 📱 使い方

### 1. カテゴリ別学習
- 学習したいカテゴリを選択
- 10問がランダムに出題（過去の間違いも混入）
- 日本語翻訳を見ながら学習
- 10問終了後に結果を確認

### 2. Mock試験
- 25問または75問モードを選択
- Mock 1-5から選んで実施
- 25問モードでは3つのパート（Part 1, 2, 3）から選択可能
  - Part 1: 問題1〜25
  - Part 2: 問題26〜50
  - Part 3: 問題51〜75
- タイマー付きの本番形式（25問30分、75問90分）
- 日本語表示はON/OFF可能

### 3. 復習モード
- 過去に間違えた問題から10問出題
- 間違えた回数が多い問題を優先
- 弱点を集中的に克服

## 🧠 学習効果を高める工夫

### スマート出題システム
- カテゴリ学習では、新規問題7問 + 過去の間違い最大3問を混ぜて出題
- 間違えた問題は自動的に記録され、復習時に優先出題
- 学習履歴に基づいて最適な問題を選択

### 日本語サポート
- 問題文・選択肢・解説すべてに日本語翻訳
- 学習モードでは常時表示、Mock試験では選択可能
- 専門用語の理解を助ける丁寧な翻訳

## 🛠 技術スタック

### フレームワーク・ライブラリ
- **Next.js 14**: App Router使用、SSR対応
- **React 18**: クライアントコンポーネント中心
- **TypeScript**: 厳密な型定義
- **Tailwind CSS**: レスポンシブデザイン、ダークモード
- **Three.js + @react-three/fiber**: 3Dグラフィックス
- **パスコード認証**: シンプルな内部利用向け認証
- **Lucide React**: アイコンライブラリ

### 主要な依存関係
```json
{
  "@types/d3": "^7.4.3",
  "@types/three": "^0.176.0",
  "d3": "^7.9.0",
  "date-fns": "^4.1.0",
  "firebase": "^11.8.1",
  "framer-motion": "^12.15.0",
  "lucide-react": "^0.511.0",
  "next": "15.3.3",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "recharts": "^2.15.3",
  "three": "^0.177.0"
}
```

## 📊 進捗管理

- **ダッシュボード**: カテゴリ別・Mock別の進捗を一覧表示
- **正答率追跡**: リアルタイムで合格可能性を診断
- **連続学習日数**: モチベーション維持のためのストリーク機能
- **間違えた問題数**: 復習が必要な問題数を常に表示

## 📊 データ構造

### 主要な型定義（types/index.ts）

```typescript
// カテゴリ定義
type Category = 
  | "The Regulatory Environment"
  | "The Financial Services and Markets Act 2000 and Financial Services Act 2012"
  | "Associated Legislation and Regulation"
  | "The FCA Conduct of Business Sourcebook/Client Assets"
  | "Complaints and Redress"
  | "Regulations: Final Study Questions";

// 問題データ
interface Question {
  id: string;
  questionId: string;
  category: Category;
  question: string;
  questionJa?: string;
  options: {
    letter: string;
    text: string;
    textJa?: string;
  }[];
  correctAnswer: string;
  explanation: string;
  explanationJa?: string;
}

// ユーザー進捗
interface UserProgress {
  studySessions: StudySession[];
  categoryProgress: Record<Category, CategoryProgress>;
  incorrectQuestions: IncorrectQuestion[];
  overcomeQuestions: OvercomeQuestion[];
  totalStudyTime: number;
  lastStudyDate: string;
  studyStreak: number;
}
```

## 🔒 データ管理

### LocalStorage構造
- `userProgress`: ユーザーの学習進捗
- `userPreferences`: ユーザー設定（言語表示など）
- `lastSelectedMock`: 最後に選択したMock試験

### データ検証
`progress-validator.ts`で進捗データの整合性を保証：
- 不正なデータの自動修正
- カテゴリ間の整合性チェック
- 古いデータ形式の移行

## 🏗️ Wire Art進捗表示システム

### 建物と対応カテゴリ
1. 🕰️ **Big Ben** → The Regulatory Environment
2. 🗼 **Eiffel Tower** → Financial Services Acts
3. 🏛️ **Colosseum** → Associated Legislation
4. ⛪ **Sagrada Família** → FCA Conduct/Client Assets
5. 🌬️ **Dutch Windmill** → Complaints and Redress
6. 🚪 **Brandenburg Gate** → Final Study Questions

### 実装詳細
- **2D版** (`WireframeBuildings.tsx`): SVGベース、軽量
- **3D版** (`WireframeBuildings3D.tsx`): Three.js、インタラクティブ
- **背景版** (`BackgroundBuildings.tsx`): 装飾的な背景表示

各建物は5段階（level0〜level4）で構成され、学習進捗に応じて表示レベルが変化：
- 0%: 建物非表示
- 1-25%: level0のみ（基礎部分）
- 26-50%: level0-1
- 51-75%: level0-2
- 76-99%: level0-3
- 100%: 全レベル表示 + 輝きエフェクト

## 🔐 認証とルーティング

### 認証システム
- **Firebase Authentication**: Googleログインまたはメール/パスワード
- **ニックネーム管理**: ユーザーごとの進捗を分けて保存
- **ログイン後**: `/dashboard`へリダイレクト
- **保護されたルート**: `/dashboard`, `/study/*`, `/questions`, `/materials`
- **公開ルート**: `/`, `/login`
- **オフラインモード**: Firebase接続エラー時も基本機能は動作

## 🛠️ v2.2.0 技術実装詳細

### AI連携システム
- **Gemini API統合**: gemini-2.0-flash-liteモデルによる高速キーワード抽出
- **多層キャッシュ**: サーバー側メモリキャッシュ＋クライアント側LocalStorageキャッシュ
- **レート制限**: 1分10リクエストまでの制限でAPI使用量を最適化

### ハイライトシステム
- **テキスト選択検出**: Range APIによる正確な位置計算
- **オフセット管理**: startOffset/endOffsetによる永続的な位置保存
- **リアルタイム同期**: Firestore onSnapshotによる即時更新
- **ローカルフォールバック**: オフライン時もLocalStorageで動作継続

### セッション永続化システム
- **自動保存**: 30秒ごと、5問回答ごとの自動保存
- **ブラウザイベント対応**: beforeunload、visibilitychangeイベントのハンドリング
- **ストレージ最適化**: 問題IDのみ保存、容量監視、自動クリーンアップ
- **保存状態表示**: リアルタイムの保存状態インジケーター

詳細な実装ドキュメント:
- AI連携機能: `/docs/FEATURE_MATERIAL_INTEGRATION.md`
- バグ修正とセッション永続化: `/docs/BUG_FIXES_AND_SESSION_PERSISTENCE.md`
- トラブルシューティング: `/docs/TROUBLESHOOTING.md`
- 2024年12月修正履歴: `/docs/RECENT_FIXES_2024_12.md`

## 📝 今後の機能追加予定

- [x] AI連携教材確認機能（v2.2.0で実装済み）
- [x] ハイライト機能（v2.2.0で実装済み）
- [ ] 完全な日本語翻訳（現在は一部のみ）
- [ ] 学習履歴のエクスポート機能
- [ ] より詳細な弱点分析レポート
- [ ] 音声読み上げ機能
- [ ] PWA対応（オフライン学習）
- [ ] 学習リマインダー通知
- [ ] ハイライトの共有機能
- [ ] AI学習提案機能

## 🌐 既知の問題と対処法

### Firebase権限エラー
教材ビューでハイライト機能使用時に発生する場合があります。
- エラー時は自動的にローカルストレージにフォールバック
- 機能は継続して使用可能
- 詳細は`/docs/TROUBLESHOOTING.md`参照

### ネットワーク接続問題
- 広告ブロッカーがFirebaseをブロックする場合があります
- ネットワーク状態インジケーターで接続状態を確認可能

## 🤝 コントリビューション

改善提案やバグ報告は大歓迎です！
特に以下の点でご協力いただけると嬉しいです：

- 日本語翻訳の改善
- UI/UXの向上提案
- 新機能のアイデア
- Firebaseセキュリティルールの改善

## 📄 ライセンス

MIT

## 🚀 環境構築とデプロイ

### ローカル開発
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start
```

### 環境変数（.env.local）
```env
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini API設定
GEMINI_API_KEY=your_gemini_api_key
```

### Vercelデプロイ
1. GitHubリポジトリにプッシュ
2. Vercelでプロジェクトインポート
3. 環境変数設定（Firebase、Gemini API）
4. デプロイ実行

注意：
- Firebase設定がない場合も基本機能は動作します
- ハイライト機能はFirebaseが利用できない場合、ローカルストレージを使用します

## 📝 重要な実装詳細

### エラーハンドリング
- `useErrorHandler`フック: 統一的なエラー処理
- `ErrorBoundary`: Reactコンポーネントエラーのキャッチ
- `safeLocalStorage`: LocalStorageアクセスの安全なラッパー

### パフォーマンス最適化
- Dynamic Import: 3Dコンポーネントの遅延読み込み
- SSR無効化: Three.jsコンポーネントはクライアントのみ
- 画像最適化: Next.js Image使用

### アクセシビリティ
- キーボードナビゲーション対応
- ARIAラベル適切に設定
- コントラスト比WCAG AA準拠

---

**TOEICアプリのような使いやすさで、確実な合格を目指しましょう！** 🎓✨