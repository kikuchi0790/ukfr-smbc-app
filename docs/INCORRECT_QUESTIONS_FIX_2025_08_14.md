# Mock試験復習モード問題修正（2025年8月14日）

## 🐛 修正された問題

### 症状
- Mock試験で間違えた問題がダッシュボードでは表示される
- しかし復習モードでは出題されない
- ダッシュボードと復習モードの問題数が一致しない

### 根本原因
`saveIncorrectQuestion`関数の既存問題更新ロジックにバグがありました：

```typescript
// 修正前のコード（問題あり）
if (existingIndex >= 0) {
  progress.incorrectQuestions[existingIndex].incorrectCount++;
  progress.incorrectQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
  // ❌ sourceフィールドが更新されていない！
}
```

**問題のシナリオ:**
1. ユーザーがカテゴリ学習で問題Aを間違える → `source: 'category'`として保存
2. 後日、Mock試験で同じ問題Aを間違える → `incorrectCount`は増えるが、`source`は`'category'`のまま
3. Mock試験復習モードは`source: 'mock'`の問題のみを抽出 → 問題Aが表示されない

## ✅ 実装した修正

### 1. saveIncorrectQuestion関数の修正
```typescript
// 修正後のコード
if (existingIndex >= 0) {
  progress.incorrectQuestions[existingIndex].incorrectCount++;
  progress.incorrectQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
  
  // ⭐ sourceフィールドも更新（Mock試験が優先）
  if (source === 'mock' || progress.incorrectQuestions[existingIndex].source !== 'mock') {
    progress.incorrectQuestions[existingIndex].source = source;
    progress.incorrectQuestions[existingIndex].mockNumber = mockNumber;
  }
}
```

**修正のポイント:**
- Mock試験で間違えた場合は常に`source: 'mock'`に更新
- カテゴリ学習で間違えた場合、既存が`mock`でなければ更新
- Mock試験の間違いが優先される（より本番に近いため）

### 2. データ修復ツールの実装
既存ユーザーのデータを修復するツールを作成しました。

## 🛠️ 修復ツールの使い方

### ブラウザコンソールでの実行方法

1. **自分のデータを修復**
```javascript
repairMyIncorrectQuestions()
```
出力例:
```
修復完了レポート:
- 検査した間違い問題: 45問
- 修正した問題: 12問
- Mock試験の間違い: 18問
- 修復率: 27%
```

2. **現在の状態を確認**
```javascript
checkIncorrectQuestionsStatus()
```
出力例:
```
間違い問題の状態:
- カテゴリ学習: 27問
- Mock試験: 18問
- sourceなし: 0問
- 合計: 45問

Mock試験別内訳:
- Mock 1: 8問
- Mock 2: 6問
- Mock 3: 4問
```

3. **すべてのユーザーのデータを修復（管理者用）**
```javascript
repairAllIncorrectQuestions()
```

## 📊 修復ツールの動作

### 修復プロセス
1. **StudySessionsの走査**
   - すべての学習セッションを確認
   - Mock試験で間違えた問題を特定
   - 最新のMock試験結果を優先

2. **sourceフィールドの修正**
   - Mock試験で間違えた問題 → `source: 'mock'`に設定
   - Mock番号も正しく設定
   - カテゴリ学習のみの間違い → `source: 'category'`を維持

3. **データの保存**
   - 修正されたデータをLocalStorageに保存
   - バックアップは自動的に作成される

## 🧪 テスト方法

### テストスクリプトの実行
```javascript
// test-incorrect-questions-fix.js をブラウザコンソールで実行
```

このスクリプトは以下をテストします：
1. カテゴリで間違えた問題をMock試験で再度間違えた場合
2. sourceフィールドが正しく更新されるか
3. 復習モードで正しくカウントされるか

## 📈 期待される効果

### 修正前
- ダッシュボード: Mock試験の間違い 18問
- 復習モード: Mock試験の間違い 6問（不一致！）

### 修正後
- ダッシュボード: Mock試験の間違い 18問
- 復習モード: Mock試験の間違い 18問（一致！）

## 🔍 影響範囲

### 影響を受けるファイル
1. `utils/study-utils.ts` - saveIncorrectQuestion関数
2. `utils/incorrect-questions-repair.ts` - 新規作成（修復ツール）
3. `contexts/AuthContext.tsx` - 修復ツールのインポート追加

### 影響を受ける機能
- ✅ Mock試験の復習モード
- ✅ カテゴリ学習の復習モード
- ✅ ダッシュボードの統計表示
- ✅ 間違い問題の管理全般

## 📝 注意事項

1. **データのバックアップ**
   - 修復ツール実行前に自動的にバックアップが作成されます
   - 念のため、重要なデータは手動でもバックアップすることを推奨

2. **修復タイミング**
   - 新規ユーザー: 修正は自動的に適用されます
   - 既存ユーザー: 修復ツールを一度実行してください

3. **パフォーマンス**
   - 修復ツールは通常数秒で完了します
   - 大量のデータがある場合は少し時間がかかる可能性があります

## 🚀 今後の改善案

1. **自動修復機能**
   - アプリ起動時に自動的にデータ整合性をチェック
   - 必要に応じて自動修復

2. **データ検証の強化**
   - sourceフィールドの必須化
   - 保存時のバリデーション追加

3. **UI改善**
   - 修復ツールのUIボタン追加
   - 修復状況の可視化

## 📞 サポート

問題が解決しない場合は、以下の情報と共にサポートにお問い合わせください：
- `checkIncorrectQuestionsStatus()`の出力
- エラーメッセージ（ある場合）
- ブラウザのコンソールログ