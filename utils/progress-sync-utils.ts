import { UserProgress, Category } from "@/types";
import { safeLocalStorage, getUserKey } from "./storage-utils";
import { AnsweredQuestionsTracker } from "./answered-questions-tracker";
import { categories } from "./category-utils";
import { createBackup } from "./data-backup";

export interface SyncResult {
  success: boolean;
  changes: {
    category: Category;
    before: {
      tracker: number;
      progress: number;
    };
    after: {
      tracker: number;
      progress: number;
    };
    action: 'none' | 'sync_to_tracker' | 'sync_to_progress' | 'use_higher';
  }[];
  backupCreated: boolean;
}

/**
 * AnsweredQuestionsTrackerとcategoryProgressを同期
 * @param strategy 同期戦略: 'use_higher'（大きい方を使用）, 'trust_progress'（categoryProgressを信頼）, 'trust_tracker'（trackerを信頼）
 */
export async function syncAnsweredQuestionsWithProgress(
  nickname?: string,
  strategy: 'use_higher' | 'trust_progress' | 'trust_tracker' = 'use_higher'
): Promise<SyncResult> {
  console.log('🔄 Starting sync between AnsweredQuestionsTracker and categoryProgress...');
  console.log('📋 Sync strategy:', strategy);
  
  const result: SyncResult = {
    success: false,
    changes: [],
    backupCreated: false
  };
  
  try {
    // まずバックアップを作成
    await createBackup(undefined, nickname);
    result.backupCreated = true;
    console.log('✅ Backup created before sync');
    
    // 現在のデータを取得
    const userProgressKey = getUserKey('userProgress', nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!userProgress) {
      console.warn('No user progress found');
      return result;
    }
    
    const answeredQuestionsKey = getUserKey('answeredQuestions', nickname);
    const answeredQuestions = safeLocalStorage.getItem<Record<Category, string[]>>(answeredQuestionsKey) || {} as Record<Category, string[]>;
    
    // 各カテゴリで同期処理
    categories.forEach(categoryInfo => {
      const category = categoryInfo.name;
      const trackerQuestions = answeredQuestions[category] || [];
      const trackerCount = trackerQuestions.length;
      const progressCount = userProgress.categoryProgress[category]?.answeredQuestions || 0;
      
      const change = {
        category,
        before: {
          tracker: trackerCount,
          progress: progressCount
        },
        after: {
          tracker: trackerCount,
          progress: progressCount
        },
        action: 'none' as 'none' | 'sync_to_tracker' | 'sync_to_progress' | 'use_higher'
      };
      
      // 同期が必要かチェック
      if (trackerCount !== progressCount) {
        console.log(`📊 Mismatch found in ${category}:`, {
          tracker: trackerCount,
          progress: progressCount
        });
        
        let newCount: number;
        switch (strategy) {
          case 'use_higher':
            // 大きい方の値を使用（データ損失を防ぐ）
            newCount = Math.max(trackerCount, progressCount);
            change.action = 'use_higher';
            break;
          case 'trust_progress':
            // categoryProgressの値を信頼
            newCount = progressCount;
            change.action = 'sync_to_tracker';
            break;
          case 'trust_tracker':
            // trackerの値を信頼
            newCount = trackerCount;
            change.action = 'sync_to_progress';
            break;
        }
        
        // 値を同期
        change.after.tracker = newCount;
        change.after.progress = newCount;
        
        // categoryProgressを更新
        if (userProgress.categoryProgress[category]) {
          userProgress.categoryProgress[category].answeredQuestions = newCount;
          
          // 正解数が回答数を超えないように調整
          if (userProgress.categoryProgress[category].correctAnswers > newCount) {
            console.warn(`Adjusting correctAnswers for ${category}: ${userProgress.categoryProgress[category].correctAnswers} -> ${newCount}`);
            userProgress.categoryProgress[category].correctAnswers = newCount;
          }
        }
        
        // AnsweredQuestionsTrackerを更新
        if (strategy === 'use_higher' && progressCount > trackerCount) {
          // progressの方が多い場合、不足分を仮のIDで埋める
          console.log(`Adding placeholder question IDs to tracker for ${category}`);
          const missingCount = progressCount - trackerCount;
          for (let i = 0; i < missingCount; i++) {
            trackerQuestions.push(`placeholder_${category}_${Date.now()}_${i}`);
          }
          answeredQuestions[category] = trackerQuestions;
        } else if (strategy === 'trust_progress' && progressCount < trackerCount) {
          // progressの方が少ない場合、trackerを削減
          answeredQuestions[category] = trackerQuestions.slice(0, progressCount);
        }
      }
      
      result.changes.push(change);
    });
    
    // 変更を保存
    safeLocalStorage.setItem(userProgressKey, userProgress);
    safeLocalStorage.setItem(answeredQuestionsKey, answeredQuestions);
    
    // 全体の回答数も再計算
    const totalAnswered = Object.values(userProgress.categoryProgress)
      .reduce((sum, p) => sum + p.answeredQuestions, 0);
    
    if (userProgress.totalQuestionsAnswered !== totalAnswered) {
      console.log(`Updating totalQuestionsAnswered: ${userProgress.totalQuestionsAnswered} -> ${totalAnswered}`);
      userProgress.totalQuestionsAnswered = totalAnswered;
      safeLocalStorage.setItem(userProgressKey, userProgress);
    }
    
    result.success = true;
    
    // 変更サマリーを表示
    const changedCategories = result.changes.filter(c => c.action !== 'none');
    console.log(`✅ Sync completed. ${changedCategories.length} categories updated`);
    changedCategories.forEach(change => {
      console.log(`  ${change.category}: ${change.before.progress} -> ${change.after.progress}`);
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
    result.success = false;
  }
  
  return result;
}

/**
 * 回答数を安全に増加させる（両方のデータソースを更新）
 */
export function incrementAnsweredCount(
  category: Category,
  questionId: string,
  nickname?: string
): boolean {
  console.log(`📈 Incrementing answered count for ${category}, question: ${questionId}`);
  
  try {
    // UserProgressを更新
    const userProgressKey = getUserKey('userProgress', nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!userProgress) {
      console.error('No user progress found');
      return false;
    }
    
    // categoryProgressを更新
    if (userProgress.categoryProgress[category]) {
      const current = userProgress.categoryProgress[category].answeredQuestions;
      const total = userProgress.categoryProgress[category].totalQuestions;
      
      if (current >= total) {
        console.warn(`Category ${category} already at maximum (${current}/${total})`);
        return false;
      }
      
      userProgress.categoryProgress[category].answeredQuestions++;
      safeLocalStorage.setItem(userProgressKey, userProgress);
    }
    
    // AnsweredQuestionsTrackerも更新
    AnsweredQuestionsTracker.addAnsweredQuestion(category, questionId);
    
    console.log('✅ Answered count incremented successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to increment answered count:', error);
    return false;
  }
}

/**
 * データの自動修復
 */
export async function autoRepairProgress(nickname?: string): Promise<boolean> {
  console.log('🔧 Starting auto-repair process...');
  
  try {
    // バックアップを作成
    await createBackup(undefined, nickname);
    
    // データを同期（大きい方の値を使用）
    const syncResult = await syncAnsweredQuestionsWithProgress(nickname, 'use_higher');
    
    if (!syncResult.success) {
      console.error('Sync failed during auto-repair');
      return false;
    }
    
    // UserProgressの検証と修正
    const userProgressKey = getUserKey('userProgress', nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (userProgress) {
      // 克服した問題の整合性チェック
      if (userProgress.overcomeQuestions && userProgress.incorrectQuestions) {
        // 克服した問題が間違えた問題リストに残っていないか確認
        const overcomeIds = new Set(userProgress.overcomeQuestions.map(q => q.questionId));
        userProgress.incorrectQuestions = userProgress.incorrectQuestions.filter(
          q => !overcomeIds.has(q.questionId)
        );
      }
      
      // 正解数の調整（克服した問題を含む）
      const overcomeCount = userProgress.overcomeQuestions?.length || 0;
      const baseCorrectCount = userProgress.correctAnswers || 0;
      const expectedCorrectCount = baseCorrectCount + overcomeCount;
      
      console.log('Correct answers adjustment:', {
        base: baseCorrectCount,
        overcome: overcomeCount,
        expected: expectedCorrectCount
      });
      
      safeLocalStorage.setItem(userProgressKey, userProgress);
    }
    
    console.log('✅ Auto-repair completed successfully');
    return true;
    
  } catch (error) {
    console.error('Auto-repair failed:', error);
    return false;
  }
}

// デバッグ用にグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).progressSync = {
    sync: syncAnsweredQuestionsWithProgress,
    autoRepair: autoRepairProgress,
    incrementAnswered: incrementAnsweredCount
  };
}