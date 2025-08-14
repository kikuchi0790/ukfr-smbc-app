# Mock試験結果が見つからない問題の修正（2025年8月14日）

## 🐛 修正された問題

### 症状
Mock試験終了後、結果ページで以下のエラーが表示される：
```
Mock試験の結果が見つかりませんでした。

【デバッグ情報】
- ユーザー: Mitts (ID: 7jbg7VyTNfZEThf43yvZzzhBVAJ2)
- 検索したキー:
  1. tempMockResult_Mitts
  2. tempMockResult_7jbg7VyTNfZEThf43yvZzzhBVAJ2
  3. tempMockResult_latest
- Mock関連キー: mockExamHistory_Mitts
```

### 根本原因
`utils/storage-utils.ts`の`cleanupOldData`関数に重大なバグがありました：

```typescript
// 修正前のコード（バグあり）
if (key.startsWith('tempMockResult_') || key.startsWith('tempMockQuestions_')) {
  keysToDelete.push(key); // ❌ 時間チェックなしで無条件削除！
}
```

**問題の流れ:**
1. Mock試験終了時にデータを保存
2. LocalStorageの容量が5MBを超えている
3. `cleanupOldData()`が自動実行される
4. **保存したばかりのMock試験データが削除される**（バグ）
5. mock-resultページに遷移
6. データが見つからずエラー表示

## ✅ 実装した修正

### 1. cleanupOldData関数の修正（utils/storage-utils.ts）
```typescript
// 修正後のコード
if (key.startsWith('tempMockResult_') || key.startsWith('tempMockQuestions_')) {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = safeJsonParse(item, null) as any;
      if (parsed) {
        // タイムスタンプをチェック（複数の形式に対応）
        const timestamp = parsed.savedAt || 
                        parsed.session?.completedAt || 
                        parsed.session?.startedAt ||
                        parsed.completedAt ||
                        parsed.startedAt;
        
        if (timestamp) {
          const itemTime = new Date(timestamp).getTime();
          // 1時間以上前のデータのみ削除
          if (itemTime < oneHourAgo) {
            keysToDelete.push(key);
            console.log(`Scheduling deletion of old temp data: ${key} (age: ${Math.round((Date.now() - itemTime) / 1000 / 60)} minutes)`);
          }
        } else {
          // タイムスタンプがない古い形式のデータは削除
          keysToDelete.push(key);
        }
      }
    }
  } catch (error) {
    // パースできない壊れたデータは削除
    keysToDelete.push(key);
  }
}
```

### 2. Mock試験データ保存時のタイムスタンプ追加（app/study/session/page.tsx）
```typescript
const mockResult = {
  session: {
    ...session,
    answers,
    completedAt: new Date().toISOString(),
    mockPart: session.mockPart
  },
  questionIds: questions.map(q => q.questionId),
  userId: user.id,
  userNickname: user.nickname,
  savedAt: new Date().toISOString(), // ⭐ タイムスタンプを追加
  category: session.category,
  mode: session.mode
};

// 問題データも同様に
const questionsData = {
  questions,
  savedAt: new Date().toISOString() // ⭐ タイムスタンプを追加
};
```

### 3. データ読み込み時の後方互換性対応（app/study/mock-result/page.tsx）
```typescript
// 新形式（オブジェクト）と旧形式（配列）の両方に対応
let tempQuestions: Question[] | null = null;
if (tempQuestionsData) {
  if (Array.isArray(tempQuestionsData)) {
    // 旧形式：配列
    tempQuestions = tempQuestionsData;
  } else if (tempQuestionsData.questions) {
    // 新形式：オブジェクト with questions field
    tempQuestions = tempQuestionsData.questions;
  }
}
```

## 📊 修正の効果

### 修正前
- LocalStorage容量超過時、保存したばかりのMock試験データが削除される
- Mock試験終了直後に「結果が見つかりません」エラー

### 修正後
- 1時間以上前のデータのみ削除される
- 新しく保存したデータは保護される
- Mock試験結果が確実に表示される

## 🧪 テスト方法

### ブラウザコンソールでテスト
```javascript
// LocalStorageの状況確認
const checkMockData = () => {
  const keys = Object.keys(localStorage);
  const mockKeys = keys.filter(k => k.includes('tempMock'));
  
  mockKeys.forEach(key => {
    const data = JSON.parse(localStorage.getItem(key));
    const timestamp = data.savedAt || data.session?.completedAt || data.completedAt;
    if (timestamp) {
      const age = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
      console.log(`${key}: ${age}分前のデータ`);
    } else {
      console.log(`${key}: タイムスタンプなし（古い形式）`);
    }
  });
  
  console.log(`\n合計: ${mockKeys.length}個のMock試験一時データ`);
};

checkMockData();
```

### LocalStorage容量の確認
```javascript
// ストレージ使用状況を確認
const checkStorage = () => {
  const totalSize = Object.keys(localStorage).reduce((acc, key) => {
    return acc + new Blob([localStorage[key]]).size;
  }, 0);
  
  console.log(`LocalStorage使用量: ${(totalSize / 1024 / 1024).toFixed(2)}MB / 5MB`);
  console.log(`使用率: ${Math.round(totalSize / (5 * 1024 * 1024) * 100)}%`);
};

checkStorage();
```

## 🔍 影響範囲

### 影響を受けるファイル
1. `utils/storage-utils.ts` - cleanupOldData関数
2. `app/study/session/page.tsx` - Mock試験データ保存処理
3. `app/study/mock-result/page.tsx` - Mock試験結果読み込み処理

### 影響を受ける機能
- ✅ Mock試験結果の表示
- ✅ LocalStorageの自動クリーンアップ
- ✅ データ容量管理

## 📝 注意事項

1. **後方互換性**
   - 旧形式のデータ（タイムスタンプなし）も読み込み可能
   - 旧形式のデータはクリーンアップ時に削除される

2. **ストレージ管理**
   - 1時間以上前の一時データは自動削除
   - 5MB制限に近づいた場合のみクリーンアップ実行

3. **デバッグ**
   - 削除される各データのログが出力される
   - データの年齢（経過時間）も記録される

## 🚀 今後の改善案

1. **クリーンアップ設定の柔軟化**
   - 削除までの時間を設定可能に
   - データ種別ごとに異なる保持期間を設定

2. **ユーザー通知**
   - 容量不足時にユーザーに通知
   - 手動クリーンアップボタンの追加

3. **データ圧縮**
   - 大きなデータの圧縮保存
   - より効率的なストレージ利用

## 📞 サポート

問題が解決しない場合は、以下の情報と共にサポートにお問い合わせください：
- ブラウザコンソールのエラーメッセージ
- `checkMockData()`の出力
- `checkStorage()`の出力