import { Question, IncorrectQuestion, UserProgress, OvercomeQuestion, Category, MockCategoryProgress } from "@/types";
import { safeLocalStorage, getUserKey } from './storage-utils';
import { categories } from './category-utils';
import { filterByIncorrect, selectRandom, excludeAnswered, sortByGlobalId } from './question-filters';

// 間違えた問題を保存
export function saveIncorrectQuestion(
  questionId: string, 
  category: string, 
  userNickname?: string,
  source: 'category' | 'mock' = 'category',
  mockNumber?: number
) {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    let progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress) {
      // progressが存在しない場合は初期化
      const initialCategoryProgress: Partial<Record<Category, any>> = {};
      categories.forEach(category => {
        initialCategoryProgress[category.name] = {
          totalQuestions: category.totalQuestions,
          answeredQuestions: 0,
          correctAnswers: 0
        };
      });
      
      progress = {
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        categoryProgress: initialCategoryProgress as Record<Category, any>,
        studySessions: [],
        incorrectQuestions: [],
        overcomeQuestions: [],
        currentStreak: 0,
        lastStudyDate: "",
        preferences: {
          showJapaneseInStudy: true,
          showJapaneseInMock: false,
          autoReviewIncorrect: true,
          notificationEnabled: false
        }
      };
    }
    
    // incorrectQuestionsが未定義の場合は初期化
    if (!progress.incorrectQuestions) {
      progress.incorrectQuestions = [];
    }
    
    // overcomeQuestionsから削除（再度間違えた場合）
    if (progress.overcomeQuestions) {
      const overcomeIndex = progress.overcomeQuestions.findIndex(
        q => q.questionId === questionId
      );
      if (overcomeIndex >= 0) {
        // 克服済みから削除（再度間違えたため）
        progress.overcomeQuestions.splice(overcomeIndex, 1);
        console.log(`Question ${questionId} removed from overcome list (answered incorrectly again)`);
      }
    }
  
    // 既存の間違えた問題を探す
    const existingIndex = progress.incorrectQuestions.findIndex(
      q => q.questionId === questionId
    );

    if (existingIndex >= 0) {
      // 既に存在する場合は更新
      progress.incorrectQuestions[existingIndex].incorrectCount++;
      progress.incorrectQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
      
      // sourceフィールドも更新（Mock試験が優先）
      // Mock試験で間違えた場合、または既存がMock以外の場合は更新
      if (source === 'mock' || progress.incorrectQuestions[existingIndex].source !== 'mock') {
        progress.incorrectQuestions[existingIndex].source = source;
        progress.incorrectQuestions[existingIndex].mockNumber = mockNumber;
      }
    } else {
      // 新規追加
      const newIncorrect: IncorrectQuestion = {
        questionId,
        category: category as any,
        incorrectCount: 1,
        lastIncorrectDate: new Date().toISOString(),
        reviewCount: 0,
        source,
        mockNumber
      };
      progress.incorrectQuestions.push(newIncorrect);
    }

    safeLocalStorage.setItem(userProgressKey, progress);
  } catch (error) {
    console.error('Error saving incorrect question:', error);
    // Don't throw - this is not critical for the user experience
  }
}

// 間違えた問題から復習用の問題を取得（カテゴリ別・Mock試験両対応）
export function getReviewQuestions(
  allQuestions: Question[], 
  count: number = 10, 
  userNickname?: string,
  reviewType: 'category' | 'mock' | 'all' = 'all'
): Question[] {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress) return [];

    let incorrectQuestions: IncorrectQuestion[] = [];
    
    // incorrectQuestionsからフィルタリング（統合データ使用）
    if (reviewType === 'category') {
      // カテゴリ学習の間違いのみ
      incorrectQuestions = (progress.incorrectQuestions || []).filter(
        q => q.source !== 'mock'
      );
    } else if (reviewType === 'mock') {
      // Mock試験の間違いのみ
      incorrectQuestions = (progress.incorrectQuestions || []).filter(
        q => q.source === 'mock'
      );
      
      // 互換性のため、古いmockIncorrectQuestionsからも取得
      if (progress.mockIncorrectQuestions && progress.mockIncorrectQuestions.length > 0) {
        const mockIncorrect = progress.mockIncorrectQuestions.map(mq => ({
          questionId: mq.questionId,
          category: mq.category,
          incorrectCount: mq.incorrectCount,
          lastIncorrectDate: mq.lastIncorrectDate,
          reviewCount: mq.reviewCount,
          source: 'mock' as const,
          mockNumber: mq.mockNumber
        }));
        // 重複を避けるため、IDでフィルタリング
        const existingIds = new Set(incorrectQuestions.map(q => q.questionId));
        mockIncorrect.forEach(q => {
          if (!existingIds.has(q.questionId)) {
            incorrectQuestions.push(q);
          }
        });
      }
    } else {
      // すべての間違えた問題
      incorrectQuestions = progress.incorrectQuestions || [];
      
      // 互換性のため、古いmockIncorrectQuestionsからも統合
      if (progress.mockIncorrectQuestions && progress.mockIncorrectQuestions.length > 0) {
        const mockIncorrect = progress.mockIncorrectQuestions.map(mq => ({
          questionId: mq.questionId,
          category: mq.category,
          incorrectCount: mq.incorrectCount,
          lastIncorrectDate: mq.lastIncorrectDate,
          reviewCount: mq.reviewCount,
          source: 'mock' as const,
          mockNumber: mq.mockNumber
        }));
        const existingIds = new Set(incorrectQuestions.map(q => q.questionId));
        mockIncorrect.forEach(q => {
          if (!existingIds.has(q.questionId)) {
            incorrectQuestions.push(q);
          }
        });
      }
    }

    if (incorrectQuestions.length === 0) return [];

    // 間違えた回数と最後に間違えた日付でソート（優先度高い順）
    const sortedIncorrect = [...incorrectQuestions].sort((a, b) => {
      // まず間違えた回数で比較
      if (b.incorrectCount !== a.incorrectCount) {
        return b.incorrectCount - a.incorrectCount;
      }
      // 次に最後に間違えた日付で比較（新しい順）
      return new Date(b.lastIncorrectDate).getTime() - new Date(a.lastIncorrectDate).getTime();
    });

    // question-filtersを使用して間違えた問題のみをフィルタリング
    const incorrectQuestionsFiltered = filterByIncorrect(allQuestions, sortedIncorrect);
    
    // 必要な数だけ返す
    return incorrectQuestionsFiltered.slice(0, count);
  } catch (error) {
    console.error('Error in getReviewQuestions:', error);
    return [];
  }
}

// カテゴリから10問をランダムに選択（間違えた問題を優先的に含める）
export function getRandomQuestionsForCategory(
  categoryQuestions: Question[],
  incorrectQuestions: IncorrectQuestion[] = [],
  count: number = 10
): Question[] {
  // 引数の検証
  if (!categoryQuestions || categoryQuestions.length === 0) {
    return [];
  }
  
  // incorrectQuestionsがundefinedやnullの場合は空配列として扱う
  const safeIncorrectQuestions = incorrectQuestions || [];
  
  // カテゴリ内の間違えた問題を取得
  const categoryIncorrectIds = safeIncorrectQuestions
    .filter(iq => categoryQuestions.some(q => q.questionId === iq.questionId))
    .map(iq => iq.questionId);

  const incorrectQuestionsInCategory = categoryQuestions.filter(
    q => categoryIncorrectIds.includes(q.questionId)
  );
  const correctQuestionsInCategory = categoryQuestions.filter(
    q => !categoryIncorrectIds.includes(q.questionId)
  );

  // 間違えた問題から最大3問まで含める
  const incorrectCount = Math.min(3, incorrectQuestionsInCategory.length);
  const selectedIncorrect = selectRandom(incorrectQuestionsInCategory, incorrectCount);

  // 残りを正解した問題から選択
  const remainingCount = count - selectedIncorrect.length;
  const selectedCorrect = selectRandom(correctQuestionsInCategory, remainingCount);

  // 混ぜて返す
  return selectRandom([...selectedIncorrect, ...selectedCorrect], count);
}

// Mock試験用の問題を取得
export function getMockQuestions(
  categoryQuestions: Question[],
  mode: "mock25" | "mock75",
  part?: 1 | 2 | 3
): Question[] {
  if (mode === "mock75") {
    // 75問モードは全問題を順序通り返す（シャッフルしない）
    return [...categoryQuestions];
  }
  
  // 25問モード：パートごとに分割
  if (mode === "mock25" && part) {
    const questionsPerPart = 25;
    const startIndex = (part - 1) * questionsPerPart;
    const endIndex = startIndex + questionsPerPart;
    
    // パートの範囲内の問題を取得（順序を保持）
    const partQuestions = categoryQuestions.slice(startIndex, endIndex);
    
    // 問題数が足りない場合は、利用可能な問題をすべて返す
    if (partQuestions.length < questionsPerPart) {
      return partQuestions;
    }
    
    return partQuestions;
  }
  
  // デフォルト: 最初の25問を返す
  return categoryQuestions.slice(0, 25);
}


// 復習回数を更新
export function updateReviewCount(questionId: string, userNickname?: string) {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress || !progress.incorrectQuestions) return;
    
    const incorrect = progress.incorrectQuestions.find(q => q.questionId === questionId);
  
    if (incorrect) {
      incorrect.reviewCount++;
      safeLocalStorage.setItem(userProgressKey, progress);
    }
  } catch (error) {
    console.error('Error updating review count:', error);
    // Don't throw - this is not critical for the user experience
  }
}

// 復習モードで正解した問題を克服フォルダに移動（Mock/カテゴリ両対応）
export function moveToOvercomeQuestions(questionId: string, mode: string, userNickname?: string) {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress) return false;
    
    console.log('🎯 Overcome Check:', {
      questionId,
      mode,
      incorrectCount: progress.incorrectQuestions?.length || 0,
      overcomeCount: progress.overcomeQuestions?.length || 0
    });
    
    // 復習モードでない場合は何もしない
    if (mode !== 'review') return false;
    
    // incorrectQuestionsから該当の問題を探す（統合データ構造）
    const incorrectIndex = progress.incorrectQuestions?.findIndex(q => q.questionId === questionId) ?? -1;
    if (incorrectIndex === -1) return false;
    
    const incorrectQuestion = progress.incorrectQuestions[incorrectIndex];
    
    // overcomeQuestionsが未定義の場合は初期化
    if (!progress.overcomeQuestions) {
      progress.overcomeQuestions = [];
    }
    
    // 克服した問題として記録
    const overcomeQuestion: OvercomeQuestion = {
      questionId: incorrectQuestion.questionId,
      category: incorrectQuestion.category,
      overcomeDate: new Date().toISOString(),
      previousIncorrectCount: incorrectQuestion.incorrectCount,
      reviewCount: incorrectQuestion.reviewCount
    };
    
    // overcomeQuestionsに追加
    progress.overcomeQuestions.push(overcomeQuestion);
    
    // incorrectQuestionsから削除
    progress.incorrectQuestions.splice(incorrectIndex, 1);
    
    // Mock試験由来の問題の場合、mockOvercomeQuestionsにも追加（互換性のため）
    if (incorrectQuestion.source === 'mock') {
      if (!progress.mockOvercomeQuestions) {
        progress.mockOvercomeQuestions = [];
      }
      progress.mockOvercomeQuestions.push(overcomeQuestion);
      
      // mockIncorrectQuestionsからも削除（互換性のため）
      if (progress.mockIncorrectQuestions) {
        const mockIndex = progress.mockIncorrectQuestions.findIndex(q => q.questionId === questionId);
        if (mockIndex >= 0) {
          progress.mockIncorrectQuestions.splice(mockIndex, 1);
        }
      }
    }
    
    // 保存
    safeLocalStorage.setItem(userProgressKey, progress);
    
    console.log('✅ Question overcome successfully:', {
      questionId,
      source: incorrectQuestion.source,
      newIncorrectCount: progress.incorrectQuestions.length,
      newOvercomeCount: progress.overcomeQuestions.length
    });
    
    return true;
  } catch (error) {
    console.error('Error moving to overcome questions:', error);
    return false;
  }
}

// カテゴリ別学習で順番に出題するための関数
export function getSequentialQuestionsForCategory(
  categoryQuestions: Question[],
  answeredQuestionIds: string[],
  count: number = 10
): Question[] {
  // 回答済みの問題を除外
  const unansweredQuestions = excludeAnswered(categoryQuestions, answeredQuestionIds);
  
  // globalIdでソートして最初から順番に取得
  const sortedQuestions = sortByGlobalId(unansweredQuestions, 'asc');
  
  return sortedQuestions.slice(0, count);
}

// カテゴリの回答済み問題IDを取得
export function getAnsweredQuestionIds(category: string, userNickname?: string): string[] {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress || !progress.studySessions) return [];
    
    const answeredIds = new Set<string>();
    
    // すべてのセッションから該当カテゴリの回答済み問題を収集
    progress.studySessions.forEach(session => {
      if (session.category === category && session.answers) {
        session.answers.forEach(answer => {
          answeredIds.add(answer.questionId);
        });
      }
    });
    
    return Array.from(answeredIds);
  } catch (error) {
    console.error('Error getting answered question IDs:', error);
    return [];
  }
}

// Mock試験の結果を進捗に反映（Part情報対応版）
export function updateMockExamProgress(
  category: Category, 
  score: number, 
  totalQuestions: number, 
  userNickname?: string,
  part?: number, // Part情報を追加（1-3 または undefined）
  correctAnswers?: number // 正解数も追加
) {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    let progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress) return;

    // mockCategoryProgressが未定義の場合は初期化（Partial型として）
    if (!progress.mockCategoryProgress) {
      progress.mockCategoryProgress = {};
    }

    // 該当カテゴリのみ初期化（全カテゴリ初期化は不要）
    if (!progress.mockCategoryProgress[category]) {
      const categoryData = categories.find(c => c.name === category);
      progress.mockCategoryProgress[category] = {
        totalQuestions: categoryData?.totalQuestions || 75,
        attemptsCount: 0,
        bestScore: 0,
        latestScore: 0,
        averageScore: 0,
        passedCount: 0,
        lastAttemptDate: new Date().toISOString(),
        partProgress: {}
      };
    }

    const currentProgress = progress.mockCategoryProgress[category]!;
    const passed = score >= 70;
    const currentDate = new Date().toISOString();

    // Part情報がある場合（25問モード）、Part別の進捗を記録
    if (part !== undefined && part >= 1 && part <= 3) {
      if (!currentProgress.partProgress) {
        currentProgress.partProgress = {};
      }
      currentProgress.partProgress[part] = {
        attempted: true,
        score,
        questionCount: totalQuestions,
        date: currentDate,
        correctAnswers: correctAnswers || Math.round((score / 100) * totalQuestions)
      };

      // 全Partの進捗から総合スコアを計算
      let totalScore = 0;
      let totalQuestionsAnswered = 0;
      for (let p = 1; p <= 3; p++) {
        const partData = currentProgress.partProgress[p];
        if (partData) {
          totalScore += partData.correctAnswers;
          totalQuestionsAnswered += partData.questionCount;
        }
      }
      
      // 全体のスコアを更新（受験済みPartのみから計算）
      if (totalQuestionsAnswered > 0) {
        score = Math.round((totalScore / totalQuestionsAnswered) * 100);
      }
    }

    if (currentProgress) {
      // 既存の進捗を更新
      const newAttemptsCount = currentProgress.attemptsCount + 1;
      const newBestScore = Math.max(currentProgress.bestScore, score);
      const newPassedCount = currentProgress.passedCount + (passed ? 1 : 0);
      
      // 平均スコアを計算
      const newAverageScore = Math.round(
        ((currentProgress.averageScore * currentProgress.attemptsCount) + score) / newAttemptsCount
      );

      progress.mockCategoryProgress[category] = {
        ...currentProgress, // 既存のpartProgressを保持
        totalQuestions,
        attemptsCount: newAttemptsCount,
        bestScore: newBestScore,
        latestScore: score,
        averageScore: newAverageScore,
        passedCount: newPassedCount,
        lastAttemptDate: currentDate
      };
    } else {
      // 新規の進捗を作成
      progress.mockCategoryProgress[category] = {
        totalQuestions,
        attemptsCount: 1,
        bestScore: score,
        latestScore: score,
        averageScore: score,
        passedCount: passed ? 1 : 0,
        lastAttemptDate: currentDate
      };
    }

    safeLocalStorage.setItem(userProgressKey, progress);
    console.log(`Mock exam progress updated for ${category}: ${score}% (${passed ? 'PASSED' : 'FAILED'})`);
  } catch (error) {
    console.error('Error updating mock exam progress:', error);
  }
}

// Mock試験のカテゴリかどうかを判定
export function isMockCategory(category: Category): boolean {
  return category.includes('Mock') || category.includes('Final Study Questions');
}

// Mock試験の進捗情報を取得
export function getMockCategoryProgress(category: Category, userNickname?: string): MockCategoryProgress | null {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress?.mockCategoryProgress) return null;
    
    return progress.mockCategoryProgress[category] || null;
  } catch (error) {
    console.error('Error getting mock category progress:', error);
    return null;
  }
}