/**
 * Progress synchronization service to ensure data consistency
 */

import { UserProgress, Category } from '@/types';
import { safeLocalStorage, getUserKey } from '@/utils/storage-utils';
import { categories } from '@/utils/category-utils';

class ProgressSyncService {
  private static instance: ProgressSyncService;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): ProgressSyncService {
    if (!ProgressSyncService.instance) {
      ProgressSyncService.instance = new ProgressSyncService();
    }
    return ProgressSyncService.instance;
  }

  /**
   * Add a listener for progress updates
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of a progress update
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get user progress with validation
   */
  getUserProgress(userNickname: string | undefined): UserProgress | null {
    if (!userNickname) {
      console.warn('getUserProgress called without nickname');
      return null;
    }

    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!progress) {
      console.log('No progress found for user:', userNickname);
      return null;
    }

    // Validate and fix progress if needed
    return this.validateProgress(progress);
  }

  /**
   * Update user progress and notify listeners
   */
  updateUserProgress(userNickname: string | undefined, updater: (progress: UserProgress) => UserProgress): void {
    if (!userNickname) {
      console.warn('updateUserProgress called without nickname');
      return;
    }

    const userProgressKey = getUserKey('userProgress', userNickname);
    let progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!progress) {
      // Initialize new progress if not found
      progress = this.createInitialProgress();
    }

    // Apply the update
    const updatedProgress = updater(progress);
    
    // Validate the updated progress
    const validatedProgress = this.validateProgress(updatedProgress);
    
    // Save the updated progress
    safeLocalStorage.setItem(userProgressKey, validatedProgress);
    
    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Create initial progress object
   */
  private createInitialProgress(): UserProgress {
    const initialCategoryProgress: Partial<Record<Category, any>> = {};
    
    categories.forEach(category => {
      initialCategoryProgress[category.name] = {
        totalQuestions: category.totalQuestions,
        answeredQuestions: 0,
        correctAnswers: 0
      };
    });

    return {
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
      categoryProgress: initialCategoryProgress as Record<Category, any>,
      studySessions: [],
      incorrectQuestions: [],
      overcomeQuestions: [],
      currentStreak: 0,
      bestStreak: 0,
      lastStudyDate: "",
      preferences: {
        showJapaneseInStudy: true,
        showJapaneseInMock: false,
        autoReviewIncorrect: true,
        notificationEnabled: false
      }
    };
  }

  /**
   * Validate and fix progress data
   */
  private validateProgress(progress: UserProgress): UserProgress {
    // Ensure all categories exist
    categories.forEach(category => {
      if (!progress.categoryProgress[category.name]) {
        progress.categoryProgress[category.name] = {
          totalQuestions: category.totalQuestions,
          answeredQuestions: 0,
          correctAnswers: 0
        };
      } else {
        // Ensure correct total questions
        progress.categoryProgress[category.name].totalQuestions = category.totalQuestions;
        
        // Ensure answered questions doesn't exceed total
        if (progress.categoryProgress[category.name].answeredQuestions > category.totalQuestions) {
          progress.categoryProgress[category.name].answeredQuestions = category.totalQuestions;
        }
        
        // Ensure correct answers doesn't exceed answered questions
        if (progress.categoryProgress[category.name].correctAnswers > progress.categoryProgress[category.name].answeredQuestions) {
          progress.categoryProgress[category.name].correctAnswers = progress.categoryProgress[category.name].answeredQuestions;
        }
      }
    });

    // Ensure preferences exist
    if (!progress.preferences) {
      progress.preferences = {
        showJapaneseInStudy: true,
        showJapaneseInMock: false,
        autoReviewIncorrect: true,
        notificationEnabled: false
      };
    }

    return progress;
  }

  /**
   * Force refresh all progress data
   */
  forceRefresh(userNickname: string | undefined): void {
    if (!userNickname) return;
    
    // Just notify listeners to force components to re-read data
    this.notifyListeners();
  }
}

export const progressSync = ProgressSyncService.getInstance();