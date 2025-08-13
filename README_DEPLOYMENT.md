# Deployment Guide for UKFR Learning App

## Prerequisites

1. Vercel account

## Environment Variables

You need to set the following environment variables in Vercel:

### Required Variables

```
# Server-only
GEMINI_API_KEY=<your-gemini-api-key>
OPENAI_API_KEY=<your-openai-api-key>

# Vector backend (optional)
VECTOR_BACKEND=qdrant
QDRANT_URL=<your-qdrant-url>
QDRANT_API_KEY=<your-qdrant-api-key>
QDRANT_COLLECTION=materials_passages

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=<...>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<...>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<...>
NEXT_PUBLIC_FIREBASE_APP_ID=<...>

# Legacy/internal
NEXT_PUBLIC_PASSCODE=<your-secure-passcode>
```

Note:
- Do not expose Gemini key on client. Use server-only `GEMINI_API_KEY`.
- Configure in Vercel Project Settings → Environment Variables, then redeploy.

## 認証システムについて

このアプリは内部利用向けのシンプルなパスコード認証を使用しています。

- ユーザーはパスコードとニックネームでログイン
- 各ユーザーの進捗はニックネームごとに分けて保存
- パスコードは環境変数で管理

## RAG Indexing in CI/CD

1. Build material index (only when materials updated)
   - `npm run build:index`
2. If using Qdrant, upload
   - `npm run upload:qdrant`

## Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Go to Project Settings → Environment Variables
3. Add all the required environment variables
4. Deploy the application

## Troubleshooting

### ログインできない
- パスコードが正しく設定されているか確認
- 環境変数NEXT_PUBLIC_PASSCODEが設定されているか確認

### Build errors
- Check that all TypeScript errors are resolved
- Ensure all dependencies are listed in package.json
- Verify environment variables are available during build

### パスコードの変更
- Vercelのダッシュボードから環境変数を更新
- 再デプロイして変更を適用