import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  error: string | Error;
  onClose?: () => void;
  onRetry?: () => void;
  variant?: 'error' | 'warning';
}

export default function ErrorAlert({ error, onClose, onRetry, variant = 'error' }: ErrorAlertProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  const isError = variant === 'error';

  return (
    <div className={`rounded-lg p-4 mb-4 shadow-lg ${
      isError 
        ? 'bg-red-900/20 border border-red-500/50 dark:bg-red-900/30' 
        : 'bg-yellow-900/20 border border-yellow-500/50 dark:bg-yellow-900/30'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className={`h-5 w-5 ${
            isError ? 'text-red-400' : 'text-yellow-400'
          }`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${
            isError ? 'text-red-200' : 'text-yellow-200'
          }`}>
            {isError ? 'エラー' : '警告'}
          </h3>
          <div className={`mt-2 text-sm ${
            isError ? 'text-red-300' : 'text-yellow-300'
          }`}>
            <p>{errorMessage}</p>
          </div>
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-md ${
                  isError 
                    ? 'bg-red-800/50 text-red-200 hover:bg-red-800/70' 
                    : 'bg-yellow-800/50 text-yellow-200 hover:bg-yellow-800/70'
                } transition-colors`}
              >
                <RefreshCw className="h-4 w-4" />
                再試行
              </button>
            </div>
          )}
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className={`inline-flex rounded-md p-1.5 ${
                isError 
                  ? 'text-red-400 hover:bg-red-800/30' 
                  : 'text-yellow-400 hover:bg-yellow-800/30'
              } transition-colors`}
            >
              <span className="sr-only">閉じる</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}