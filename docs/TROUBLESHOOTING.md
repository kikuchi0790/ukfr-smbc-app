# トラブルシューティングガイド

## 🔧 既知の問題と解決方法

### 1. Firebase権限エラー（Missing or insufficient permissions）

#### 症状
- 教材ビューでハイライト機能使用時に「リアルタイム同期エラー: FirebaseError: Missing or insufficient permissions」が表示される
- 「Firebase権限エラー。ローカルストレージを使用します。」のメッセージが表示される

#### 原因
1. **Firebaseセキュリティルールの設定不足**
   - Firestoreのセキュリティルールがユーザーのハイライトデータへのアクセスを許可していない
   - 認証されたユーザーのみが自分のデータにアクセスできるルールが必要

2. **Firebase認証の遅延**
   - Firebase認証が完了する前にFirestoreへのアクセスが試行される場合がある
   - ネットワーク遅延や広告ブロッカーによる接続問題

#### 解決方法

**1. Firebaseコンソールでセキュリティルールを更新:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のプロファイルデータにのみアクセス可能
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 認証されたユーザーは学習進捗データを読み書き可能
    match /progress/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**2. アプリ側の対応（実装済み）:**
- Firebase権限エラー時は自動的にローカルストレージにフォールバック
- ハイライト機能はオフラインでも動作継続
- オンライン復帰時に自動同期を試行

### 2. 問題読み込みの無限ループ

#### 症状
- 「問題を読み込んでいます...」が永続的に表示される
- コンソールに「Starting to load questions...」が繰り返し表示される

#### 原因
- useEffectの依存配列に不適切な値が含まれている
- Firebase認証のタイムアウト待ちで画面が表示されない

#### 解決方法（実装済み）
1. Firebase認証に10秒のタイムアウトを設定
2. useEffectの依存配列を最適化
3. 重複読み込み防止のフラグを追加

### 3. 教材ビューから戻る際のセッション喪失

#### 症状
- 教材ビューから戻ると「問題が見つかりませんでした」エラーが表示される
- カテゴリ情報が失われる

#### 原因
- 教材ビューへの遷移時にセッション情報が不完全に保存される
- 戻り先のURLパラメータが不足している

#### 解決方法（実装済み）
1. MaterialNavigationStateにセッション情報を完全に保存
2. 教材ビューへの遷移時に戻り先パラメータを含める
3. 戻るボタンで正しいパラメータを復元

## 🌐 ネットワーク関連の問題

### Firebase接続エラー

#### エラーメッセージ例
- `ERR_BLOCKED_BY_CLIENT` - 広告ブロッカーによるブロック
- `ERR_INTERNET_DISCONNECTED` - インターネット接続なし

#### 対処法
1. **広告ブロッカーの設定確認**
   - Firebase関連のドメインをホワイトリストに追加
   - 一時的に広告ブロッカーを無効化してテスト

2. **ネットワーク状態の確認**
   - インターネット接続を確認
   - ファイアウォール設定の確認

3. **アプリの対応**
   - ネットワーク状態インジケーターで接続状態を表示
   - オフラインモードで基本機能は継続動作

## 📱 デバイス固有の問題

### iPadでの検索機能

#### 症状
- ソフトウェアキーボードが表示されない
- 検索入力が困難

#### 解決方法（実装済み）
- タッチデバイス向けの検索UIを実装
- 自動フォーカスとキーボード表示の最適化

## 🔍 デバッグ方法

### コンソールログの確認
```javascript
// 以下のログを確認
console.log('Starting to load questions...', { mode, categoryParam, partParam });
console.log('Firebase authentication timeout - continuing in offline mode');
console.log('Firebase権限エラー。ローカルストレージを使用します。');
```

### LocalStorageの確認
```javascript
// ブラウザのコンソールで実行
localStorage.getItem('studySessionState')
localStorage.getItem('materialNavigationState')
localStorage.getItem('userHighlights')
```

### ネットワークタブの確認
1. 開発者ツールのNetworkタブを開く
2. Firebaseへのリクエストを確認
3. 失敗したリクエストの詳細を確認

## 📞 サポート

解決しない問題がある場合は、以下の情報と共に報告してください：

1. **エラーメッセージ**（コンソールログ）
2. **発生手順**
3. **ブラウザとOSの情報**
4. **ネットワーク環境**（社内ネットワーク、自宅など）
5. **使用している拡張機能**（特に広告ブロッカー）