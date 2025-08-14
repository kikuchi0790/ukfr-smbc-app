# 🎓 UKFR Learning App - 英国金融規制試験対策アプリケーション

<div align="center">
  
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.8-orange?logo=firebase)](https://firebase.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5-green?logo=openai)](https://openai.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel)](https://vercel.com/)

**CISI UK Financial Regulation (ED31) 試験対策のための包括的学習プラットフォーム**

日本人銀行員向けに最適化された、英国金融規制試験の合格を支援する最先端の学習アプリケーション

</div>

---

## 📋 目次

- [✨ 主要機能](#-主要機能)
- [🚀 クイックスタート](#-クイックスタート)
- [📱 使い方](#-使い方)
- [🏗️ アーキテクチャ](#️-アーキテクチャ)
- [🛠️ 技術スタック](#️-技術スタック)
- [⌨️ キーボードショートカット](#️-キーボードショートカット)
- [🔧 環境変数](#-環境変数)
- [📊 データ管理](#-データ管理)
- [🚢 デプロイ](#-デプロイ)
- [📝 最近の改善](#-最近の改善2025年8月)
- [🐛 トラブルシューティング](#-トラブルシューティング)
- [🗺️ ロードマップ](#️-ロードマップ)
- [🤝 コントリビューション](#-コントリビューション)

---

## ✨ 主要機能

### 🎯 学習システム

#### **カテゴリ別学習**
- 11カテゴリ・836問の充実したコンテンツ
- 各カテゴリから10問をランダムまたは順番に出題
- 過去の間違いを自動的に混入（最大3問）
- 日本語翻訳付きで英語が苦手でも安心

#### **Mock試験モード**
- **75問モード**: 本番形式（90分制限）
- **25問モード**: Part別学習（各30分）
  - Part 1: 問題 1-25
  - Part 2: 問題 26-50  
  - Part 3: 問題 51-75
- Part別進捗管理機能（2025年8月実装）
- タイマー付きリアルタイム進捗表示
- 日本語表示ON/OFF切り替え可能

#### **復習モード**
- 間違えた問題を自動的に記録・管理
- カテゴリ学習とMock試験の間違いを分離管理
- 間違えた回数が多い問題を優先的に出題
- 正解した問題は「克服」フォルダへ自動移動

### 🤖 AI連携機能（RAG）

#### **GPT-5搭載RAGシステム**（2025年8月大幅改善）
- OpenAI Embeddings（text-embedding-3-small）によるベクトル検索
- Qdrant/ローカルJSON切り替え可能
- 699チャンクの高精度インデックス（350文字/チャンク）
- MMR（Maximal Marginal Relevance）による多様性確保
- GPT-5によるChain-of-Thought推論とリランキング

#### **教材連携**
- 問題から関連教材へワンクリックでジャンプ
- 該当ページ・該当箇所を自動的にハイライト
- キーワード自動抽出と検索
- 24時間キャッシュによる高速レスポンス

### 📚 教材機能

#### **マルチフォーマットビューア**
- PDF表示（react-pdf使用）
- HTML表示（DOMPurify使用でXSS対策）
- ページネーション・ズーム機能
- Shadow DOM実装による安全な描画

#### **ハイライト機能**
- 4色マーカー（黄・緑・赤・青）
- ノート追加機能
- LocalStorage永続化
- ハイライト一覧ページで統合管理
- Contextual Anchoringによる堅牢な位置記憶

### 📊 進捗管理

#### **ダッシュボード**
- カテゴリ別・Mock試験別の進捗を一覧表示
- 3D Wire Art建物による視覚的進捗表示
- リアルタイム正答率・合格可能性診断
- 連続学習日数（ストリーク）管理
- Firebase/ローカル同期ステータス表示

#### **データ同期**
- Firebase Firestoreによるクラウド同期
- オフライン時は自動的にローカルストレージ使用
- Single Source of Truth実装（2025年8月）
- 自動データ修復ツール

### ♿ アクセシビリティ（2025年8月実装）

#### **キーボードナビゲーション**
- **選択肢選択**: 1-4, A-D キー
- **アクション**: Enter（送信）, Space（選択）
- **ナビゲーション**: 矢印キー, P/N（前後）
- **機能**: J（日本語切替）, M（教材確認）, ?（ヘルプ）
- **終了**: Escape

#### **スクリーンリーダー対応**
- 完全なARIA属性実装
- 状態変更の音声アナウンス
- セマンティックHTML（main, section, nav等）
- 進捗バーのアクセシビリティ属性

---

## 🚀 クイックスタート

### 前提条件
- Node.js 18以上
- npm または yarn
- （オプション）Firebase プロジェクト
- （オプション）OpenAI API キー

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-username/ukfr-smbc-app.git
cd ukfr-smbc-app

# 依存関係のインストール
npm install

# 環境変数の設定（.env.localファイルを作成）
cp .env.example .env.local
# .env.localを編集して必要なAPIキーを設定

# 開発サーバーの起動
npm run dev
```

ブラウザで http://localhost:3000 を開いてアクセス

---

## 📱 使い方

### 1. ログイン
- Firebase認証（Google/メール）
- ニックネーム設定で進捗を分離管理

### 2. 学習モード選択
- **カテゴリ学習**: 特定分野を集中学習
- **Mock試験**: 本番形式で実力確認
- **復習モード**: 弱点克服

### 3. 問題演習
- 選択肢をクリックまたはキーボードで選択
- 回答後に詳細な解説を表示
- 「教材で詳しく確認」で関連箇所へジャンプ

### 4. 進捗確認
- ダッシュボードで全体進捗を確認
- カテゴリ別・Mock試験別の詳細統計
- 3D Wire Art建物で視覚的に把握

---

## 🏗️ アーキテクチャ

### ディレクトリ構造

```
ukfr-smbc-app/
├── app/                     # Next.js App Router
│   ├── api/                # APIルート
│   │   ├── retrieve/       # RAG検索エンドポイント
│   │   ├── rerank/         # GPT-5リランキング
│   │   └── extract-keywords/ # キーワード抽出
│   ├── dashboard/          # ダッシュボード
│   ├── study/              # 学習セッション
│   │   ├── session/        # 問題演習画面
│   │   ├── mock-result/    # Mock試験結果
│   │   └── complete/       # 完了画面
│   └── materials/          # 教材ビューア
├── components/             # Reactコンポーネント
│   ├── MaterialViewer/     # 教材表示コンポーネント群
│   ├── WireframeBuildings3D/ # 3D進捗表示
│   └── KeyboardHelpModal/  # キーボードヘルプ
├── services/               # サービス層
│   ├── data/              # データアクセス層
│   ├── vector-client/      # ベクトル検索クライアント
│   └── firebase-sync/      # Firebase同期
├── utils/                  # ユーティリティ関数
│   ├── study-utils/        # 学習関連ユーティリティ
│   ├── progress-tracker/   # 進捗管理
│   └── session-persistence/ # セッション永続化
├── hooks/                  # カスタムフック
│   ├── useKeyboardNavigation/ # キーボード操作
│   └── useErrorHandler/    # エラーハンドリング
├── scripts/                # ビルド・管理スクリプト
│   ├── build-material-index/ # RAGインデックス構築
│   └── upload-to-qdrant/   # Qdrantアップロード
└── docs/                   # ドキュメント
```

### データフロー

```
[ユーザー入力]
    ↓
[Next.js Frontend]
    ↓
[API Routes / Server Actions]
    ↓
[Services層]
    ├→ [Firebase Firestore] (認証済みユーザー)
    ├→ [LocalStorage] (オフライン/未認証)
    └→ [RAG System]
        ├→ [OpenAI Embeddings]
        └→ [Qdrant/Local Vector DB]
```

---

## 🛠️ 技術スタック

### フロントエンド
- **Next.js 15.3** - App Router, Server Components
- **React 19** - 最新のReact機能
- **TypeScript 5** - 型安全性
- **Tailwind CSS 4** - ユーティリティファーストCSS
- **Three.js** - 3Dグラフィックス

### バックエンド・インフラ
- **Firebase 11.8**
  - Authentication（Google/メール認証）
  - Firestore（データ永続化）
- **Vercel** - ホスティング・自動デプロイ

### AI・機械学習
- **OpenAI GPT-5** - リランキング・推論
- **OpenAI Embeddings** - text-embedding-3-small
- **Qdrant** - ベクトルデータベース（オプション）

### 主要ライブラリ
```json
{
  "react-pdf": "^9.2.1",        // PDF表示
  "react-window": "^1.8.11",    // 仮想スクロール
  "framer-motion": "^12.15.0",  // アニメーション
  "lucide-react": "^0.511.0",   // アイコン
  "recharts": "^2.15.3",        // グラフ表示
  "isomorphic-dompurify": "^2.25.0", // XSS対策
  "@qdrant/js-client-rest": "^1.10.0" // ベクトルDB
}
```

---

## ⌨️ キーボードショートカット

### 選択肢選択
- `1` or `A` - 選択肢A
- `2` or `B` - 選択肢B
- `3` or `C` - 選択肢C
- `4` or `D` - 選択肢D

### アクション
- `Enter` or `Space` - 回答送信/次へ
- `←` or `P` - 前の問題
- `→` or `N` - 次の問題

### 機能
- `J` - 日本語表示切替
- `M` - 教材で確認（解説表示時）
- `?` - キーボードヘルプ
- `Esc` - 学習セッション終了

---

## 🔧 環境変数

`.env.local`ファイルに以下を設定：

```bash
# Firebase設定（必須）
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# OpenAI設定（RAG機能に必須）
OPENAI_API_KEY=your_openai_api_key

# Qdrant設定（オプション - 未設定時はローカルJSON使用）
VECTOR_BACKEND=qdrant
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=materials_passages
```

---

## 📊 データ管理

### RAGインデックス構築

```bash
# テキストファイルからインデックス生成（推奨）
npm run build:index:text

# Qdrantへアップロード（VECTOR_BACKEND=qdrant使用時）
npm run upload:qdrant

# インデックス検証
npm run validate:index

# RAG精度テスト
npm run test:rag:comprehensive
```

### データ修復・管理

```bash
# ブラウザコンソールで実行
repairMyProgress()        # 自分の進捗を修復
repairAllProgress()       # 全ユーザーの進捗を修復
progressReport()          # 進捗レポート表示
storageCleanup()         # 不要データ削除
```

### バックアップ

LocalStorageデータは自動的にバックアップされます：
- セッション開始時
- 重要な操作前
- 手動実行: `createBackup()`（コンソール）

---

## 🚢 デプロイ

### Vercel（推奨）

1. GitHubリポジトリをフォーク/クローン
2. [Vercel](https://vercel.com)でプロジェクト作成
3. GitHubリポジトリを接続
4. 環境変数を設定
5. デプロイ実行

```bash
# Vercel CLIを使用
npm i -g vercel
vercel
```

### その他のプラットフォーム

```bash
# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm start
```

Docker対応：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📝 最近の改善（2025年8月）

### RAGシステムの全面改善
- **GPT-5導入**: 最高レベルの推論能力
- **インデックス再構築**: 699チャンク（4.2倍増加）
- **Chain-of-Thought推論**: 段階的な関連性評価
- **ハイブリッド検索**: ベクトル＋キーワード検索
- **精度向上**: 日英クロスリンガル対応強化

### データ管理の改善
- **Single Source of Truth実装**: StudySessionsを唯一の真実の源に
- **重複カウント問題解決**: 進捗データの整合性確保
- **自動修復ツール**: データ不整合を自動検出・修正
- **Part別進捗管理**: Mock試験25問モードの詳細管理

### UX/アクセシビリティ
- **完全キーボード操作**: すべての機能をキーボードで操作可能
- **スクリーンリーダー対応**: ARIA属性完全実装
- **視覚的フィードバック**: 選択状態の明確な表示
- **セッション永続化強化**: 10秒ごとの自動保存

詳細は以下のドキュメント参照：
- `/docs/RECENT_FIXES_2025_08_13.md`
- `/docs/rag-improvements-2025-08-13.md`
- `/CLAUDE.md`

---

## 🐛 トラブルシューティング

### よくある問題

#### Firebase権限エラー
```
Error: Missing or insufficient permissions
```
**解決策**: 自動的にLocalStorageにフォールバック。機能は継続使用可能。

#### PDF表示エラー
```
Error: No "GlobalWorkerOptions.workerSrc" specified
```
**解決策**: ページをリロード。自動的にWorkerが初期化されます。

#### RAG検索が遅い
**解決策**: 
- 初回は時間がかかります（キャッシュ構築）
- 2回目以降は高速化（24時間キャッシュ）
- Qdrant使用を検討

#### 進捗データ不整合
**解決策**: コンソールで`repairMyProgress()`実行

### デバッグモード

URLに`?debug=true`を追加してアクセス：
- 詳細なログ出力
- データ整合性レポート表示
- ストレージ使用状況確認

---

## 🗺️ ロードマップ

### 実装済み ✅
- [x] RAG検索機能（GPT-5対応）
- [x] ハイライト・ノート機能
- [x] キーボードナビゲーション
- [x] スクリーンリーダー対応
- [x] Part別Mock試験進捗
- [x] セッション永続化

### 開発中 🚧
- [ ] PWA対応（オフライン完全対応）
- [ ] 音声読み上げ機能
- [ ] 学習履歴エクスポート（CSV/PDF）
- [ ] AI学習提案機能

### 計画中 📋
- [ ] モバイルアプリ（React Native）
- [ ] 複数言語対応（中国語・韓国語）
- [ ] コラボレーション機能（ハイライト共有）
- [ ] AIチューター機能
- [ ] 模擬面接練習

---

## 🤝 コントリビューション

貢献を歓迎します！

### 開発参加方法

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

### 開発ガイドライン

- TypeScriptの型定義を厳密に
- テストを書く（Vitest/Cypress）
- コミットメッセージは[Conventional Commits](https://www.conventionalcommits.org/)に従う
- PRテンプレートに従って記載

### 特に歓迎する貢献

- 🇯🇵 日本語翻訳の改善
- 🎨 UI/UXの向上
- 🐛 バグ修正
- 📝 ドキュメントの改善
- ♿ アクセシビリティの向上

---

## 📄 ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照

---

## 🙏 謝辞

- CISI様 - 教材提供
- OpenAI様 - AI技術提供
- Vercel様 - ホスティング提供
- すべてのコントリビューター

---

## 📞 サポート

- 📧 Email: support@ukfr-app.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/ukfr-smbc-app/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/ukfr-smbc-app/discussions)

---

<div align="center">

**Made with ❤️ for Japanese Bankers**

**確実な合格を目指して、一緒に頑張りましょう！** 🎓✨

</div>