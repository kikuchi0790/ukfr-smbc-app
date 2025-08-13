import { UserProgress, CategoryProgress, StudySession, IncorrectQuestion } from '@/types';

// 日付を持つアイテムのインターフェース
export interface DateItem {
  date: string;
  [key: string]: any;
}

// ユニークキーを持つアイテムのインターフェース
export interface UniqueItem {
  id: string;
  [key: string]: any;
}

export class DataMerger {
  /**
   * 日付ベースで配列をマージする汎用メソッド
   * 新しいアイテムを優先し、重複を除去する
   */
  static mergeByDate<T extends DateItem>(
    local: T[],
    remote: T[],
    uniqueKey?: keyof T
  ): T[] {
    // 両方の配列を結合
    const combined = [...local, ...remote];
    
    // ユニークキーが指定されている場合は重複を除去
    if (uniqueKey) {
      const seen = new Set<any>();
      const unique: T[] = [];
      
      // 新しい順にソート（日付の降順）
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      for (const item of combined) {
        const key = item[uniqueKey];
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }
      
      return unique;
    }
    
    // ユニークキーがない場合は日付でソートして返す
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * IDベースで配列をマージする汎用メソッド
   * 重複を除去し、ユニークなアイテムのみを返す
   */
  static mergeById<T extends UniqueItem>(
    local: T[],
    remote: T[],
    preferRemote: boolean = false
  ): T[] {
    const map = new Map<string, T>();
    
    // preferRemoteがfalseの場合はローカルを先に、trueの場合はリモートを先に追加
    const first = preferRemote ? remote : local;
    const second = preferRemote ? local : remote;
    
    // 最初の配列を追加
    for (const item of first) {
      map.set(item.id, item);
    }
    
    // 2番目の配列を追加（既存のものは上書きしない）
    for (const item of second) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    
    return Array.from(map.values());
  }

  /**
   * 数値の合計をマージする
   */
  static mergeNumbers(local: number, remote: number, operation: 'sum' | 'max' | 'min' = 'sum'): number {
    switch (operation) {
      case 'sum':
        return local + remote;
      case 'max':
        return Math.max(local, remote);
      case 'min':
        return Math.min(local, remote);
      default:
        return local;
    }
  }

  /**
   * カテゴリプログレスをマージする
   * 重複カウントを防ぐため、合算ではなく最大値を取る方式に変更
   */
  static mergeCategoryProgress(
    local: Record<string, CategoryProgress>,
    remote: Record<string, CategoryProgress>
  ): Record<string, CategoryProgress> {
    const merged: Record<string, CategoryProgress> = { ...local };
    
    for (const [category, remoteProgress] of Object.entries(remote)) {
      if (merged[category]) {
        // 既存のカテゴリがある場合は最大値を取る（重複カウント防止）
        // これにより、同じ問題が複数回カウントされることを防ぐ
        merged[category] = {
          totalQuestions: Math.max(merged[category].totalQuestions, remoteProgress.totalQuestions),
          // 回答済み問題数と正解数は最大値を取る（同期時の重複を防ぐ）
          answeredQuestions: Math.max(merged[category].answeredQuestions, remoteProgress.answeredQuestions),
          correctAnswers: Math.max(merged[category].correctAnswers, remoteProgress.correctAnswers)
        };
      } else {
        // 新しいカテゴリの場合はそのまま追加
        merged[category] = remoteProgress;
      }
    }
    
    return merged;
  }

  /**
   * 間違えた問題をマージする
   */
  static mergeIncorrectQuestions(
    local: IncorrectQuestion[],
    remote: IncorrectQuestion[]
  ): IncorrectQuestion[] {
    const map = new Map<string, IncorrectQuestion>();
    
    // 両方の配列を結合し、最新の日付を優先
    const combined = [...local, ...remote];
    
    for (const question of combined) {
      const existing = map.get(question.questionId);
      if (!existing || new Date(question.lastIncorrectDate) > new Date(existing.lastIncorrectDate)) {
        map.set(question.questionId, question);
      }
    }
    
    // 日付の降順でソート
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastIncorrectDate).getTime() - new Date(a.lastIncorrectDate).getTime()
    );
  }

  /**
   * 克服した問題をマージする
   */
  static mergeOvercomeQuestions(
    local: any[],
    remote: any[]
  ): any[] {
    const map = new Map<string, any>();
    
    // 両方の配列を結合し、最新の日付を優先
    const combined = [...local, ...remote];
    
    for (const question of combined) {
      const existing = map.get(question.questionId);
      const dateField = question.overcomeDate || question.date || question.lastIncorrectDate;
      const existingDateField = existing?.overcomeDate || existing?.date || existing?.lastIncorrectDate;
      
      if (!existing || (dateField && existingDateField && new Date(dateField) > new Date(existingDateField))) {
        map.set(question.questionId, question);
      }
    }
    
    // 日付の降順でソート
    return Array.from(map.values()).sort((a, b) => {
      const aDate = a.overcomeDate || a.date || a.lastIncorrectDate;
      const bDate = b.overcomeDate || b.date || b.lastIncorrectDate;
      return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
    });
  }

  /**
   * 学習セッションをマージする
   */
  static mergeStudySessions(
    local: StudySession[],
    remote: StudySession[]
  ): StudySession[] {
    return this.mergeByDate(
      local.map(s => ({ ...s, date: s.startedAt })),
      remote.map(s => ({ ...s, date: s.startedAt })),
      'id'
    );
  }

  /**
   * Mock試験履歴をマージする（mockExamHistoryがある場合）
   */
  static mergeMockExamHistory(
    local: any[],
    remote: any[]
  ): any[] {
    return this.mergeByDate(
      local.map(h => ({ ...h, date: h.completedAt || h.date })),
      remote.map(h => ({ ...h, date: h.completedAt || h.date })),
      'id'
    );
  }

  /**
   * 完全なUserProgressをマージする
   */
  static mergeProgress(local: UserProgress, remote: UserProgress): UserProgress {
    // 基本的な数値フィールドのマージ
    const totalQuestionsAnswered = this.mergeNumbers(
      local.totalQuestionsAnswered || 0,
      remote.totalQuestionsAnswered || 0,
      'sum'
    );
    
    const correctAnswers = this.mergeNumbers(
      local.correctAnswers || 0,
      remote.correctAnswers || 0,
      'sum'
    );
    
    // 日付の比較でより新しい方を採用
    const lastStudyDate = new Date(local.lastStudyDate) > new Date(remote.lastStudyDate)
      ? local.lastStudyDate
      : remote.lastStudyDate;
    
    // ストリークの計算
    const currentStreak = this.mergeNumbers(
      local.currentStreak || 0,
      remote.currentStreak || 0,
      'max'
    );
    
    const bestStreak = this.mergeNumbers(
      local.bestStreak || 0,
      remote.bestStreak || 0,
      'max'
    );
    
    return {
      totalQuestionsAnswered,
      correctAnswers,
      categoryProgress: this.mergeCategoryProgress(
        local.categoryProgress || {},
        remote.categoryProgress || {}
      ),
      studySessions: this.mergeStudySessions(
        local.studySessions || [],
        remote.studySessions || []
      ),
      incorrectQuestions: this.mergeIncorrectQuestions(
        local.incorrectQuestions || [],
        remote.incorrectQuestions || []
      ),
      overcomeQuestions: this.mergeOvercomeQuestions(
        local.overcomeQuestions || [],
        remote.overcomeQuestions || []
      ),
      currentStreak,
      bestStreak,
      lastStudyDate,
      preferences: {
        ...local.preferences,
        ...remote.preferences // リモートの設定を優先
      }
    };
  }

  /**
   * 配列の重複を除去するヘルパーメソッド
   */
  static deduplicateArray<T>(
    array: T[],
    keySelector: (item: T) => string | number
  ): T[] {
    const seen = new Set<string | number>();
    const result: T[] = [];
    
    for (const item of array) {
      const key = keySelector(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    
    return result;
  }

  /**
   * 日付範囲でフィルタリングするヘルパーメソッド
   */
  static filterByDateRange<T extends DateItem>(
    items: T[],
    startDate?: Date,
    endDate?: Date
  ): T[] {
    return items.filter(item => {
      const itemDate = new Date(item.date);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      return true;
    });
  }
}