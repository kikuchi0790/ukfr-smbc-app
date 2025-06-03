export class StorageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export const safeLocalStorage = {
  getItem<T = any>(key: string, defaultValue?: T): T | null {
    try {
      if (typeof window === 'undefined') {
        return defaultValue || null;
      }

      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue || null;
      }

      try {
        return JSON.parse(item) as T;
      } catch {
        // JSON.parseに失敗した場合は文字列として返す
        return item as unknown as T;
      }
    } catch (error) {
      console.error(`Failed to get item from localStorage: ${key}`, error);
      
      // プライベートブラウジングモードの可能性
      if (error instanceof DOMException && error.code === 18) {
        throw new StorageError(
          'プライベートブラウジングモードではデータを保存できません。通常モードでお試しください。',
          'PRIVATE_BROWSING'
        );
      }
      
      return defaultValue || null;
    }
  },

  setItem(key: string, value: any): void {
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
        throw new StorageError(
          'ストレージ容量が不足しています。古いデータを削除してください。',
          'QUOTA_EXCEEDED'
        );
      }

      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Failed to set item in localStorage: ${key}`, error);
      
      if (error instanceof StorageError) {
        throw error;
      }
      
      // QuotaExceededError
      if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
        throw new StorageError(
          'ストレージ容量が不足しています。古いデータを削除してください。',
          'QUOTA_EXCEEDED'
        );
      }
      
      // プライベートブラウジングモード
      if (error instanceof DOMException && error.code === 18) {
        throw new StorageError(
          'プライベートブラウジングモードではデータを保存できません。通常モードでお試しください。',
          'PRIVATE_BROWSING'
        );
      }
      
      throw new StorageError(
        'データの保存に失敗しました。',
        'UNKNOWN'
      );
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.removeItem(key);
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