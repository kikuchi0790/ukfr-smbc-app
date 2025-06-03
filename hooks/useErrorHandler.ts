import { useState, useCallback } from 'react';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  errorMessage: string;
}

export interface UseErrorHandlerReturn extends ErrorState {
  setError: (error: Error | string | null) => void;
  clearError: () => void;
  handleError: (error: unknown, customMessage?: string) => void;
  withErrorHandling: <T extends (...args: any[]) => any>(
    fn: T,
    customMessage?: string
  ) => (...args: Parameters<T>) => Promise<ReturnType<T>>;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    errorMessage: '',
  });

  const setError = useCallback((error: Error | string | null) => {
    if (error === null) {
      setErrorState({
        error: null,
        isError: false,
        errorMessage: '',
      });
    } else {
      const errorObj = error instanceof Error ? error : new Error(error);
      setErrorState({
        error: errorObj,
        isError: true,
        errorMessage: errorObj.message,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const handleError = useCallback((error: unknown, customMessage?: string) => {
    console.error('Error occurred:', error);

    let errorMessage = customMessage || 'エラーが発生しました';
    
    if (error instanceof Error) {
      // ネットワークエラーの場合
      if (error.message.includes('fetch')) {
        errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
      }
      // localStorageエラーの場合
      else if (error.message.includes('localStorage')) {
        errorMessage = 'データの保存に失敗しました。ブラウザの設定を確認してください。';
      }
      // その他のエラー
      else if (!customMessage) {
        errorMessage = error.message;
      }
    }

    setError(new Error(errorMessage));
  }, [setError]);

  const withErrorHandling = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    customMessage?: string
  ) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        clearError();
        const result = await fn(...args);
        return result;
      } catch (error) {
        handleError(error, customMessage);
        throw error;
      }
    };
  }, [clearError, handleError]);

  return {
    ...errorState,
    setError,
    clearError,
    handleError,
    withErrorHandling,
  };
}