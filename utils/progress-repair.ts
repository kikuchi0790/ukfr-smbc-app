import { UserProgress, Category, CategoryProgress } from '@/types';
import { safeLocalStorage, getUserKey } from './storage-utils';
import { calculateActualStats, validateAndFixProgress } from './progress-tracker';
import { AnsweredQuestionsTracker } from './answered-questions-tracker';

/**
 * 全ユーザーの進捗データを修復するユーティリティ
 * 重複カウント問題を解決し、StudySessionsから正確な統計を再計算
 */
export class ProgressRepairTool {
  /**
   * 指定ユーザーの進捗データを修復
   */
  static repairUserProgress(nickname?: string): {
    success: boolean;
    message: string;
    originalData?: UserProgress;
    repairedData?: UserProgress;
    issues?: string[];
  } {
    try {
      const userProgressKey = getUserKey('userProgress', nickname);
      const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      
      if (!progress) {
        return {
          success: false,
          message: 'No progress data found for user'
        };
      }
      
      // オリジナルデータのバックアップ
      const originalData = JSON.parse(JSON.stringify(progress));
      
      // StudySessionsから実際の統計を計算
      const actualStats = calculateActualStats(progress);
      
      // データの検証と修正
      const validation = validateAndFixProgress(progress);
      
      if (!validation.isValid) {
        // 修正されたデータを保存
        safeLocalStorage.setItem(userProgressKey, validation.fixed);
        
        // AnsweredQuestionsTrackerもクリーンアップ
        AnsweredQuestionsTracker.cleanupAllCategories();
        
        return {
          success: true,
          message: `Progress repaired successfully. Fixed ${validation.issues.length} issues.`,
          originalData,
          repairedData: validation.fixed,
          issues: validation.issues
        };
      }
      
      return {
        success: true,
        message: 'Progress data is already healthy',
        originalData: progress,
        repairedData: progress,
        issues: []
      };
    } catch (error) {
      console.error('Error repairing progress:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * すべてのユーザーの進捗データを修復
   */
  static repairAllUsers(): {
    totalUsers: number;
    repaired: number;
    failed: number;
    results: Array<{ nickname: string; result: ReturnType<typeof ProgressRepairTool.repairUserProgress> }>;
  } {
    const results: Array<{ nickname: string; result: ReturnType<typeof ProgressRepairTool.repairUserProgress> }> = [];
    let repaired = 0;
    let failed = 0;
    
    // LocalStorageのキーを走査してユーザーを特定
    const keys = Object.keys(localStorage);
    const userProgressKeys = keys.filter(key => key.includes('userProgress_'));
    
    userProgressKeys.forEach(key => {
      const nickname = key.replace('userProgress_', '');
      const result = this.repairUserProgress(nickname);
      
      if (result.success && result.issues && result.issues.length > 0) {
        repaired++;
      } else if (!result.success) {
        failed++;
      }
      
      results.push({ nickname, result });
    });
    
    return {
      totalUsers: userProgressKeys.length,
      repaired,
      failed,
      results
    };
  }
  
  /**
   * 統計レポートを生成
   */
  static generateReport(nickname?: string): string {
    const userProgressKey = getUserKey('userProgress', nickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!progress) {
      return 'No progress data found';
    }
    
    const actualStats = calculateActualStats(progress);
    const validation = validateAndFixProgress(progress);
    
    let report = '=== Progress Report ===\n\n';
    report += '📊 Recorded vs Actual Statistics:\n';
    report += `  Total Answered: ${progress.totalQuestionsAnswered} (recorded) vs ${actualStats.totalAnswered} (actual)\n`;
    report += `  Total Correct: ${progress.correctAnswers} (recorded) vs ${actualStats.totalCorrect} (actual)\n`;
    report += `  Overcome Questions: ${progress.overcomeQuestions?.length || 0}\n`;
    report += `  Incorrect Questions: ${progress.incorrectQuestions?.length || 0}\n`;
    report += `  Study Sessions: ${progress.studySessions?.length || 0}\n\n`;
    
    report += '📚 Category Breakdown:\n';
    Object.entries(actualStats.categoryStats).forEach(([category, stats]) => {
      const recorded = progress.categoryProgress[category as Category];
      if (recorded) {
        report += `  ${category}:\n`;
        report += `    Answered: ${recorded.answeredQuestions} (recorded) vs ${stats.answered} (actual)\n`;
        report += `    Correct: ${recorded.correctAnswers} (recorded) vs ${stats.correct} (actual)\n`;
      }
    });
    
    if (!validation.isValid) {
      report += '\n⚠️ Issues Found:\n';
      validation.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
    } else {
      report += '\n✅ No issues found - data is healthy\n';
    }
    
    return report;
  }
}

// ブラウザコンソールからアクセスできるようにグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).ProgressRepairTool = ProgressRepairTool;
  
  // ショートカット関数
  (window as any).repairMyProgress = () => {
    const result = ProgressRepairTool.repairUserProgress();
    console.log(result.message);
    if (result.issues && result.issues.length > 0) {
      console.log('Fixed issues:', result.issues);
    }
    return result;
  };
  
  (window as any).repairAllProgress = () => {
    const result = ProgressRepairTool.repairAllUsers();
    console.log(`Repaired ${result.repaired}/${result.totalUsers} users`);
    if (result.failed > 0) {
      console.warn(`Failed to repair ${result.failed} users`);
    }
    return result;
  };
  
  (window as any).progressReport = (nickname?: string) => {
    const report = ProgressRepairTool.generateReport(nickname);
    console.log(report);
    return report;
  };
}