/**
 * 統一されたストレージサービス
 * ローカルストレージ操作を一元管理し、エラーハンドリングとキャッシュ制御を提供
 */

import { safeJsonParse, isNotEmpty } from '@/utils/validation-utils';
import { StorageError, handleStorageError } from '@/utils/error-utils';

/**
 * ストレージ設定
 */
interface StorageConfig {
  prefix?: string;
  enableCache?: boolean;
  cacheTimeout?: number;
  compress?: boolean;
}

/**
 * キャッシュエントリ
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expires?: number;
}

/**
 * ストレージサービスクラス
 */
export class StorageService {
  private static instance: StorageService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: Required<StorageConfig>;

  private constructor(config: StorageConfig = {}) {
    this.config = {
      prefix: config.prefix || 'app_',
      enableCache: config.enableCache ?? true,
      cacheTimeout: config.cacheTimeout || 5 * 60 * 1000, // 5分
      compress: config.compress ?? false
    };
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(config?: StorageConfig): StorageService {
    if (!this.instance) {
      this.instance = new StorageService(config);
    }
    return this.instance;
  }

  /**
   * フルキーを生成
   */
  private getFullKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  /**
   * データを保存
   */
  async save<T>(key: string, data: T, options?: { expires?: number }): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      // データを文字列化
      const serialized = JSON.stringify(data);

      // 圧縮が有効な場合（実装は簡略化）
      const finalData = this.config.compress ? serialized : serialized;

      // ローカルストレージに保存
      localStorage.setItem(fullKey, finalData);

      // キャッシュを更新
      if (this.config.enableCache) {
        this.cache.set(fullKey, {
          value: data,
          timestamp: Date.now(),
          expires: options?.expires
        });
      }
    } catch (error) {
      throw new StorageError(
        `Failed to save data for key: ${key}`,
        'write',
        fullKey,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * データを読み込む
   */
  async load<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      // キャッシュをチェック
      if (this.config.enableCache) {
        const cached = this.cache.get(fullKey);
        if (cached && this.isCacheValid(cached)) {
          return cached.value as T;
        }
      }

      // ローカルストレージから読み込む
      const item = localStorage.getItem(fullKey);
      if (!item) {
        return null;
      }

      // 圧縮解除が必要な場合（実装は簡略化）
      const decompressed = this.config.compress ? item : item;

      // パース
      const data = safeJsonParse<T>(decompressed, null as T);

      // キャッシュに保存
      if (this.config.enableCache && data !== null) {
        this.cache.set(fullKey, {
          value: data,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      handleStorageError(error, 'read', fullKey, 'StorageService');
      return null;
    }
  }

  /**
   * データを削除
   */
  async remove(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      localStorage.removeItem(fullKey);
      
      // キャッシュからも削除
      if (this.config.enableCache) {
        this.cache.delete(fullKey);
      }
    } catch (error) {
      throw new StorageError(
        `Failed to remove data for key: ${key}`,
        'delete',
        fullKey,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 複数のキーのデータを一括取得
   */
  async loadMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = await this.load<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * 複数のデータを一括保存
   */
  async saveMany<T>(entries: Array<[string, T]>, options?: { expires?: number }): Promise<void> {
    const errors: Error[] = [];

    for (const [key, value] of entries) {
      try {
        await this.save(key, value, options);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to save ${errors.length} items: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * キーの存在確認
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    // キャッシュをチェック
    if (this.config.enableCache && this.cache.has(fullKey)) {
      const cached = this.cache.get(fullKey)!;
      if (this.isCacheValid(cached)) {
        return true;
      }
    }

    // ストレージをチェック
    return localStorage.getItem(fullKey) !== null;
  }

  /**
   * 指定プレフィックスで始まるすべてのキーを取得
   */
  async listKeys(prefix?: string): Promise<string[]> {
    const searchPrefix = this.getFullKey(prefix || '');
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(searchPrefix)) {
        // プレフィックスを除去してキーを追加
        keys.push(key.substring(this.config.prefix.length));
      }
    }

    return keys;
  }

  /**
   * ストレージをクリア（プレフィックスに一致するもののみ）
   */
  async clear(prefix?: string): Promise<void> {
    const keys = await this.listKeys(prefix);
    
    for (const key of keys) {
      await this.remove(key);
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * キャッシュの有効性をチェック
   */
  private isCacheValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();

    // 有効期限が設定されている場合
    if (entry.expires && now > entry.expires) {
      return false;
    }

    // タイムアウトをチェック
    if (now - entry.timestamp > this.config.cacheTimeout) {
      return false;
    }

    return true;
  }

  /**
   * ストレージの使用量を取得（概算）
   */
  async getStorageSize(): Promise<number> {
    let totalSize = 0;
    const keys = await this.listKeys();

    for (const key of keys) {
      const fullKey = this.getFullKey(key);
      const value = localStorage.getItem(fullKey);
      if (value) {
        totalSize += value.length * 2; // UTF-16なので2バイト/文字
      }
    }

    return totalSize;
  }

  /**
   * 条件に基づいてデータを更新
   */
  async update<T>(
    key: string,
    updater: (current: T | null) => T,
    options?: { expires?: number }
  ): Promise<T> {
    const current = await this.load<T>(key);
    const updated = updater(current);
    await this.save(key, updated, options);
    return updated;
  }

  /**
   * トランザクション処理（簡易版）
   */
  async transaction<T>(
    operations: Array<{
      type: 'save' | 'remove' | 'update';
      key: string;
      value?: T;
      updater?: (current: T | null) => T;
    }>
  ): Promise<void> {
    const backup = new Map<string, any>();

    // バックアップを作成
    for (const op of operations) {
      if (op.type !== 'save') {
        const current = await this.load(op.key);
        if (current !== null) {
          backup.set(op.key, current);
        }
      }
    }

    try {
      // 操作を実行
      for (const op of operations) {
        switch (op.type) {
          case 'save':
            if (op.value !== undefined) {
              await this.save(op.key, op.value);
            }
            break;
          case 'remove':
            await this.remove(op.key);
            break;
          case 'update':
            if (op.updater) {
              await this.update(op.key, op.updater);
            }
            break;
        }
      }
    } catch (error) {
      // ロールバック
      for (const [key, value] of backup) {
        try {
          await this.save(key, value);
        } catch {
          // ロールバック中のエラーは無視
        }
      }
      throw error;
    }
  }

  /**
   * 有効期限付きでデータを保存
   */
  async saveWithTTL<T>(key: string, data: T, ttl: number): Promise<void> {
    const expires = Date.now() + ttl;
    await this.save(key, data, { expires });
  }

  /**
   * データが存在しない場合のみ保存
   */
  async saveIfNotExists<T>(key: string, data: T): Promise<boolean> {
    if (await this.exists(key)) {
      return false;
    }
    await this.save(key, data);
    return true;
  }

  /**
   * アトミックなカウンター操作
   */
  async incrementCounter(key: string, delta: number = 1): Promise<number> {
    const current = await this.load<number>(key) || 0;
    const updated = current + delta;
    await this.save(key, updated);
    return updated;
  }
}

/**
 * デフォルトのストレージサービスインスタンス
 */
export const storage = StorageService.getInstance();

/**
 * ユーザー固有のストレージサービス
 */
export function getUserStorage(userId: string): StorageService {
  return StorageService.getInstance({
    prefix: `user_${userId}_`
  });
}

/**
 * セッション固有のストレージサービス
 */
export function getSessionStorage(sessionId: string): StorageService {
  return StorageService.getInstance({
    prefix: `session_${sessionId}_`,
    cacheTimeout: 10 * 60 * 1000 // 10分
  });
}

/**
 * 一時的なストレージサービス
 */
export const tempStorage = StorageService.getInstance({
  prefix: 'temp_',
  cacheTimeout: 60 * 1000 // 1分
});