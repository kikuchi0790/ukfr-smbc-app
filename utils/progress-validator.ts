import { UserProgress, Category } from "@/types";
import { categories, getCategoryInfo } from "./category-utils";
import { safeLocalStorage, getUserKey } from "./storage-utils";
import { ensureProperty, clamp, isNotEmpty, ensureArray, uniqueArray } from "./validation-utils";
import { isValidProgress, isValidCategoryProgress } from "./type-guards";
import { ValidationError, handleValidationError } from "./error-utils";

/**
 * 進捗データの整合性をチェックし、必要に応じて修正する
 */
export function validateAndFixProgress(progress: UserProgress): UserProgress {
  const fixedProgress = { ...progress };
  
  // categoryProgressが存在しない場合は初期化
  ensureProperty(fixedProgress, 'categoryProgress', {} as Record<Category, any>);
  
  // 新規ユーザーの判定: totalQuestionsAnsweredが0の場合、すべてのカテゴリをリセット
  const isNewUser = fixedProgress.totalQuestionsAnswered === 0;
  
  // カテゴリ進捗の検証と修正
  categories.forEach(categoryInfo => {
    const categoryName = categoryInfo.name;
    
    // カテゴリが存在しない場合は初期化
    ensureProperty(fixedProgress.categoryProgress, categoryName, {
      totalQuestions: categoryInfo.totalQuestions,
      answeredQuestions: 0,
      correctAnswers: 0
    });
    
    const categoryProgress = fixedProgress.categoryProgress[categoryName];
    
    // カテゴリプログレスの検証
    if (isValidCategoryProgress(categoryProgress)) {
      const categoryProgress = fixedProgress.categoryProgress[categoryName];
      
      // 新規ユーザーの場合、すべてのカテゴリをリセット
      if (isNewUser) {
        console.log(`New user detected - resetting category: ${categoryName}`);
        categoryProgress.answeredQuestions = 0;
        categoryProgress.correctAnswers = 0;
      }
      
      // totalQuestionsが正しいか確認
      if (categoryProgress.totalQuestions !== categoryInfo.totalQuestions) {
        console.warn(`Fixing total questions for ${categoryName}: ${categoryProgress.totalQuestions} → ${categoryInfo.totalQuestions}`);
        categoryProgress.totalQuestions = categoryInfo.totalQuestions;
      }
      
      // answeredQuestionsがtotalQuestionsを超えていないか確認
      categoryProgress.answeredQuestions = clamp(
        categoryProgress.answeredQuestions,
        0,
        categoryProgress.totalQuestions
      );
      
      // correctAnswersがansweredQuestionsを超えていないか確認
      categoryProgress.correctAnswers = clamp(
        categoryProgress.correctAnswers,
        0,
        categoryProgress.answeredQuestions
      );
    }
  });
  
  return fixedProgress;
}

/**
 * 進捗をロードし、検証・修正を行う
 */
export function loadValidatedProgress(): UserProgress | null {
  try {
    const userProgressKey = getUserKey('userProgress');
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!isNotEmpty(progress)) return null;
    
    // 型ガードでバリデーション
    if (!isValidProgress(progress)) {
      throw new ValidationError(
        'Invalid progress data structure',
        'progress',
        progress
      );
    }
    
    const validatedProgress = validateAndFixProgress(progress);
    
    // 修正が必要だった場合は保存
    if (JSON.stringify(progress) !== JSON.stringify(validatedProgress)) {
      safeLocalStorage.setItem(userProgressKey, validatedProgress);
    }
    
    return validatedProgress;
  } catch (error) {
    handleValidationError(error, 'loadValidatedProgress');
    return null;
  }
}

/**
 * 回答済み問題の記録を管理するためのユーティリティ
 */
export class AnsweredQuestionsTracker {
  private static STORAGE_KEY = 'answeredQuestions';
  
  static getAnsweredQuestions(category: Category): Set<string> {
    const userKey = getUserKey(this.STORAGE_KEY);
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(userKey) || {} as Record<Category, string[]>;
    return new Set(ensureArray(data[category]));
  }
  
  static addAnsweredQuestion(category: Category, questionId: string): void {
    const userKey = getUserKey(this.STORAGE_KEY);
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(userKey) || {} as Record<Category, string[]>;
    ensureProperty(data, category, []);
    
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
      
      safeLocalStorage.setItem(userKey, data);
    }
  }
  
  static getAnsweredCount(category: Category): number {
    return this.getAnsweredQuestions(category).size;
  }
  
  static clearCategory(category: Category): void {
    const userKey = getUserKey(this.STORAGE_KEY);
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(userKey) || {} as Record<Category, string[]>;
    data[category] = [];
    safeLocalStorage.setItem(userKey, data);
  }
  
  /**
   * 重複を削除し、上限を超えないように修正
   */
  static cleanupAllCategories(): void {
    const userKey = getUserKey(this.STORAGE_KEY);
    const data = safeLocalStorage.getItem<Record<Category, string[]>>(userKey) || {} as Record<Category, string[]>;
    
    categories.forEach(categoryInfo => {
      const category = categoryInfo.name;
      if (data[category]) {
        // Remove duplicates and limit to total questions
        const uniqueIds = uniqueArray(data[category]);
        data[category] = uniqueIds.slice(0, categoryInfo.totalQuestions);
        
        if (uniqueIds.length > categoryInfo.totalQuestions) {
          console.warn(`Cleaning up ${category}: ${uniqueIds.length} → ${categoryInfo.totalQuestions}`);
        }
      }
    });
    
    safeLocalStorage.setItem(userKey, data);
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