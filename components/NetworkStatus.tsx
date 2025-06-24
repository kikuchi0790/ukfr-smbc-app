'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, AlertCircle, RefreshCw } from 'lucide-react';
import { isFirebaseAvailable } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function NetworkStatus() {
  const { isOfflineMode, retryFirebaseConnection } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
  const [showStatus, setShowStatus] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    setIsFirebaseConnected(isFirebaseAvailable());

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check Firebase status periodically
    const checkFirebase = setInterval(() => {
      const available = isFirebaseAvailable();
      if (available !== isFirebaseConnected) {
        setIsFirebaseConnected(available);
        setShowStatus(true);
        if (available) {
          setTimeout(() => setShowStatus(false), 3000);
        }
      }
    }, 5000);

    // Show status if offline initially
    if (!navigator.onLine || !isFirebaseAvailable()) {
      setShowStatus(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkFirebase);
    };
  }, [isFirebaseConnected]);

  if (!showStatus) return null;

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        message: 'インターネット接続がありません',
        bgColor: 'bg-red-900/90',
        textColor: 'text-red-200',
        showRetryButton: false
      };
    } else if (!isFirebaseConnected) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        message: 'オフラインモードで動作中（同期は無効）',
        bgColor: 'bg-yellow-900/90',
        textColor: 'text-yellow-200',
        showRetryButton: true
      };
    } else {
      return {
        icon: <Wifi className="h-4 w-4" />,
        message: 'オンラインに復帰しました',
        bgColor: 'bg-green-900/90',
        textColor: 'text-green-200',
        showRetryButton: false
      };
    }
  };

  const { icon, message, bgColor, textColor, showRetryButton } = getStatusInfo();
  
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryFirebaseConnection();
    } catch (error) {
      console.error('Failed to retry Firebase connection:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className={`${bgColor} ${textColor} px-4 py-2 rounded-lg shadow-lg flex items-center gap-2`}>
        {icon}
        <span className="text-sm font-medium">{message}</span>
        {showRetryButton && isOfflineMode && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="ml-2 p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Firebaseに再接続"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}