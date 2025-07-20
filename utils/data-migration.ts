import { safeLocalStorage, getUserKey } from './storage-utils';
import { UserProgress, Category, CategoryProgress, MockCategoryProgress } from '@/types';
import { categories } from './category-utils';
import { DataMerger } from './data-merge-utils';
import { createBackup, restoreFromBackup, getAvailableBackups, checkDataIntegrity } from "./data-backup";
import { syncAnsweredQuestionsWithProgress, autoRepairProgress } from "./progress-sync-utils";
import { loadValidatedProgress } from "./progress-validator";

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

// 新しい移行システム
interface MigrationResult {
  success: boolean;
  version: string;
  backupCreated: boolean;
  issuesFixed: number;
  error?: string;
}

const MIGRATION_VERSION_KEY = 'dataMigrationVersion';
const CURRENT_MIGRATION_VERSION = '2.0.0'; // 復習モード回答数修正バージョン

/**
 * データ移行が必要かチェック
 */
function needsMigrationV2(nickname?: string): boolean {
  const versionKey = getUserKey(MIGRATION_VERSION_KEY, nickname);
  const currentVersion = safeLocalStorage.getItem<string>(versionKey);
  return currentVersion !== CURRENT_MIGRATION_VERSION;
}

/**
 * 移行処理を実行（V2）
 */
export async function runDataMigrationV2(nickname?: string): Promise<MigrationResult> {
  console.log('🚀 Starting data migration V2 process...');
  
  const result: MigrationResult = {
    success: false,
    version: CURRENT_MIGRATION_VERSION,
    backupCreated: false,
    issuesFixed: 0
  };
  
  try {
    // 移行が必要かチェック
    if (!needsMigrationV2(nickname)) {
      console.log('✅ No migration needed, data is up to date');
      result.success = true;
      return result;
    }
    
    // バックアップを作成
    console.log('📦 Creating backup before migration...');
    await createBackup(undefined, nickname);
    result.backupCreated = true;
    
    // データの整合性チェック
    const userProgressKey = getUserKey('userProgress', nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    const answeredQuestionsKey = getUserKey('answeredQuestions', nickname);
    const answeredQuestions = safeLocalStorage.getItem<Record<Category, string[]>>(answeredQuestionsKey);
    
    if (userProgress && answeredQuestions) {
      const integrityReport = checkDataIntegrity(userProgress, answeredQuestions);
      console.log('📊 Data integrity report:', integrityReport.summary);
      result.issuesFixed = integrityReport.issues.length;
    }
    
    // データ同期と修復
    console.log('🔄 Synchronizing data sources...');
    const syncResult = await syncAnsweredQuestionsWithProgress(nickname, 'use_higher');
    
    if (!syncResult.success) {
      throw new Error('Data synchronization failed');
    }
    
    // 自動修復
    console.log('🔧 Running auto-repair...');
    const repairSuccess = await autoRepairProgress(nickname);
    
    if (!repairSuccess) {
      throw new Error('Auto-repair failed');
    }
    
    // バージョンを更新
    const versionKey = getUserKey(MIGRATION_VERSION_KEY, nickname);
    safeLocalStorage.setItem(versionKey, CURRENT_MIGRATION_VERSION);
    
    result.success = true;
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.success = false;
  }
  
  return result;
}

/**
 * ロールバック機能
 */
export async function rollbackToBackup(
  backupIndex: number = 0,
  nickname?: string,
  restoreToFirestore: boolean = false
): Promise<boolean> {
  console.log('🔄 Starting rollback process...');
  
  try {
    // 利用可能なバックアップを取得
    const backups = getAvailableBackups(nickname);
    
    if (backups.length === 0) {
      console.error('No backups available');
      return false;
    }
    
    if (backupIndex >= backups.length) {
      console.error(`Invalid backup index: ${backupIndex}`);
      return false;
    }
    
    // 現在の状態をバックアップ（ロールバック前）
    console.log('📦 Creating backup of current state before rollback...');
    await createBackup(undefined, nickname);
    
    // 選択されたバックアップを復元
    const selectedBackup = backups[backupIndex];
    console.log(`📥 Restoring backup from ${selectedBackup.timestamp}`);
    
    const success = await restoreFromBackup(
      selectedBackup,
      undefined,
      nickname,
      restoreToFirestore
    );
    
    if (success) {
      console.log('✅ Rollback completed successfully');
      
      // 移行バージョンをリセット（再移行を促すため）
      const versionKey = getUserKey(MIGRATION_VERSION_KEY, nickname);
      safeLocalStorage.removeItem(versionKey);
    } else {
      console.error('❌ Rollback failed');
    }
    
    return success;
    
  } catch (error) {
    console.error('Rollback error:', error);
    return false;
  }
}

/**
 * 起動時の自動移行チェック
 */
export async function checkAndRunMigration(nickname?: string): Promise<void> {
  try {
    // 古いデータの移行（既存機能）
    migrateOldData(nickname || 'default');
    
    // 新しい移行システム（V2）
    if (needsMigrationV2(nickname)) {
      console.log('📢 Data migration V2 needed, starting process...');
      
      const result = await runDataMigrationV2(nickname);
      
      if (result.success) {
        console.log(`✅ Migration v${result.version} completed successfully`);
        if (result.issuesFixed > 0) {
          console.log(`🔧 Fixed ${result.issuesFixed} data integrity issues`);
        }
      } else {
        console.error('❌ Migration failed:', result.error);
        
        // ユーザーに通知（実装に応じて）
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(
            'データ移行中にエラーが発生しました。\n' +
            'アプリケーションは通常通り動作しますが、\n' +
            '一部の進捗データが正しく表示されない可能性があります。'
          );
        }
      }
    }
  } catch (error) {
    console.error('Migration check failed:', error);
  }
}

// デバッグ用にグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).dataMigration = {
    run: runDataMigrationV2,
    rollback: rollbackToBackup,
    check: checkAndRunMigration,
    needsMigration: needsMigrationV2,
    migrateOld: migrateOldData
  };
}