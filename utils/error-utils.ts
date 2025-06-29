/**
 * エラーハンドリングユーティリティ
 * アプリケーション全体で一貫したエラー処理を提供
 */

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * API エラー
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * ストレージエラー
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public operation: 'read' | 'write' | 'delete',
    public key: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * 同期エラー
 */
export class SyncError extends Error {
  constructor(
    message: string,
    public source: 'local' | 'remote',
    public dataType: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * 認証エラー
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public action: 'login' | 'logout' | 'register' | 'refresh'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * エラーコンテキスト情報
 */
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 * エラーレポート
 */
export interface ErrorReport {
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

/**
 * エラーハンドラー
 */
export class ErrorHandler {
  private static reports: ErrorReport[] = [];
  private static maxReports = 100;

  /**
   * エラーを処理し、ログに記録
   */
  static handle(
    error: unknown,
    context: Partial<ErrorContext> = {},
    severity: ErrorReport['severity'] = 'medium'
  ): void {
    const fullContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      ...context
    };

    const report: ErrorReport = {
      error: error instanceof Error ? error : new Error(String(error)),
      context: fullContext,
      severity,
      handled: true
    };

    this.addReport(report);
    this.logError(report);
  }

  /**
   * エラーレポートを追加
   */
  private static addReport(report: ErrorReport): void {
    this.reports.push(report);
    
    // 最大数を超えたら古いものから削除
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(-this.maxReports);
    }
  }

  /**
   * エラーをコンソールに出力
   */
  private static logError(report: ErrorReport): void {
    const { error, context, severity } = report;
    const prefix = `[${severity.toUpperCase()}] [${context.component || 'Unknown'}]`;

    console.group(`${prefix} ${error.name}: ${error.message}`);
    
    if (context.action) {
      console.log('Action:', context.action);
    }
    
    if (context.metadata) {
      console.log('Metadata:', context.metadata);
    }
    
    console.error('Stack:', error.stack);
    console.groupEnd();
  }

  /**
   * 最近のエラーレポートを取得
   */
  static getRecentReports(count = 10): ErrorReport[] {
    return this.reports.slice(-count);
  }

  /**
   * エラーレポートをクリア
   */
  static clearReports(): void {
    this.reports = [];
  }

  /**
   * エラーの重要度を判定
   */
  static getSeverity(error: Error): ErrorReport['severity'] {
    if (error instanceof AuthError) {
      return 'high';
    }
    
    if (error instanceof ApiError) {
      if (error.status >= 500) return 'critical';
      if (error.status >= 400) return 'high';
      return 'medium';
    }
    
    if (error instanceof SyncError) {
      return 'high';
    }
    
    if (error instanceof ValidationError) {
      return 'low';
    }
    
    if (error instanceof StorageError) {
      return 'medium';
    }
    
    return 'medium';
  }
}

/**
 * エラーハンドリングのヘルパー関数
 */

/**
 * バリデーションエラーを処理
 */
export function handleValidationError(
  error: unknown,
  context: string
): void {
  if (error instanceof ValidationError) {
    ErrorHandler.handle(error, { component: context }, 'low');
  } else {
    ErrorHandler.handle(error, { component: context }, 'medium');
  }
}

/**
 * APIエラーを処理
 */
export function handleApiError(
  error: unknown,
  endpoint: string,
  context?: string
): void {
  if (error instanceof ApiError) {
    ErrorHandler.handle(error, { component: context }, ErrorHandler.getSeverity(error));
  } else {
    const apiError = new ApiError(
      error instanceof Error ? error.message : 'Unknown API error',
      0,
      endpoint
    );
    ErrorHandler.handle(apiError, { component: context }, 'high');
  }
}

/**
 * ストレージエラーを処理
 */
export function handleStorageError(
  error: unknown,
  operation: StorageError['operation'],
  key: string,
  context?: string
): void {
  const storageError = error instanceof StorageError
    ? error
    : new StorageError(
        error instanceof Error ? error.message : 'Unknown storage error',
        operation,
        key,
        error instanceof Error ? error : undefined
      );
  
  ErrorHandler.handle(storageError, { component: context }, 'medium');
}

/**
 * 同期エラーを処理
 */
export function handleSyncError(
  error: unknown,
  source: SyncError['source'],
  dataType: string,
  context?: string
): void {
  const syncError = error instanceof SyncError
    ? error
    : new SyncError(
        error instanceof Error ? error.message : 'Unknown sync error',
        source,
        dataType,
        error instanceof Error ? error : undefined
      );
  
  ErrorHandler.handle(syncError, { component: context }, 'high');
}

/**
 * 認証エラーを処理
 */
export function handleAuthError(
  error: unknown,
  action: AuthError['action'],
  context?: string
): void {
  if (error instanceof AuthError) {
    ErrorHandler.handle(error, { component: context, action }, 'high');
  } else {
    const authError = new AuthError(
      error instanceof Error ? error.message : 'Unknown auth error',
      'UNKNOWN',
      action
    );
    ErrorHandler.handle(authError, { component: context, action }, 'high');
  }
}

/**
 * エラーの再試行処理
 */
export async function retryOnError<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    shouldRetry?: (error: Error, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = () => true
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError!;
}

/**
 * エラーバウンダリー用のエラーハンドラー
 */
export function handleErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string }
): void {
  ErrorHandler.handle(
    error,
    {
      component: 'ErrorBoundary',
      metadata: {
        componentStack: errorInfo.componentStack
      }
    },
    'critical'
  );
}

/**
 * グローバルエラーハンドラーの設定
 */
export function setupGlobalErrorHandlers(): void {
  // ブラウザ環境でのみ実行
  if (typeof window !== 'undefined') {
    // 未処理のPromiseエラー
    window.addEventListener('unhandledrejection', (event) => {
      ErrorHandler.handle(
        new Error(event.reason?.message || 'Unhandled Promise rejection'),
        {
          component: 'Global',
          action: 'unhandledrejection',
          metadata: { reason: event.reason }
        },
        'high'
      );
    });

    // 一般的なエラー
    window.addEventListener('error', (event) => {
      ErrorHandler.handle(
        event.error || new Error(event.message),
        {
          component: 'Global',
          action: 'error',
          url: event.filename,
          metadata: {
            line: event.lineno,
            column: event.colno
          }
        },
        'critical'
      );
    });
  }
}

/**
 * エラーメッセージのユーザーフレンドリーな変換
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof ValidationError) {
    return `入力エラー: ${error.field}の値が正しくありません`;
  }

  if (error instanceof ApiError) {
    if (error.status === 404) return 'リクエストされたデータが見つかりません';
    if (error.status === 401) return '認証が必要です';
    if (error.status === 403) return 'アクセス権限がありません';
    if (error.status >= 500) return 'サーバーエラーが発生しました';
    return 'ネットワークエラーが発生しました';
  }

  if (error instanceof StorageError) {
    return 'データの保存中にエラーが発生しました';
  }

  if (error instanceof SyncError) {
    return 'データの同期中にエラーが発生しました';
  }

  if (error instanceof AuthError) {
    return '認証エラーが発生しました';
  }

  return 'エラーが発生しました。しばらくしてから再度お試しください';
}