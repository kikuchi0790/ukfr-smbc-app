import { UserProgress, Category } from "@/types";
import { categories, getCategoryInfo } from "./category-utils";
import { safeLocalStorage } from "./storage-utils";

/**
 * 進捗データの整合性をチェックし、必要に応じて修正する
 */
export function validateAndFixProgress(progress: UserProgress): UserProgress {
  const fixedProgress = { ...progress };
  
  // カテゴリ進捗の検証と修正
  categories.forEach(categoryInfo => {
    const categoryName = categoryInfo.name;
    
    // カテゴリが存在しない場合は初期化
    if (!fixedProgress.categoryProgress[categoryName]) {
      fixedProgress.categoryProgress[categoryName] = {
        totalQuestions: categoryInfo.totalQuestions,
        answeredQuestions: 0,
        correctAnswers: 0
      };
    } else {
      const categoryProgress = fixedProgress.categoryProgress[categoryName];
      
      // totalQuestionsが正しいか確認
      if (categoryProgress.totalQuestions !== categoryInfo.totalQuestions) {
        console.warn(`Fixing total questions for ${categoryName}: ${categoryProgress.totalQuestions} → ${categoryInfo.totalQuestions}`);
        categoryProgress.totalQuestions = categoryInfo.totalQuestions;
      }
      
      // answeredQuestionsがtotalQuestionsを超えていないか確認
      if (categoryProgress.answeredQuestions > categoryProgress.totalQuestions) {
        console.warn(`Fixing answered questions for ${categoryName}: ${categoryProgress.answeredQuestions} → ${categoryProgress.totalQuestions}`);
        categoryProgress.answeredQuestions = categoryProgress.totalQuestions;
      }
      
      // correctAnswersがansweredQuestionsを超えていないか確認
      if (categoryProgress.correctAnswers > categoryProgress.answeredQuestions) {
        console.warn(`Fixing correct answers for ${categoryName}: ${categoryProgress.correctAnswers} → ${categoryProgress.answeredQuestions}`);
        categoryProgress.correctAnswers = categoryProgress.answeredQuestions;
      }
    }
  });
  
  return fixedProgress;
}

/**
 * 進捗をロードし、検証・修正を行う
 */
export function loadValidatedProgress(): UserProgress | null {
  const progress = safeLocalStorage.getItem<UserProgress>('userProgress');
  if (!progress) return null;
  
  const validatedProgress = validateAndFixProgress(progress);
  
  // 修正が必要だった場合は保存
  if (JSON.stringify(progress) !== JSON.stringify(validatedProgress)) {
    safeLocalStorage.setItem('userProgress', validatedProgress);
  }
  
  return validatedProgress;
}

/**
 * 回答済み問題の記録を管理するためのユーティリティ
 */
export class AnsweredQuestionsTracker {
  private static STORAGE_KEY = 'answeredQuestions';
  
  static getAnsweredQuestions(category: Category): Set<string> {
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(this.STORAGE_KEY) || {} as Record<Category, string[]>;
    return new Set(data[category] || []);
  }
  
  static addAnsweredQuestion(category: Category, questionId: string): void {
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(this.STORAGE_KEY) || {} as Record<Category, string[]>;
    if (!data[category]) {
      data[category] = [];
    }
    
    // Ensure no duplicates
    if (!data[category].includes(questionId)) {
      data[category].push(questionId);
      
      // Get category info to check bounds
      const categoryInfo = getCategoryInfo(category);
      if (categoryInfo && data[category].length > categoryInfo.totalQuestions) {
        console.error(`Warning: Answered questions (${data[category].length}) exceeds total questions (${categoryInfo.totalQuestions}) for ${category}`);
        // Don't add if it would exceed the limit
        data[category].pop();
        return;
      }
      
      safeLocalStorage.setItem(this.STORAGE_KEY, data);
    }
  }
  
  static getAnsweredCount(category: Category): number {
    return this.getAnsweredQuestions(category).size;
  }
  
  static clearCategory(category: Category): void {
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(this.STORAGE_KEY) || {} as Record<Category, string[]>;
    data[category] = [];
    safeLocalStorage.setItem(this.STORAGE_KEY, data);
  }
  
  /**
   * 重複を削除し、上限を超えないように修正
   */
  static cleanupAllCategories(): void {
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(this.STORAGE_KEY) || {} as Record<Category, string[]>;
    
    categories.forEach(categoryInfo => {
      const category = categoryInfo.name;
      if (data[category]) {
        // Remove duplicates
        const uniqueIds = [...new Set(data[category])];
        
        // Limit to total questions
        if (uniqueIds.length > categoryInfo.totalQuestions) {
          console.warn(`Cleaning up ${category}: ${uniqueIds.length} → ${categoryInfo.totalQuestions}`);
          data[category] = uniqueIds.slice(0, categoryInfo.totalQuestions);
        } else {
          data[category] = uniqueIds;
        }
      }
    });
    
    safeLocalStorage.setItem(this.STORAGE_KEY, data);
  }
}

/**
 * すべての進捗データをクリーンアップ
 */
export function cleanupAllProgressData(): void {
  console.log('Starting progress data cleanup...');
  
  // Clean up answered questions tracker
  AnsweredQuestionsTracker.cleanupAllCategories();
  
  // Validate and fix user progress
  const progress = loadValidatedProgress();
  if (progress) {
    console.log('Progress data cleaned up successfully');
  }
}