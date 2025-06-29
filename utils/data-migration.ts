import { safeLocalStorage } from './storage-utils';
import { UserProgress, Category, CategoryProgress, MockCategoryProgress } from '@/types';
import { categories } from './category-utils';
import { DataMerger } from './data-merge-utils';

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
  // DataMergerを使用してマージ
  const merged = DataMerger.mergeProgress(current, old);
  
  // カテゴリ進捗の初期化（DataMergerで処理されない場合の保険）
  categories.forEach(category => {
    if (!merged.categoryProgress[category.name]) {
      merged.categoryProgress[category.name] = {
        totalQuestions: category.totalQuestions,
        answeredQuestions: 0,
        correctAnswers: 0
      };
    }
  });

  // DataMergerが処理しきれない追加フィールドの処理
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