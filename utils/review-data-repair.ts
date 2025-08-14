/**
 * 復習機能データ修復ツール
 * Mock試験とカテゴリ学習の間違えた問題データを統合形式に移行
 */

import { UserProgress, IncorrectQuestion, Category, MockCategoryProgress } from '@/types';
import { safeLocalStorage, getUserKey } from './storage-utils';

export class ReviewDataRepairTool {
  /**
   * ユーザーの復習データを修復（統合形式への移行）
   */
  static repairUserReviewData(nickname?: string): {
    success: boolean;
    message: string;
    originalData?: UserProgress;
    repairedData?: UserProgress;
    changes?: string[];
  } {
    try {
      if (!nickname) {
        // localStorageからニックネームを取得
        const authUser = safeLocalStorage.getItem<any>('authUser');
        if (!authUser?.nickname) {
          return {
            success: false,
            message: 'ユーザー情報が見つかりません'
          };
        }
        nickname = authUser.nickname;
      }

      const userProgressKey = getUserKey('userProgress', nickname);
      const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      
      if (!progress) {
        return {
          success: false,
          message: '進捗データが見つかりません'
        };
      }

      const originalData = JSON.parse(JSON.stringify(progress));
      const changes: string[] = [];

      // incorrectQuestionsを初期化
      if (!progress.incorrectQuestions) {
        progress.incorrectQuestions = [];
        changes.push('incorrectQuestionsを初期化しました');
      }

      // mockIncorrectQuestionsを統合
      if (progress.mockIncorrectQuestions && progress.mockIncorrectQuestions.length > 0) {
        const existingIds = new Set(progress.incorrectQuestions.map(q => q.questionId));
        let mergedCount = 0;

        progress.mockIncorrectQuestions.forEach(mockQuestion => {
          if (!existingIds.has(mockQuestion.questionId)) {
            // 新しい統合形式のIncorrectQuestionを作成
            const integratedQuestion: IncorrectQuestion = {
              questionId: mockQuestion.questionId,
              category: mockQuestion.category,
              incorrectCount: mockQuestion.incorrectCount,
              lastIncorrectDate: mockQuestion.lastIncorrectDate,
              reviewCount: mockQuestion.reviewCount,
              source: 'mock',
              mockNumber: mockQuestion.mockNumber
            };
            progress.incorrectQuestions.push(integratedQuestion);
            mergedCount++;
          } else {
            // 既存の問題がある場合はソース情報を更新
            const existingIndex = progress.incorrectQuestions.findIndex(
              q => q.questionId === mockQuestion.questionId
            );
            if (existingIndex >= 0) {
              // より新しい情報で更新
              const existing = progress.incorrectQuestions[existingIndex];
              if (new Date(mockQuestion.lastIncorrectDate) > new Date(existing.lastIncorrectDate)) {
                existing.incorrectCount = Math.max(existing.incorrectCount, mockQuestion.incorrectCount);
                existing.lastIncorrectDate = mockQuestion.lastIncorrectDate;
                existing.source = 'mock';
                existing.mockNumber = mockQuestion.mockNumber;
              }
            }
          }
        });

        if (mergedCount > 0) {
          changes.push(`Mock試験の間違い${mergedCount}問を統合しました`);
        }
      }

      // カテゴリ学習の間違いにソース情報を追加
      let categorySourceAdded = 0;
      progress.incorrectQuestions.forEach(question => {
        if (!question.source) {
          // ソースが未設定の場合はcategoryとして設定
          question.source = 'category';
          categorySourceAdded++;
        }
      });

      if (categorySourceAdded > 0) {
        changes.push(`カテゴリ学習の間違い${categorySourceAdded}問にソース情報を追加しました`);
      }

      // mockOvercomeQuestionsを統合
      if (progress.mockOvercomeQuestions && progress.mockOvercomeQuestions.length > 0) {
        if (!progress.overcomeQuestions) {
          progress.overcomeQuestions = [];
        }

        const existingOvercomeIds = new Set(progress.overcomeQuestions.map(q => q.questionId));
        let overcomeCount = 0;

        progress.mockOvercomeQuestions.forEach(mockOvercome => {
          if (!existingOvercomeIds.has(mockOvercome.questionId)) {
            progress.overcomeQuestions.push(mockOvercome);
            overcomeCount++;
          }
        });

        if (overcomeCount > 0) {
          changes.push(`Mock試験の克服問題${overcomeCount}問を統合しました`);
        }
      }

      // Mock試験履歴からmockCategoryProgressを再構築
      const mockHistoryKey = `mockExamHistory_${nickname}`;
      const mockHistory = safeLocalStorage.getItem<any[]>(mockHistoryKey);
      
      if (mockHistory && mockHistory.length > 0) {
        if (!progress.mockCategoryProgress) {
          progress.mockCategoryProgress = {};
        }
        
        let progressRebuilt = false;
        
        mockHistory.forEach(exam => {
          if (exam.category && exam.score !== undefined) {
            const categoryName = exam.category as Category;
            const score = exam.score;
            const totalQuestions = exam.totalQuestions || 75;
            
            if (!progress.mockCategoryProgress![categoryName]) {
              // 初回データ作成
              progress.mockCategoryProgress![categoryName] = {
                totalQuestions,
                attemptsCount: 1,
                bestScore: score,
                latestScore: score,
                averageScore: score,
                passedCount: score >= 70 ? 1 : 0,
                lastAttemptDate: exam.completedAt || new Date().toISOString()
              };
              progressRebuilt = true;
            } else {
              // 既存データ更新（より良いスコアがあれば）
              const existing = progress.mockCategoryProgress![categoryName];
              if (score > existing.bestScore) {
                existing.bestScore = score;
                progressRebuilt = true;
              }
              // 受験日が新しければ最新スコアを更新
              if (exam.completedAt && new Date(exam.completedAt) > new Date(existing.lastAttemptDate)) {
                existing.latestScore = score;
                existing.lastAttemptDate = exam.completedAt;
                progressRebuilt = true;
              }
            }
          }
        });
        
        if (progressRebuilt) {
          changes.push(`Mock試験履歴から進捗データを再構築しました`);
        }
      }

      // データを保存
      if (changes.length > 0) {
        safeLocalStorage.setItem(userProgressKey, progress);
        
        return {
          success: true,
          message: `復習データの修復が完了しました`,
          originalData,
          repairedData: progress,
          changes
        };
      }

      return {
        success: true,
        message: 'データは既に最新形式です',
        originalData,
        repairedData: progress,
        changes: []
      };

    } catch (error) {
      console.error('復習データ修復エラー:', error);
      return {
        success: false,
        message: `エラーが発生しました: ${error}`
      };
    }
  }

  /**
   * すべてのユーザーの復習データを修復
   */
  static async repairAllUsersReviewData(): Promise<{
    totalUsers: number;
    successCount: number;
    failedUsers: string[];
    results: any[];
  }> {
    const results: any[] = [];
    const failedUsers: string[] = [];
    let successCount = 0;

    // すべてのlocalStorageキーを取得
    const allKeys = Object.keys(localStorage);
    const userProgressKeys = allKeys.filter(key => key.includes('userProgress_'));
    
    for (const key of userProgressKeys) {
      const nickname = key.replace('userProgress_', '');
      if (nickname && nickname !== 'userProgress_') {
        const result = this.repairUserReviewData(nickname);
        results.push({
          nickname,
          ...result
        });
        
        if (result.success) {
          successCount++;
        } else {
          failedUsers.push(nickname);
        }
      }
    }

    return {
      totalUsers: userProgressKeys.length,
      successCount,
      failedUsers,
      results
    };
  }

  /**
   * 復習データの統計情報を取得
   */
  static getReviewDataStats(nickname?: string): {
    totalIncorrect: number;
    categoryIncorrect: number;
    mockIncorrect: number;
    legacyMockIncorrect: number;
    totalOvercome: number;
    dataIntegrated: boolean;
  } | null {
    try {
      if (!nickname) {
        const authUser = safeLocalStorage.getItem<any>('authUser');
        if (!authUser?.nickname) {
          return null;
        }
        nickname = authUser.nickname;
      }

      const userProgressKey = getUserKey('userProgress', nickname);
      const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      
      if (!progress) {
        return null;
      }

      const categoryIncorrect = progress.incorrectQuestions?.filter(
        q => q.source === 'category' || !q.source
      ).length || 0;
      
      const mockIncorrect = progress.incorrectQuestions?.filter(
        q => q.source === 'mock'
      ).length || 0;

      const legacyMockIncorrect = progress.mockIncorrectQuestions?.length || 0;
      const totalOvercome = progress.overcomeQuestions?.length || 0;

      // データが統合されているかチェック
      const dataIntegrated = mockIncorrect > 0 || 
        (legacyMockIncorrect === 0) || 
        (progress.incorrectQuestions?.some(q => q.source === 'mock') || false);

      return {
        totalIncorrect: (progress.incorrectQuestions?.length || 0),
        categoryIncorrect,
        mockIncorrect,
        legacyMockIncorrect,
        totalOvercome,
        dataIntegrated
      };
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      return null;
    }
  }
}

// ブラウザコンソール用のグローバル関数
if (typeof window !== 'undefined') {
  (window as any).repairMyReviewData = () => {
    const result = ReviewDataRepairTool.repairUserReviewData();
    console.log('復習データ修復結果:', result);
    if (result.changes && result.changes.length > 0) {
      console.log('変更内容:');
      result.changes.forEach(change => console.log(`  - ${change}`));
    }
    return result;
  };

  (window as any).repairAllReviewData = async () => {
    const result = await ReviewDataRepairTool.repairAllUsersReviewData();
    console.log('全ユーザー復習データ修復結果:', result);
    return result;
  };

  (window as any).reviewDataStats = () => {
    const stats = ReviewDataRepairTool.getReviewDataStats();
    if (stats) {
      console.log('復習データ統計:');
      console.log(`  総間違い数: ${stats.totalIncorrect}問`);
      console.log(`  - カテゴリ学習: ${stats.categoryIncorrect}問`);
      console.log(`  - Mock試験: ${stats.mockIncorrect}問`);
      console.log(`  - 旧Mock形式: ${stats.legacyMockIncorrect}問`);
      console.log(`  克服済み: ${stats.totalOvercome}問`);
      console.log(`  データ統合済み: ${stats.dataIntegrated ? 'はい' : 'いいえ'}`);
    }
    return stats;
  };
}