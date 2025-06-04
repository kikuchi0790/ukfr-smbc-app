'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  nickname: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (passcode: string, nickname: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Vercelデプロイ時は環境変数から、ローカルではデフォルト値を使用
const PASSCODE = process.env.NEXT_PUBLIC_PASSCODE || '1234';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // アプリ起動時にストレージをクリーンアップ
    try {
      // 手動でクリーンアップ関数を呼び出す
      const cleanupStorage = () => {
        const keysToDelete: string[] = [];
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          
          // 一時的なデータを削除
          if (key.startsWith('tempMockResult_') || 
              key.startsWith('mockExamProgress_') ||
              key === 'answeredQuestionsTracker') {
            keysToDelete.push(key);
          }
        }
        
        keysToDelete.forEach(key => localStorage.removeItem(key));
        console.log(`App startup cleanup: removed ${keysToDelete.length} items`);
      };
      
      cleanupStorage();
    } catch (error) {
      console.error('Startup cleanup failed:', error);
    }
    
    // LocalStorageから認証情報を復元
    const storedAuth = localStorage.getItem('authUser');
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('authUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (passcode: string, nickname: string): Promise<boolean> => {
    if (passcode !== PASSCODE) {
      return false;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      nickname: nickname.trim(),
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    localStorage.setItem('authUser', JSON.stringify(newUser));
    
    // シンプルにwelcomeページへリダイレクト
    router.push('/welcome');
    
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authUser');
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
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