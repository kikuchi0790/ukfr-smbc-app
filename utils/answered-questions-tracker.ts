import { Category } from "@/types";
import { safeLocalStorage, getUserKey } from "./storage-utils";
import { categories, getCategoryInfo } from "./category-utils";
import { ensureArray, uniqueArray } from "./validation-utils";

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