/**
 * 間違い問題のsourceフィールド修復ツール
 * Mock試験で間違えた問題のsourceが正しく設定されていない問題を修正
 */

import { UserProgress, StudySession } from '@/types';
import { safeLocalStorage, getUserKey } from './storage-utils';

/**
 * 間違い問題のsourceフィールドを修復
 * @param userNickname ユーザーのニックネーム
 * @returns 修復結果のレポート
 */
export function repairIncorrectQuestionsSource(userNickname?: string): {
  success: boolean;
  report: string;
  fixed: number;
  total: number;
} {
  try {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!progress) {
      return {
        success: false,
        report: 'ユーザーデータが見つかりません',
        fixed: 0,
        total: 0
      };
    }

    if (!progress.incorrectQuestions || progress.incorrectQuestions.length === 0) {
      return {
        success: true,
        report: '修復が必要な間違い問題がありません',
        fixed: 0,
        total: 0
      };
    }

    // StudySessionsからMock試験で間違えた問題を特定
    const mockIncorrectIds = new Map<string, { mockNumber: number; date: string }>();
    
    if (progress.studySessions) {
      progress.studySessions.forEach((session: StudySession) => {
        // Mock試験かどうか判定
        const isMock = session.category && /Mock \d+/.test(session.category);
        if (!isMock) return;
        
        // Mock番号を抽出
        const mockMatch = session.category?.match(/Mock (\d+)/);
        const mockNumber = mockMatch ? parseInt(mockMatch[1]) : undefined;
        
        // 間違えた問題を特定
        session.answers?.forEach((answer, index) => {
          if (!answer.isCorrect && answer.questionId) {
            const existingEntry = mockIncorrectIds.get(answer.questionId);
            const sessionDate = session.completedAt || session.startedAt;
            
            // より新しいMock試験の結果を優先
            if (!existingEntry || new Date(sessionDate) > new Date(existingEntry.date)) {
              mockIncorrectIds.set(answer.questionId, {
                mockNumber: mockNumber || 0,
                date: sessionDate
              });
            }
          }
        });
      });
    }

    // 間違い問題のsourceフィールドを修復
    let fixedCount = 0;
    const totalCount = progress.incorrectQuestions.length;
    
    progress.incorrectQuestions.forEach(incorrectQuestion => {
      const mockInfo = mockIncorrectIds.get(incorrectQuestion.questionId);
      
      if (mockInfo && incorrectQuestion.source !== 'mock') {
        // Mock試験で間違えているのにsourceがmockでない場合は修正
        incorrectQuestion.source = 'mock';
        incorrectQuestion.mockNumber = mockInfo.mockNumber;
        fixedCount++;
        console.log(`Fixed: ${incorrectQuestion.questionId} - source changed to 'mock' (Mock ${mockInfo.mockNumber})`);
      } else if (!mockInfo && incorrectQuestion.source === 'mock') {
        // Mock試験で間違えていないのにsourceがmockの場合は修正
        incorrectQuestion.source = 'category';
        incorrectQuestion.mockNumber = undefined;
        fixedCount++;
        console.log(`Fixed: ${incorrectQuestion.questionId} - source changed to 'category'`);
      }
    });

    // 修復したデータを保存
    if (fixedCount > 0) {
      safeLocalStorage.setItem(userProgressKey, progress);
    }

    const report = `
修復完了レポート:
- 検査した間違い問題: ${totalCount}問
- 修正した問題: ${fixedCount}問
- Mock試験の間違い: ${Array.from(mockIncorrectIds.keys()).length}問
- 修復率: ${totalCount > 0 ? Math.round((fixedCount / totalCount) * 100) : 0}%
    `.trim();

    return {
      success: true,
      report,
      fixed: fixedCount,
      total: totalCount
    };
  } catch (error) {
    console.error('Error repairing incorrect questions:', error);
    return {
      success: false,
      report: `エラーが発生しました: ${error}`,
      fixed: 0,
      total: 0
    };
  }
}

/**
 * すべてのユーザーの間違い問題を修復
 * @returns 修復結果のサマリー
 */
export function repairAllUsersIncorrectQuestions(): {
  success: boolean;
  summary: string;
  totalFixed: number;
  totalQuestions: number;
  userReports: Array<{ nickname: string; fixed: number; total: number }>;
} {
  const userReports: Array<{ nickname: string; fixed: number; total: number }> = [];
  let totalFixed = 0;
  let totalQuestions = 0;

  try {
    // LocalStorageからすべてのuserProgressキーを取得
    const allKeys = Object.keys(localStorage);
    const userProgressKeys = allKeys.filter(key => key.includes('userProgress_'));
    
    if (userProgressKeys.length === 0) {
      return {
        success: false,
        summary: 'ユーザーデータが見つかりません',
        totalFixed: 0,
        totalQuestions: 0,
        userReports: []
      };
    }

    userProgressKeys.forEach(key => {
      // ユーザーニックネームを抽出
      const nickname = key.replace('userProgress_', '');
      const result = repairIncorrectQuestionsSource(nickname);
      
      if (result.success) {
        userReports.push({
          nickname,
          fixed: result.fixed,
          total: result.total
        });
        totalFixed += result.fixed;
        totalQuestions += result.total;
      }
    });

    const summary = `
全ユーザー修復サマリー:
- 修復したユーザー数: ${userReports.length}人
- 修正した問題の総数: ${totalFixed}問
- 検査した問題の総数: ${totalQuestions}問
- 全体修復率: ${totalQuestions > 0 ? Math.round((totalFixed / totalQuestions) * 100) : 0}%
    `.trim();

    return {
      success: true,
      summary,
      totalFixed,
      totalQuestions,
      userReports
    };
  } catch (error) {
    console.error('Error repairing all users:', error);
    return {
      success: false,
      summary: `エラーが発生しました: ${error}`,
      totalFixed: 0,
      totalQuestions: 0,
      userReports: []
    };
  }
}

// ブラウザコンソール用のグローバル関数として公開
if (typeof window !== 'undefined') {
  (window as any).repairMyIncorrectQuestions = () => {
    const user = JSON.parse(localStorage.getItem('authUser') || '{}');
    const result = repairIncorrectQuestionsSource(user.nickname);
    console.log(result.report);
    return result;
  };

  (window as any).repairAllIncorrectQuestions = () => {
    const result = repairAllUsersIncorrectQuestions();
    console.log(result.summary);
    result.userReports.forEach(report => {
      console.log(`- ${report.nickname}: ${report.fixed}/${report.total}問を修正`);
    });
    return result;
  };

  (window as any).checkIncorrectQuestionsStatus = () => {
    const user = JSON.parse(localStorage.getItem('authUser') || '{}');
    const userProgressKey = getUserKey('userProgress', user.nickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!progress || !progress.incorrectQuestions) {
      console.log('間違い問題データがありません');
      return;
    }

    const categoryCount = progress.incorrectQuestions.filter(q => q.source !== 'mock').length;
    const mockCount = progress.incorrectQuestions.filter(q => q.source === 'mock').length;
    const noSourceCount = progress.incorrectQuestions.filter(q => !q.source).length;
    
    console.log(`
間違い問題の状態:
- カテゴリ学習: ${categoryCount}問
- Mock試験: ${mockCount}問
- sourceなし: ${noSourceCount}問
- 合計: ${progress.incorrectQuestions.length}問
    `.trim());

    // Mock番号ごとの内訳
    const mockBreakdown = new Map<number, number>();
    progress.incorrectQuestions
      .filter(q => q.source === 'mock' && q.mockNumber)
      .forEach(q => {
        const count = mockBreakdown.get(q.mockNumber!) || 0;
        mockBreakdown.set(q.mockNumber!, count + 1);
      });
    
    if (mockBreakdown.size > 0) {
      console.log('\nMock試験別内訳:');
      Array.from(mockBreakdown.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([mockNumber, count]) => {
          console.log(`- Mock ${mockNumber}: ${count}問`);
        });
    }
  };

  console.log(`
🔧 間違い問題修復ツールが利用可能です:

1. 自分のデータを修復:
   repairMyIncorrectQuestions()

2. すべてのユーザーのデータを修復:
   repairAllIncorrectQuestions()

3. 現在の状態を確認:
   checkIncorrectQuestionsStatus()
  `.trim());
}