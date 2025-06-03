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
    <div className={`rounded-lg p-4 mb-4 ${
      isError ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className={`h-5 w-5 ${
            isError ? 'text-red-400' : 'text-yellow-400'
          }`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${
            isError ? 'text-red-800' : 'text-yellow-800'
          }`}>
            {isError ? 'エラー' : '警告'}
          </h3>
          <div className={`mt-2 text-sm ${
            isError ? 'text-red-700' : 'text-yellow-700'
          }`}>
            <p>{errorMessage}</p>
          </div>
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-md ${
                  isError 
                    ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
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
                  ? 'text-red-500 hover:bg-red-100' 
                  : 'text-yellow-500 hover:bg-yellow-100'
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