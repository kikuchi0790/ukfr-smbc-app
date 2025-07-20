import { UserProgress, Category } from "@/types";
import { safeLocalStorage, getUserKey } from "./storage-utils";
import { AnsweredQuestionsTracker } from "./progress-validator";
import { loadFromFirestore, syncToFirestore } from "@/services/firebase-sync";

export interface BackupData {
  timestamp: string;
  version: string;
  userProgress: UserProgress | null;
  answeredQuestions: Record<Category, string[]> | null;
  firestoreData?: UserProgress | null;
}

/**
 * データのバックアップを作成
 */
export async function createBackup(userId?: string, nickname?: string): Promise<BackupData> {
  console.log('📦 Creating backup of all user data...');
  
  try {
    // LocalStorageからデータを取得
    const userProgressKey = getUserKey('userProgress', nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    // AnsweredQuestionsTrackerのデータを取得
    const answeredQuestionsKey = getUserKey('answeredQuestions', nickname);
    const answeredQuestions = safeLocalStorage.getItem<Record<Category, string[]>>(answeredQuestionsKey);
    
    // Firestoreからもデータを取得（可能な場合）
    let firestoreData: UserProgress | null = null;
    if (userId && nickname) {
      try {
        firestoreData = await loadFromFirestore(userId, nickname);
      } catch (error) {
        console.warn('Failed to load Firestore data for backup:', error);
      }
    }
    
    const backup: BackupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      userProgress,
      answeredQuestions,
      firestoreData
    };
    
    // バックアップをLocalStorageに保存（最大5つまで）
    const backupKey = getUserKey('backup', nickname);
    const existingBackups = safeLocalStorage.getItem<BackupData[]>(backupKey) || [];
    
    // 新しいバックアップを追加
    existingBackups.unshift(backup);
    
    // 最大5つまで保持
    if (existingBackups.length > 5) {
      existingBackups.splice(5);
    }
    
    safeLocalStorage.setItem(backupKey, existingBackups);
    
    console.log('✅ Backup created successfully:', {
      timestamp: backup.timestamp,
      hasUserProgress: !!backup.userProgress,
      hasAnsweredQuestions: !!backup.answeredQuestions,
      hasFirestoreData: !!backup.firestoreData
    });
    
    return backup;
  } catch (error) {
    console.error('Failed to create backup:', error);
    throw error;
  }
}

/**
 * バックアップからデータを復元
 */
export async function restoreFromBackup(
  backup: BackupData, 
  userId?: string, 
  nickname?: string,
  restoreToFirestore: boolean = false
): Promise<boolean> {
  console.log('📥 Restoring from backup:', backup.timestamp);
  
  try {
    // LocalStorageに復元
    if (backup.userProgress) {
      const userProgressKey = getUserKey('userProgress', nickname);
      safeLocalStorage.setItem(userProgressKey, backup.userProgress);
    }
    
    if (backup.answeredQuestions) {
      const answeredQuestionsKey = getUserKey('answeredQuestions', nickname);
      safeLocalStorage.setItem(answeredQuestionsKey, backup.answeredQuestions);
    }
    
    // Firestoreにも復元（オプション）
    if (restoreToFirestore && userId && nickname && backup.userProgress) {
      try {
        await syncToFirestore(userId, nickname);
      } catch (error) {
        console.warn('Failed to restore to Firestore:', error);
      }
    }
    
    console.log('✅ Backup restored successfully');
    return true;
  } catch (error) {
    console.error('Failed to restore from backup:', error);
    return false;
  }
}

/**
 * 利用可能なバックアップを取得
 */
export function getAvailableBackups(nickname?: string): BackupData[] {
  const backupKey = getUserKey('backup', nickname);
  return safeLocalStorage.getItem<BackupData[]>(backupKey) || [];
}

/**
 * データの整合性チェック結果
 */
export interface DataIntegrityReport {
  timestamp: string;
  issues: {
    type: string;
    category?: Category;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  summary: {
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
}

/**
 * データの整合性をチェック
 */
export function checkDataIntegrity(
  userProgress: UserProgress,
  answeredQuestions: Record<Category, string[]>
): DataIntegrityReport {
  const issues: DataIntegrityReport['issues'] = [];
  
  // カテゴリごとにチェック
  Object.entries(userProgress.categoryProgress).forEach(([category, progress]) => {
    const categoryKey = category as Category;
    const trackerCount = answeredQuestions[categoryKey]?.length || 0;
    const progressCount = progress.answeredQuestions;
    
    // 回答数の不一致
    if (trackerCount !== progressCount) {
      issues.push({
        type: 'count_mismatch',
        category: categoryKey,
        message: `AnsweredQuestionsTracker: ${trackerCount}, CategoryProgress: ${progressCount}`,
        severity: 'high'
      });
    }
    
    // 正解数が回答数を超えている
    if (progress.correctAnswers > progress.answeredQuestions) {
      issues.push({
        type: 'invalid_correct_count',
        category: categoryKey,
        message: `Correct answers (${progress.correctAnswers}) exceeds answered questions (${progress.answeredQuestions})`,
        severity: 'high'
      });
    }
    
    // 回答数が総問題数を超えている
    if (progress.answeredQuestions > progress.totalQuestions) {
      issues.push({
        type: 'exceeded_total',
        category: categoryKey,
        message: `Answered questions (${progress.answeredQuestions}) exceeds total questions (${progress.totalQuestions})`,
        severity: 'high'
      });
    }
  });
  
  // 全体の統計チェック
  const totalAnswered = Object.values(userProgress.categoryProgress)
    .reduce((sum, p) => sum + p.answeredQuestions, 0);
  
  if (Math.abs(totalAnswered - userProgress.totalQuestionsAnswered) > 5) {
    issues.push({
      type: 'total_mismatch',
      message: `Sum of category answers (${totalAnswered}) differs from total (${userProgress.totalQuestionsAnswered})`,
      severity: 'medium'
    });
  }
  
  const summary = {
    totalIssues: issues.length,
    highSeverity: issues.filter(i => i.severity === 'high').length,
    mediumSeverity: issues.filter(i => i.severity === 'medium').length,
    lowSeverity: issues.filter(i => i.severity === 'low').length
  };
  
  return {
    timestamp: new Date().toISOString(),
    issues,
    summary
  };
}

/**
 * デバッグ用：すべてのデータを表示
 */
export function debugAllData(nickname?: string): void {
  console.log('=== UKFR App Data Debug ===');
  
  // UserProgress
  const userProgressKey = getUserKey('userProgress', nickname);
  const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
  console.log('UserProgress:', userProgress);
  
  // AnsweredQuestions
  const answeredQuestionsKey = getUserKey('answeredQuestions', nickname);
  const answeredQuestions = safeLocalStorage.getItem<Record<Category, string[]>>(answeredQuestionsKey);
  console.log('AnsweredQuestions:', answeredQuestions);
  
  // データ整合性チェック
  if (userProgress && answeredQuestions) {
    const report = checkDataIntegrity(userProgress, answeredQuestions);
    console.log('Data Integrity Report:', report);
  }
  
  // バックアップ
  const backups = getAvailableBackups(nickname);
  console.log('Available Backups:', backups.length);
  backups.forEach((backup, index) => {
    console.log(`Backup ${index + 1}:`, {
      timestamp: backup.timestamp,
      hasUserProgress: !!backup.userProgress,
      hasAnsweredQuestions: !!backup.answeredQuestions,
      hasFirestoreData: !!backup.firestoreData
    });
  });
}

// ブラウザコンソールから使えるようにグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).dataBackup = {
    create: createBackup,
    restore: restoreFromBackup,
    getBackups: getAvailableBackups,
    checkIntegrity: checkDataIntegrity,
    debug: debugAllData
  };
}