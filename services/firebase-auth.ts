import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  UserCredential
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProgress, Category } from '@/types';
import { categories } from '@/utils/category-utils';

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}

// ユーザー登録
export async function signUp(email: string, password: string, nickname: string): Promise<FirebaseUser> {
  if (!auth || !db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  
  try {
    // Firebase Authでユーザー作成
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // プロフィール更新（ニックネーム設定）
    await updateProfile(user, {
      displayName: nickname
    });
    
    // Firestoreにユーザー情報保存
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      nickname: nickname,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });
    
    // 新規ユーザーの初期進捗データを作成
    const initialCategoryProgress: Partial<Record<Category, any>> = {};
    categories.forEach(category => {
      initialCategoryProgress[category.name] = {
        totalQuestions: category.totalQuestions,
        answeredQuestions: 0,
        correctAnswers: 0
      };
    });

    const initialProgress: UserProgress = {
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
      categoryProgress: initialCategoryProgress as Record<Category, any>,
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
    
    // Firestoreに初期進捗データを保存
    await setDoc(doc(db, 'userProgress', user.uid), {
      userProgress: initialProgress,
      lastSyncedAt: new Date().toISOString(),
      deviceId: `initial_${Date.now()}`
    });
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: nickname,
      createdAt: new Date().toISOString()
    };
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('このメールアドレスは既に使用されています');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('パスワードは6文字以上にしてください');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('有効なメールアドレスを入力してください');
    }
    throw error;
  }
}

// ログイン
export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  if (!auth || !db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Firestoreから追加情報を取得
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    // 最終ログイン時刻を更新
    await setDoc(doc(db, 'users', user.uid), {
      ...userData,
      lastLoginAt: new Date().toISOString()
    }, { merge: true });
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: userData?.nickname || user.displayName,
      createdAt: userData?.createdAt || new Date().toISOString()
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('ユーザーが見つかりません');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('パスワードが間違っています');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('有効なメールアドレスを入力してください');
    }
    throw error;
  }
}

// ログアウト
export async function logOut(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  
  try {
    await signOut(auth);
  } catch (error) {
    console.error('ログアウトエラー:', error);
    throw error;
  }
}

// 現在のユーザー取得
export function getCurrentUser(): User | null {
  if (!auth) {
    return null;
  }
  return auth.currentUser;
}