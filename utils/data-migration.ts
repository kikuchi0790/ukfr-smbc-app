import { safeLocalStorage } from './storage-utils';
import { UserProgress, Category, CategoryProgress, MockCategoryProgress } from '@/types';
import { categories } from './category-utils';

/**
 * 古いデータをマイグレーションする
 * アカウント機能実装前のデータ（ニックネームなしのキー）を
 * 現在のユーザーのデータにマージする
 */
export function migrateOldData(nickname: string): boolean {
  try {
    console.log(`Starting data migration for user: ${nickname}`);
    let migrated = false;

    // 1. userProgressのマイグレーション
    const oldProgressKey = 'userProgress';
    const newProgressKey = `userProgress_${nickname}`;
    
    const oldProgress = safeLocalStorage.getItem<UserProgress>(oldProgressKey);
    const currentProgress = safeLocalStorage.getItem<UserProgress>(newProgressKey);
    
    if (oldProgress && !currentProgress) {
      // 古いデータがあり、新しいデータがない場合は単純に移動
      console.log('Migrating old userProgress data...');
      safeLocalStorage.setItem(newProgressKey, oldProgress);
      safeLocalStorage.removeItem(oldProgressKey);
      migrated = true;
    } else if (oldProgress && currentProgress) {
      // 両方のデータがある場合はマージ
      console.log('Merging old userProgress data with existing data...');
      const mergedProgress = mergeProgressData(currentProgress, oldProgress);
      safeLocalStorage.setItem(newProgressKey, mergedProgress);
      safeLocalStorage.removeItem(oldProgressKey);
      migrated = true;
    }

    // 2. mockExamHistoryのマイグレーション
    const oldMockHistoryKey = 'mockExamHistory';
    const newMockHistoryKey = `mockExamHistory_${nickname}`;
    
    const oldMockHistory = safeLocalStorage.getItem<any[]>(oldMockHistoryKey);
    const currentMockHistory = safeLocalStorage.getItem<any[]>(newMockHistoryKey);
    
    if (oldMockHistory && !currentMockHistory) {
      console.log('Migrating old mockExamHistory data...');
      safeLocalStorage.setItem(newMockHistoryKey, oldMockHistory);
      safeLocalStorage.removeItem(oldMockHistoryKey);
      migrated = true;
    } else if (oldMockHistory && currentMockHistory) {
      console.log('Merging old mockExamHistory data...');
      const mergedHistory = [...currentMockHistory, ...oldMockHistory];
      // 重複を削除し、日付でソート
      const uniqueHistory = mergedHistory.filter((item, index, self) =>
        index === self.findIndex((h) => h.id === item.id)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      safeLocalStorage.setItem(newMockHistoryKey, uniqueHistory);
      safeLocalStorage.removeItem(oldMockHistoryKey);
      migrated = true;
    }

    // 3. その他の一時データのクリーンアップ
    const keysToCleanup = [
      'tempMockResult',
      'tempMockQuestions',
      'mockExamProgress',
      'latestMockExam'
    ];
    
    keysToCleanup.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`Cleaned up old key: ${key}`);
        migrated = true;
      }
    });

    if (migrated) {
      console.log('Data migration completed successfully');
    } else {
      console.log('No data to migrate');
    }

    return migrated;
  } catch (error) {
    console.error('Error during data migration:', error);
    return false;
  }
}

/**
 * 2つのUserProgressデータをマージする
 * より多く進んでいる方のデータを優先する
 */
function mergeProgressData(current: UserProgress, old: UserProgress): UserProgress {
  // Initialize category progress with all categories
  const initialCategoryProgress: Partial<Record<Category, CategoryProgress>> = {};
  categories.forEach(category => {
    initialCategoryProgress[category.name] = {
      totalQuestions: category.totalQuestions,
      answeredQuestions: 0,
      correctAnswers: 0
    };
  });

  const merged: UserProgress = {
    ...current,
    totalQuestionsAnswered: Math.max(current.totalQuestionsAnswered, old.totalQuestionsAnswered),
    correctAnswers: Math.max(current.correctAnswers, old.correctAnswers),
    currentStreak: Math.max(current.currentStreak, old.currentStreak || 0),
    bestStreak: Math.max(current.bestStreak || 0, old.bestStreak || 0),
    lastStudyDate: current.lastStudyDate > old.lastStudyDate ? current.lastStudyDate : old.lastStudyDate,
    categoryProgress: initialCategoryProgress as Record<Category, CategoryProgress>,
    studySessions: [],
    incorrectQuestions: [],
    overcomeQuestions: [],
    mockCategoryProgress: undefined
  };

  // カテゴリ進捗のマージ（より進んでいる方を採用）
  if (old.categoryProgress) {
    Object.entries(old.categoryProgress).forEach(([category, oldProg]) => {
      const categoryKey = category as Category;
      const currentProg = current.categoryProgress?.[categoryKey];
      if (!currentProg || oldProg.answeredQuestions > currentProg.answeredQuestions) {
        merged.categoryProgress[categoryKey] = oldProg;
      } else {
        merged.categoryProgress[categoryKey] = currentProg;
      }
    });
  }

  // 現在のカテゴリ進捗も確認
  if (current.categoryProgress) {
    Object.entries(current.categoryProgress).forEach(([category, currentProg]) => {
      const categoryKey = category as Category;
      if (!merged.categoryProgress[categoryKey]) {
        merged.categoryProgress[categoryKey] = currentProg;
      }
    });
  }

  // Study sessionsのマージ（両方を結合して日付でソート）
  merged.studySessions = [
    ...(current.studySessions || []),
    ...(old.studySessions || [])
  ].sort((a, b) => new Date(b.startedAt || '').getTime() - new Date(a.startedAt || '').getTime())
    .slice(0, 100); // 最新100件のみ保持

  // 間違えた問題のマージ（重複を除去）
  const incorrectMap = new Map();
  [...(old.incorrectQuestions || []), ...(current.incorrectQuestions || [])]
    .forEach(q => {
      const existing = incorrectMap.get(q.questionId);
      if (!existing || q.incorrectCount > existing.incorrectCount) {
        incorrectMap.set(q.questionId, q);
      }
    });
  merged.incorrectQuestions = Array.from(incorrectMap.values());

  // 克服した問題のマージ（重複を除去）
  const overcomeMap = new Map();
  [...(old.overcomeQuestions || []), ...(current.overcomeQuestions || [])]
    .forEach(q => overcomeMap.set(q.questionId, q));
  merged.overcomeQuestions = Array.from(overcomeMap.values());

  // Mock試験進捗のマージ（より良いスコアを採用）
  if (old.mockCategoryProgress || current.mockCategoryProgress) {
    merged.mockCategoryProgress = {} as Record<Category, MockCategoryProgress>;
    
    if (old.mockCategoryProgress) {
      Object.entries(old.mockCategoryProgress).forEach(([category, oldMock]) => {
        const categoryKey = category as Category;
        const currentMock = current.mockCategoryProgress?.[categoryKey];
        if (!currentMock || oldMock.bestScore > currentMock.bestScore) {
          merged.mockCategoryProgress![categoryKey] = oldMock;
        } else {
          merged.mockCategoryProgress![categoryKey] = currentMock;
        }
      });
    }

    // 現在のMock試験進捗も確認
    if (current.mockCategoryProgress) {
      Object.entries(current.mockCategoryProgress).forEach(([category, currentMock]) => {
        const categoryKey = category as Category;
        if (!merged.mockCategoryProgress![categoryKey]) {
          merged.mockCategoryProgress![categoryKey] = currentMock;
        }
      });
    }
  }

  // 設定は現在のものを優先
  merged.preferences = current.preferences || old.preferences;

  return merged;
}

/**
 * localStorageの全体的なクリーンアップ
 * 不要な古いデータを削除
 */
export function cleanupOldLocalStorageData(): void {
  try {
    const keysToDelete: string[] = [];
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // ニックネームを含まない古いキーパターン
      if (key === 'userProgress' || 
          key === 'mockExamHistory' ||
          key.startsWith('tempMock') ||
          key === 'mockExamProgress' ||
          key === 'latestMockExam') {
        keysToDelete.push(key);
      }

      // 1週間以上前の一時データ
      if (key.startsWith('temp') || key.startsWith('fallback_')) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.timestamp && parsed.timestamp < oneWeekAgo) {
              keysToDelete.push(key);
            }
          }
        } catch {
          // パースできない場合も古いデータとして削除
          keysToDelete.push(key);
        }
      }
    }

    console.log(`Cleaning up ${keysToDelete.length} old localStorage keys...`);
    keysToDelete.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error during localStorage cleanup:', error);
  }
}