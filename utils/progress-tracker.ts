import { UserProgress, Question, Category, StudySession } from '@/types';
import { safeLocalStorage, getUserKey } from './storage-utils';

/**
 * 進捗追跡とデバッグのためのユーティリティ
 * カウントの不整合を検出・修正するための機能を提供
 */

export interface ProgressStats {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  overcomeCount: number;
  categoryStats: Record<Category, {
    answered: number;
    correct: number;
    incorrect: number;
  }>;
}

/**
 * StudySessionsから実際の統計を計算
 */
export function calculateActualStats(progress: UserProgress): ProgressStats {
  const stats: ProgressStats = {
    totalAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    overcomeCount: progress.overcomeQuestions?.length || 0,
    categoryStats: {} as Record<Category, any>
  };

  // 各カテゴリの初期化
  const categories: Category[] = [
    "The Regulatory Environment",
    "The Financial Services and Markets Act 2000 and Financial Services Act 2012",
    "Associated Legislation and Regulation",
    "The FCA Conduct of Business Sourcebook/Client Assets",
    "Complaints and Redress",
    "Regulations: Final Study Questions"
  ];

  categories.forEach(cat => {
    stats.categoryStats[cat] = {
      answered: 0,
      correct: 0,
      incorrect: 0
    };
  });

  // 全ての回答を追跡（重複を除外）
  const processedQuestions = new Map<string, {
    isCorrect: boolean;
    category: Category;
  }>();

  // StudySessionsを時系列で処理
  if (progress.studySessions) {
    progress.studySessions.forEach(session => {
      if (session.answers) {
        session.answers.forEach(answer => {
          // 最新の回答結果を保持
          processedQuestions.set(answer.questionId, {
            isCorrect: answer.isCorrect,
            category: session.category as Category
          });
        });
      }
    });
  }

  // 統計を計算
  processedQuestions.forEach((data, questionId) => {
    stats.totalAnswered++;
    
    if (data.isCorrect) {
      stats.totalCorrect++;
    } else {
      stats.totalIncorrect++;
    }

    if (data.category && stats.categoryStats[data.category]) {
      stats.categoryStats[data.category].answered++;
      if (data.isCorrect) {
        stats.categoryStats[data.category].correct++;
      } else {
        stats.categoryStats[data.category].incorrect++;
      }
    }
  });

  return stats;
}

/**
 * 進捗データの整合性をチェックし、修正
 */
export function validateAndFixProgress(progress: UserProgress): {
  isValid: boolean;
  issues: string[];
  fixed: UserProgress;
} {
  const issues: string[] = [];
  const fixed = { ...progress };
  const actualStats = calculateActualStats(progress);

  // 1. 総回答数のチェック
  if (fixed.totalQuestionsAnswered !== actualStats.totalAnswered) {
    issues.push(`総回答数の不一致: 記録=${fixed.totalQuestionsAnswered}, 実際=${actualStats.totalAnswered}`);
    fixed.totalQuestionsAnswered = actualStats.totalAnswered;
  }

  // 2. 総正答数のチェック
  if (fixed.correctAnswers !== actualStats.totalCorrect) {
    issues.push(`総正答数の不一致: 記録=${fixed.correctAnswers}, 実際=${actualStats.totalCorrect}`);
    fixed.correctAnswers = actualStats.totalCorrect;
  }

  // 3. カテゴリ別の整合性チェック
  Object.entries(actualStats.categoryStats).forEach(([category, stats]) => {
    const cat = category as Category;
    const recorded = fixed.categoryProgress[cat];
    
    if (recorded) {
      if (recorded.answeredQuestions !== stats.answered) {
        issues.push(`${cat}の回答数不一致: 記録=${recorded.answeredQuestions}, 実際=${stats.answered}`);
        recorded.answeredQuestions = stats.answered;
      }
      
      if (recorded.correctAnswers !== stats.correct) {
        issues.push(`${cat}の正答数不一致: 記録=${recorded.correctAnswers}, 実際=${stats.correct}`);
        recorded.correctAnswers = stats.correct;
      }
    }
  });

  // 4. 克服問題のチェック
  const overcomeIds = new Set(fixed.overcomeQuestions?.map(q => q.questionId) || []);
  const incorrectIds = new Set(fixed.incorrectQuestions?.map(q => q.questionId) || []);
  
  // 克服済みの問題が間違えた問題リストに残っていないか
  overcomeIds.forEach(id => {
    if (incorrectIds.has(id)) {
      issues.push(`問題${id}が克服済みと間違いリストの両方に存在`);
      // incorrectQuestionsから削除
      fixed.incorrectQuestions = fixed.incorrectQuestions.filter(q => q.questionId !== id);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    fixed
  };
}

/**
 * 問題のステータスを正確に取得
 */
export function getAccurateQuestionStatus(
  questionId: string,
  progress: UserProgress
): {
  answered: boolean;
  correct: boolean;
  incorrect: boolean;
  overcome: boolean;
  lastAnsweredAt?: string;
} {
  const status = {
    answered: false,
    correct: false,
    incorrect: false,
    overcome: false,
    lastAnsweredAt: undefined as string | undefined
  };

  // 克服済みチェック
  if (progress.overcomeQuestions?.some(q => q.questionId === questionId)) {
    status.overcome = true;
    status.answered = true;
    status.correct = true; // 克服済みは必ず正解している
    return status;
  }

  // 最新の回答結果を取得
  let lastAnswer: { isCorrect: boolean; answeredAt: string } | null = null;
  
  if (progress.studySessions) {
    for (const session of progress.studySessions.slice().reverse()) {
      if (session.answers) {
        const answer = session.answers.find(a => a.questionId === questionId);
        if (answer) {
          lastAnswer = {
            isCorrect: answer.isCorrect,
            answeredAt: answer.answeredAt
          };
          break;
        }
      }
    }
  }

  if (lastAnswer) {
    status.answered = true;
    status.correct = lastAnswer.isCorrect;
    status.incorrect = !lastAnswer.isCorrect;
    status.lastAnsweredAt = lastAnswer.answeredAt;
  }

  return status;
}

/**
 * デバッグ用: 進捗データの詳細ログ出力
 */
export function debugProgress(nickname?: string): void {
  const userProgressKey = getUserKey('userProgress', nickname);
  const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
  
  if (!progress) {
    console.log('No progress data found');
    return;
  }

  const actualStats = calculateActualStats(progress);
  const validation = validateAndFixProgress(progress);

  console.group('📊 Progress Debug Information');
  
  console.group('Recorded vs Actual Stats:');
  console.table({
    'Total Answered': {
      Recorded: progress.totalQuestionsAnswered,
      Actual: actualStats.totalAnswered,
      Match: progress.totalQuestionsAnswered === actualStats.totalAnswered ? '✅' : '❌'
    },
    'Total Correct': {
      Recorded: progress.correctAnswers,
      Actual: actualStats.totalCorrect,
      Match: progress.correctAnswers === actualStats.totalCorrect ? '✅' : '❌'
    }
  });
  console.groupEnd();

  console.group('Category Stats:');
  Object.entries(actualStats.categoryStats).forEach(([cat, stats]) => {
    const recorded = progress.categoryProgress[cat as Category];
    console.log(`${cat}:`, {
      recorded: recorded ? `${recorded.answeredQuestions}/${recorded.correctAnswers}` : 'N/A',
      actual: `${stats.answered}/${stats.correct}`,
      match: recorded && 
        recorded.answeredQuestions === stats.answered && 
        recorded.correctAnswers === stats.correct ? '✅' : '❌'
    });
  });
  console.groupEnd();

  console.group('Special Cases:');
  console.log('Overcome Questions:', progress.overcomeQuestions?.length || 0);
  console.log('Incorrect Questions:', progress.incorrectQuestions?.length || 0);
  console.log('Total Sessions:', progress.studySessions?.length || 0);
  console.groupEnd();

  if (!validation.isValid) {
    console.group('⚠️ Issues Found:');
    validation.issues.forEach(issue => console.warn(issue));
    console.groupEnd();
  }

  console.groupEnd();
}

// ブラウザコンソールからアクセスできるようにグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).debugProgress = debugProgress;
  (window as any).fixProgress = (nickname?: string) => {
    const userProgressKey = getUserKey('userProgress', nickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (progress) {
      const validation = validateAndFixProgress(progress);
      if (!validation.isValid) {
        safeLocalStorage.setItem(userProgressKey, validation.fixed);
        console.log('✅ Progress fixed!', validation.issues);
        return validation.fixed;
      } else {
        console.log('✅ Progress is already valid!');
        return progress;
      }
    }
  };
}