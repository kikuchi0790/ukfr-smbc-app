import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { checkFirebaseInit } from '@/lib/firebase';

export default function FirebaseStatusNotice() {
  const [showNotice, setShowNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { isInitialized, error: initError } = checkFirebaseInit();
    
    if (!isInitialized && initError) {
      setError(initError.message);
      setShowNotice(true);
    }
  }, []);

  if (!showNotice || !error) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800">一部機能の制限</h4>
          <p className="text-sm text-amber-700 mt-1">{error}</p>
          <p className="text-xs text-amber-600 mt-2">
            基本的な学習機能は問題なくご利用いただけます。
          </p>
        </div>
        <button
          onClick={() => setShowNotice(false)}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}