// すべてのユーザーの進捗データをリセットする

export function resetAllUserProgress() {
  try {
    const keysToReset: string[] = [];
    
    // localStorage内のすべてのキーをチェック
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // userProgress_で始まるすべてのキーを対象にする
      if (key.startsWith('userProgress_')) {
        keysToReset.push(key);
      }
    }
    
    // 各ユーザーの進捗データをリセット
    keysToReset.forEach(key => {
      const progress = localStorage.getItem(key);
      if (progress) {
        try {
          const data = JSON.parse(progress);
          
          // カテゴリ進捗をリセット
          if (data.categoryProgress) {
            Object.keys(data.categoryProgress).forEach(category => {
              data.categoryProgress[category].answeredQuestions = 0;
              data.categoryProgress[category].correctAnswers = 0;
            });
          }
          
          // 全体の統計をリセット
          data.totalQuestionsAnswered = 0;
          data.correctAnswers = 0;
          data.studySessions = [];
          data.incorrectQuestions = [];
          data.overcomeQuestions = [];
          data.currentStreak = 0;
          data.bestStreak = 0;
          data.lastStudyDate = "";
          
          // MockカテゴリもリセットExamProgress
          if (data.mockCategoryProgress) {
            Object.keys(data.mockCategoryProgress).forEach(category => {
              data.mockCategoryProgress[category] = {
                totalQuestions: data.mockCategoryProgress[category].totalQuestions || 0,
                latestScore: 0,
                bestScore: 0,
                attempts: 0,
                lastAttemptDate: ""
              };
            });
          }
          
          // リセットしたデータを保存
          localStorage.setItem(key, JSON.stringify(data));
          console.log(`Reset progress for: ${key}`);
        } catch (error) {
          console.error(`Failed to reset ${key}:`, error);
        }
      }
    });
    
    // その他の関連データも削除
    const otherKeysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('mockExamProgress_') ||
          key.startsWith('mockExamHistory_') ||
          key.startsWith('latestMockExam_') ||
          key.startsWith('tempMock') ||
          key.startsWith('answeredQuestions_') ||
          key === 'answeredQuestionsTracker') {
        otherKeysToDelete.push(key);
      }
    }
    
    otherKeysToDelete.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Deleted: ${key}`);
    });
    
    console.log(`Reset ${keysToReset.length} user progress entries and deleted ${otherKeysToDelete.length} related entries`);
    return { resetCount: keysToReset.length, deletedCount: otherKeysToDelete.length };
  } catch (error) {
    console.error('Failed to reset all user progress:', error);
    return { resetCount: 0, deletedCount: 0 };
  }
}