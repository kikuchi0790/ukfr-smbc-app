import { StorageService, storage as defaultStorage } from '@/services/storage-service';
import { isNotEmpty, safeJsonParse } from './validation-utils';
import { StorageError } from './error-utils';

// Firebase同期用のコールバック
let syncCallback: ((key: string, data: any) => void) | null = null;

export function setSyncCallback(callback: (key: string, data: any) => void) {
  syncCallback = callback;
}

// ユーザー別のキーを生成するヘルパー関数
export function getUserKey(baseKey: string, nickname?: string | null): string {
  if (!nickname) {
    // 認証情報から現在のユーザーのニックネームを取得
    try {
      const authUser = localStorage.getItem('authUser');
      if (authUser) {
        const parsed = safeJsonParse(authUser, null) as { nickname?: string } | null;
        if (parsed && parsed.nickname) {
          nickname = parsed.nickname;
        }
      }
    } catch (error) {
      console.error('Failed to get auth user from localStorage', error);
    }
  }
  
  // ニックネームがある場合はユーザー別のキーを返す
  return nickname ? `${baseKey}_${nickname}` : baseKey;
}

// 古いデータを削除するヘルパー関数
function cleanupOldData() {
  try {
    const keysToDelete: string[] = [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // すべてのキーをチェック
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // 一時的なMock試験結果（1時間以上前）を削除
      if (key.startsWith('tempMockResult_') || key.startsWith('tempMockQuestions_')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = safeJsonParse(item, null) as any;
            if (parsed) {
              // タイムスタンプをチェック（複数の形式に対応）
              const timestamp = parsed.savedAt || 
                              parsed.session?.completedAt || 
                              parsed.session?.startedAt ||
                              parsed.completedAt ||
                              parsed.startedAt;
              
              if (timestamp) {
                const itemTime = new Date(timestamp).getTime();
                // 1時間以上前のデータのみ削除
                if (itemTime < oneHourAgo) {
                  keysToDelete.push(key);
                  console.log(`Scheduling deletion of old temp data: ${key} (age: ${Math.round((Date.now() - itemTime) / 1000 / 60)} minutes)`);
                }
              } else {
                // タイムスタンプがない古い形式のデータは削除
                keysToDelete.push(key);
                console.log(`Scheduling deletion of temp data without timestamp: ${key}`);
              }
            }
          }
        } catch (error) {
          // パースできない壊れたデータは削除
          keysToDelete.push(key);
          console.log(`Scheduling deletion of corrupted temp data: ${key}`);
        }
      }
      
      // Mock試験の進捗（1日以上前）を削除
      if (key.startsWith('mockExamProgress_')) {
        keysToDelete.push(key);
      }
      
      // userProgressのクリーンアップ
      if (key.startsWith('userProgress_')) {
        try {
          const progressStr = localStorage.getItem(key);
          if (!progressStr) continue;
          const progress = safeJsonParse(progressStr, {}) as any;
          let modified = false;
          
          // studySessionsが存在し、questionsフィールドを含む場合は削除
          if (progress.studySessions && Array.isArray(progress.studySessions)) {
            progress.studySessions = progress.studySessions.map((session: any) => {
              if (session.questions) {
                const { questions, ...rest } = session;
                modified = true;
                return {
                  ...rest,
                  questionIds: questions.map((q: any) => q.questionId || q)
                };
              }
              return session;
            });
            
            // 最新50セッションのみ保持
            if (progress.studySessions.length > 50) {
              progress.studySessions = progress.studySessions.slice(-50);
              modified = true;
            }
          }
          
          if (modified) {
            localStorage.setItem(key, JSON.stringify(progress));
          }
        } catch (error) {
          console.error('Failed to cleanup userProgress:', error);
        }
      }
      
      // 最新のMock試験結果（1日以上前）を削除
      if (key.startsWith('latestMockExam_')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = safeJsonParse(item, null) as any;
            if (!parsed) continue;
            const createdAt = parsed.examRecord?.completedAt || parsed.completedAt;
            if (createdAt && new Date(createdAt).getTime() < oneDayAgo) {
              keysToDelete.push(key);
            }
          }
        } catch {
          keysToDelete.push(key);
        }
      }
    }
    
    // 削除実行
    keysToDelete.forEach(key => localStorage.removeItem(key));
    console.log(`Cleaned up ${keysToDelete.length} old items from localStorage`);
  } catch (error) {
    console.error('Failed to cleanup old data:', error);
  }
}

// StorageServiceを使用したシンプルなラッパー
// 互換性を保つために旧APIを維持
export const safeLocalStorage = {
  getItem<T = any>(key: string, defaultValue?: T): T | null {
    // 同期的に動作させるためにPromiseを待機せずにデータを取得
    const promise = defaultStorage.load<T>(key);
    if (promise instanceof Promise) {
      // 同期的なインターフェースを保つため、直接localStorageを使用
      try {
        const item = localStorage.getItem(key);
        if (item === null) {
          return defaultValue || null;
        }
        return safeJsonParse<T>(item, defaultValue as T) || null;
      } catch (error) {
        console.error(`Failed to get item: ${key}`, error);
        return defaultValue || null;
      }
    }
    return promise
  },

  setItem(key: string, value: any): void {
    // 同期的なインターフェースを保つため、直接localStorageを使用
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      // ストレージの容量チェック
      const currentSize = new Blob([serialized]).size;
      const estimatedTotalSize = Object.keys(localStorage).reduce((acc, k) => {
        const item = localStorage.getItem(k);
        return acc + (item ? new Blob([item]).size : 0);
      }, 0);

      // 5MB制限のチェック（一般的なブラウザの制限）
      if (estimatedTotalSize + currentSize > 5 * 1024 * 1024) {
        console.warn('Storage quota exceeded, attempting cleanup...');
        // 古いデータを削除してリトライ
        cleanupOldData();
        
        // 再度サイズをチェック
        const newTotalSize = Object.keys(localStorage).reduce((acc, k) => {
          const item = localStorage.getItem(k);
          return acc + (item ? new Blob([item]).size : 0);
        }, 0);
        
        if (newTotalSize + currentSize > 5 * 1024 * 1024) {
          // localStorageが使えない場合、sessionStorageにフォールバック
          console.warn('localStorage still full after cleanup, trying sessionStorage as fallback');
          try {
            sessionStorage.setItem(`fallback_${key}`, serialized);
            console.log(`Saved to sessionStorage as fallback: fallback_${key}`);
            return;
          } catch (sessionError) {
            console.error('sessionStorage fallback also failed:', sessionError);
          }
          
          throw new StorageError(
            'ストレージ容量が不足しています。ブラウザの設定から閲覧データを削除してください。',
            'write',
            key
          );
        }
      }

      localStorage.setItem(key, serialized);
      
      // Firebase同期コールバックを呼び出す（userProgressのみ）
      if (syncCallback && key.startsWith('userProgress_')) {
        try {
          syncCallback(key, value);
        } catch (syncError) {
          console.error('Firebase sync failed:', syncError);
          // 同期エラーがあってもローカル保存は成功させる
        }
      }
    } catch (error) {
      console.error(`Failed to set item in localStorage: ${key}`, error);
      
      if (error instanceof StorageError) {
        throw error;
      }
      
      // QuotaExceededError - sessionStorageにフォールバック
      if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
        console.warn('localStorage quota exceeded, trying sessionStorage fallback');
        try {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          sessionStorage.setItem(`fallback_${key}`, serialized);
          console.log(`Saved to sessionStorage as fallback: fallback_${key}`);
          return;
        } catch (sessionError) {
          console.error('sessionStorage fallback failed:', sessionError);
        }
        
        throw new StorageError(
          'ストレージ容量が不足しています。古いデータを削除してください。',
          'write',
          key,
          error instanceof Error ? error : undefined
        );
      }
      
      // プライベートブラウジングモード
      if (error instanceof DOMException && error.code === 18) {
        throw new StorageError(
          'プライベートブラウジングモードではデータを保存できません。通常モードでお試しください。',
          'write',
          key,
          error
        );
      }
      
      throw new StorageError(
        'データの保存に失敗しました。',
        'write',
        key,
        error instanceof Error ? error : undefined
      );
    }
  },

  removeItem(key: string): void {
    // 同期的なインターフェースを保つため、直接localStorageを使用
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.removeItem(key);
      
      // sessionStorageのフォールバックも削除
      const fallbackKey = `fallback_${key}`;
      sessionStorage.removeItem(fallbackKey);
    } catch (error) {
      console.error(`Failed to remove item from localStorage: ${key}`, error);
    }
  },

  clear(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage', error);
    }
  },

  // ストレージの使用状況を取得
  getStorageInfo(): { used: number; total: number; percentage: number } {
    try {
      if (typeof window === 'undefined') {
        return { used: 0, total: 0, percentage: 0 };
      }

      const used = Object.keys(localStorage).reduce((acc, key) => {
        const item = localStorage.getItem(key);
        return acc + (item ? new Blob([item]).size : 0);
      }, 0);

      const total = 5 * 1024 * 1024; // 5MB
      const percentage = Math.round((used / total) * 100);

      return { used, total, percentage };
    } catch {
      return { used: 0, total: 0, percentage: 0 };
    }
  },
};