// 古いテストデータをクリーンアップするユーティリティ

export function cleanupLegacyData() {
  try {
    const keysToRemove: string[] = [];
    
    // localStorage内のすべてのキーをチェック
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // ニックネームなしの古い進捗データを削除
      if (key === 'userProgress' || 
          key === 'answeredQuestions' ||
          key === 'mockExamHistory' ||
          key === 'latestMockExam') {
        keysToRemove.push(key);
      }
      
      // カテゴリ別の古い回答済み問題データを削除
      if (key.startsWith('answeredQuestions_') && !key.includes('_', 18)) {
        keysToRemove.push(key);
      }
    }
    
    // 古いデータを削除
    keysToRemove.forEach(key => {
      console.log('Removing legacy data:', key);
      localStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} legacy data entries`);
    }
    
    return keysToRemove.length;
  } catch (error) {
    console.error('Failed to cleanup legacy data:', error);
    return 0;
  }
}

// カテゴリ別の回答済み問題トラッカーをリセット
export function resetCategoryTrackers() {
  try {
    const keysToRemove: string[] = [];
    
    // answeredQuestions_で始まるすべてのキーを削除
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('answeredQuestions_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Reset ${keysToRemove.length} category trackers`);
    return keysToRemove.length;
  } catch (error) {
    console.error('Failed to reset category trackers:', error);
    return 0;
  }
}