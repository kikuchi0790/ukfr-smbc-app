'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signUp as firebaseSignUp, signIn as firebaseSignIn, logOut as firebaseLogOut, FirebaseUser as CustomFirebaseUser } from '@/services/firebase-auth';
import { enableAutoSync, loadFromFirestore, syncToFirestore } from '@/services/firebase-sync';
import { safeLocalStorage, setSyncCallback } from '@/utils/storage-utils';
import { cleanupLegacyData } from '@/utils/cleanup-legacy-data';
import { resetAllUserProgress } from '@/utils/reset-all-data';
import { migrateOldData } from '@/utils/data-migration';

interface User {
  id: string;
  nickname: string;
  createdAt: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  isFirebaseAuth: boolean;
  isOfflineMode: boolean;
  retryFirebaseConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseAuth, setIsFirebaseAuth] = useState(true);
  const [cleanupSync, setCleanupSync] = useState<(() => void) | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [firebaseUnsubscribe, setFirebaseUnsubscribe] = useState<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Firebase認証が利用可能かチェック
    if (!auth) {
      console.warn('Firebase is not initialized. App will run with limited functionality.');
      setIsLoading(false);
      return;
    }
    
    // Firebase接続タイムアウトを設定（10秒）
    const authTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Firebase authentication timeout - continuing in offline mode');
        setIsLoading(false);
        setIsOfflineMode(true);
        // オフラインモードで続行
      }
    }, 10000);
    
    // アプリ起動時にストレージをクリーンアップ
    try {
      const cleanupStorage = () => {
        const keysToDelete: string[] = [];
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          
          // 一時的なデータを削除
          if (key.startsWith('tempMockResult_') || 
              key.startsWith('tempMockQuestions_') ||
              key.startsWith('mockExamProgress_') ||
              key === 'answeredQuestionsTracker') {
            keysToDelete.push(key);
          }
        }
        
        keysToDelete.forEach(key => localStorage.removeItem(key));
        
        // sessionStorageのフォールバックデータもクリーンアップ
        const sessionKeysToDelete: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('fallback_')) {
            sessionKeysToDelete.push(key);
          }
        }
        sessionKeysToDelete.forEach(key => sessionStorage.removeItem(key));
        
        console.log(`App startup cleanup: removed ${keysToDelete.length} localStorage items and ${sessionKeysToDelete.length} sessionStorage items`);
      };
      
      cleanupStorage();
      
      // 古いテストデータをクリーンアップ
      cleanupLegacyData();
      
      // 初回のみ全ユーザーの進捗データをリセット
      const hasResetData = localStorage.getItem('hasResetTestData_v1');
      if (!hasResetData) {
        const resetResult = resetAllUserProgress();
        console.log('Reset all user progress (one-time cleanup):', resetResult);
        localStorage.setItem('hasResetTestData_v1', 'true');
      }
    } catch (error) {
      console.error('Startup cleanup failed:', error);
    }
    
    // Firebase認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(authTimeout); // タイムアウトをクリア
      if (firebaseUser) {
        // Firebaseユーザーがログインしている
        const userData: User = {
          id: firebaseUser.uid,
          nickname: firebaseUser.displayName || 'User',
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          email: firebaseUser.email || undefined
        };
        setUser(userData);
        setIsFirebaseAuth(true);
        
        // 古いデータのマイグレーション
        migrateOldData(userData.nickname);
        
        // Firestoreからデータを読み込み、自動同期を開始
        try {
          await loadFromFirestore(firebaseUser.uid, userData.nickname);
          const cleanup = await enableAutoSync(firebaseUser.uid, userData.nickname);
          setCleanupSync(() => cleanup);
          
          // storage-utilsの同期コールバックを設定
          setSyncCallback((key: string, value: any) => {
            if (key.startsWith('userProgress_')) {
              syncToFirestore(firebaseUser.uid, userData.nickname);
            }
          });
        } catch (error) {
          console.error('Failed to setup sync:', error);
        }
      } else {
        // Firebaseユーザーがログアウトしている
        setUser(null);
      }
      setIsLoading(false);
    });

    // Store the unsubscribe function for potential reconnection
    setFirebaseUnsubscribe(() => unsubscribe);
    
    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
      if (cleanupSync) {
        cleanupSync();
      }
    };
  }, []);
  
  // Firebase再接続を試みる関数
  const retryFirebaseConnection = useCallback(async () => {
    if (!auth || !isOfflineMode) return;
    
    console.log('Attempting to reconnect to Firebase...');
    setIsLoading(true);
    
    try {
      // 既存のリスナーをクリーンアップ
      if (firebaseUnsubscribe) {
        firebaseUnsubscribe();
      }
      
      // 新しいリスナーを設定
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userData: User = {
            id: firebaseUser.uid,
            nickname: firebaseUser.displayName || 'User',
            createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
            email: firebaseUser.email || undefined
          };
          setUser(userData);
          setIsFirebaseAuth(true);
          setIsOfflineMode(false);
          
          // Firestoreからデータを読み込み、自動同期を開始
          try {
            await loadFromFirestore(firebaseUser.uid, userData.nickname);
            const cleanup = await enableAutoSync(firebaseUser.uid, userData.nickname);
            setCleanupSync(() => cleanup);
          } catch (error) {
            console.error('Failed to setup sync after reconnection:', error);
          }
        }
        setIsLoading(false);
      });
      
      setFirebaseUnsubscribe(() => unsubscribe);
      
      // タイムアウト設定
      setTimeout(() => {
        if (isLoading) {
          console.warn('Firebase reconnection timeout');
          setIsLoading(false);
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to reconnect to Firebase:', error);
      setIsLoading(false);
    }
  }, [isOfflineMode, firebaseUnsubscribe]);
  
  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      if (isOfflineMode) {
        retryFirebaseConnection();
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isOfflineMode, retryFirebaseConnection]);

  // Firebase Email認証でログイン
  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      const firebaseUser = await firebaseSignIn(email, password);
      const userData: User = {
        id: firebaseUser.uid,
        nickname: firebaseUser.displayName || 'User',
        createdAt: firebaseUser.createdAt,
        email: firebaseUser.email || undefined
      };
      setUser(userData);
      setIsFirebaseAuth(true);
      
      // 古いデータのマイグレーション
      migrateOldData(userData.nickname);
      
      // 自動同期を開始
      const cleanup = await enableAutoSync(firebaseUser.uid, userData.nickname);
      setCleanupSync(() => cleanup);
      
      // storage-utilsの同期コールバックを設定
      setSyncCallback((key: string, value: any) => {
        if (key.startsWith('userProgress_')) {
          syncToFirestore(firebaseUser.uid, userData.nickname);
        }
      });
      
      router.push('/welcome');
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      alert(error.message || 'ログインに失敗しました');
      return false;
    }
  };

  // Firebase Email認証で新規登録
  const signUp = async (email: string, password: string, nickname: string): Promise<boolean> => {
    try {
      const firebaseUser = await firebaseSignUp(email, password, nickname);
      const userData: User = {
        id: firebaseUser.uid,
        nickname: nickname,
        createdAt: firebaseUser.createdAt,
        email: firebaseUser.email || undefined
      };
      setUser(userData);
      setIsFirebaseAuth(true);
      
      // 新規登録時は初期進捗データをローカルにも保存
      const userProgressKey = `userProgress_${nickname}`;
      const initialCategoryProgress: Partial<Record<any, any>> = {};
      const categoryList = [
        { name: 'The Regulatory Environment', totalQuestions: 42 },
        { name: 'The Financial Services and Markets Act 2000 and Financial Services Act 2012', totalQuestions: 99 },
        { name: 'Associated Legislation and Regulation', totalQuestions: 100 },
        { name: 'The FCA Conduct of Business Sourcebook/Client Assets', totalQuestions: 125 },
        { name: 'Complaints and Redress', totalQuestions: 32 },
        { name: 'Regulations: Mock 1', totalQuestions: 75 },
        { name: 'Regulations: Mock 2', totalQuestions: 75 },
        { name: 'Regulations: Mock 3', totalQuestions: 75 },
        { name: 'Regulations: Mock 4', totalQuestions: 75 },
        { name: 'Regulations: Mock 5', totalQuestions: 75 },
        { name: 'Regulations: Final Study Questions', totalQuestions: 62 }
      ];
      
      categoryList.forEach(category => {
        initialCategoryProgress[category.name] = {
          totalQuestions: category.totalQuestions,
          answeredQuestions: 0,
          correctAnswers: 0
        };
      });

      const initialProgress = {
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        categoryProgress: initialCategoryProgress,
        studySessions: [],
        incorrectQuestions: [],
        overcomeQuestions: [],
        currentStreak: 0,
        bestStreak: 0,
        lastStudyDate: "",
        preferences: {
          showJapaneseInStudy: true,
          showJapaneseInMock: false,
          autoReviewIncorrect: true,
          notificationEnabled: false
        }
      };
      
      safeLocalStorage.setItem(userProgressKey, initialProgress);
      
      // 自動同期を開始
      const cleanup = await enableAutoSync(firebaseUser.uid, userData.nickname);
      setCleanupSync(() => cleanup);
      
      // storage-utilsの同期コールバックを設定
      setSyncCallback((key: string, value: any) => {
        if (key.startsWith('userProgress_')) {
          syncToFirestore(firebaseUser.uid, userData.nickname);
        }
      });
      
      router.push('/welcome');
      return true;
    } catch (error: any) {
      console.error('Sign up error:', error);
      alert(error.message || '登録に失敗しました');
      return false;
    }
  };

  const logout = async () => {
    if (isFirebaseAuth) {
      try {
        await firebaseLogOut();
      } catch (error) {
        console.error('Firebase logout error:', error);
      }
    }
    
    // 同期のクリーンアップ
    if (cleanupSync) {
      cleanupSync();
      setCleanupSync(null);
    }
    
    // 同期コールバックをクリア
    setSyncCallback(() => {});
    
    setUser(null);
    setIsFirebaseAuth(true);
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithEmail,
        signUp,
        logout,
        isFirebaseAuth,
        isOfflineMode,
        retryFirebaseConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}