import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProgress, Category, StudySession } from '@/types';
import { safeLocalStorage, getUserKey } from '@/utils/storage-utils';

// Firestoreと同期するデータ構造
interface SyncData {
  userProgress: UserProgress;
  lastSyncedAt: string;
  deviceId: string;
}

// デバイスIDを生成・取得
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// ローカルデータをFirestoreに保存
export async function syncToFirestore(userId: string, nickname: string): Promise<void> {
  if (!db) {
    console.warn('Firebase is not initialized. Skipping sync.');
    return;
  }
  
  try {
    const userProgressKey = getUserKey('userProgress', nickname);
    const localProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    
    if (!localProgress) return;
    
    const syncData: SyncData = {
      userProgress: localProgress,
      lastSyncedAt: new Date().toISOString(),
      deviceId: getDeviceId()
    };
    
    await setDoc(doc(db, 'userProgress', userId), syncData, { merge: true });
    console.log('データがFirestoreに同期されました');
  } catch (error) {
    console.error('Firestore同期エラー:', error);
    throw error;
  }
}

// Firestoreからデータを取得
export async function loadFromFirestore(userId: string, nickname: string): Promise<UserProgress | null> {
  if (!db) {
    console.warn('Firebase is not initialized. Using local storage only.');
    return null;
  }
  
  try {
    const docRef = doc(db, 'userProgress', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as SyncData;
      
      // データのクリーンアップ: 新規ユーザーの場合、すべてのカテゴリを0にリセット
      if (data.userProgress) {
        // 全体の統計をチェック（新規登録直後でも古いデータが残っている可能性がある）
        const isNewUser = data.userProgress.totalQuestionsAnswered === 0 || 
                         !data.userProgress.studySessions || 
                         data.userProgress.studySessions.length === 0;
                         
        if (isNewUser) {
          // 新規ユーザーと判定：すべてのカテゴリ進捗をリセット
          console.log('New user detected - resetting all category progress to 0');
          Object.keys(data.userProgress.categoryProgress || {}).forEach(category => {
            const categoryKey = category as Category;
            if (data.userProgress.categoryProgress[categoryKey]) {
              data.userProgress.categoryProgress[categoryKey].answeredQuestions = 0;
              data.userProgress.categoryProgress[categoryKey].correctAnswers = 0;
            }
          });
          
          // 全体の統計もリセット
          data.userProgress.totalQuestionsAnswered = 0;
          data.userProgress.correctAnswers = 0;
        }
      }
      
      // ローカルに保存
      const userProgressKey = getUserKey('userProgress', nickname);
      safeLocalStorage.setItem(userProgressKey, data.userProgress);
      
      return data.userProgress;
    }
    
    return null;
  } catch (error) {
    console.error('Firestoreロードエラー:', error);
    return null;
  }
}

// リアルタイム同期を設定
export function setupRealtimeSync(userId: string, nickname: string, onUpdate: (progress: UserProgress) => void) {
  if (!db) {
    console.warn('Firebase is not initialized. Realtime sync disabled.');
    return () => {}; // Return empty unsubscribe function
  }
  
  const unsubscribe = onSnapshot(
    doc(db, 'userProgress', userId), 
    (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SyncData;
        
        // 別のデバイスからの更新の場合のみローカルを更新
        if (data.deviceId !== getDeviceId()) {
          const userProgressKey = getUserKey('userProgress', nickname);
          safeLocalStorage.setItem(userProgressKey, data.userProgress);
          onUpdate(data.userProgress);
          console.log('他のデバイスからの更新を受信しました');
        }
      }
    },
    (error) => {
      // エラーハンドリング
      console.error('Realtime sync error:', error);
      if (error.code === 'permission-denied') {
        console.log('リアルタイム同期の権限エラー。手動同期に切り替えます。');
      }
    }
  );
  
  return unsubscribe;
}

// データマージ戦略：より新しいデータを優先
export function mergeProgressData(local: UserProgress, remote: UserProgress): UserProgress {
  // 基本的な統計情報は加算
  const merged: UserProgress = {
    ...remote,
    totalQuestionsAnswered: Math.max(local.totalQuestionsAnswered, remote.totalQuestionsAnswered),
    correctAnswers: Math.max(local.correctAnswers, remote.correctAnswers),
    currentStreak: Math.max(local.currentStreak, remote.currentStreak),
    bestStreak: Math.max(local.bestStreak || 0, remote.bestStreak || 0),
    lastStudyDate: local.lastStudyDate > remote.lastStudyDate ? local.lastStudyDate : remote.lastStudyDate,
    
    // 配列データはマージ
    studySessions: mergeArraysByDate(local.studySessions || [], remote.studySessions || []),
    incorrectQuestions: mergeIncorrectQuestions(local.incorrectQuestions || [], remote.incorrectQuestions || []),
    overcomeQuestions: mergeOvercomeQuestions(local.overcomeQuestions || [], remote.overcomeQuestions || []),
    
    // カテゴリ進捗は最大値を取る
    categoryProgress: mergeCategoryProgress(local.categoryProgress, remote.categoryProgress),
    mockCategoryProgress: local.mockCategoryProgress || remote.mockCategoryProgress,
    
    // 設定は最新のものを使用
    preferences: local.preferences || remote.preferences
  };
  
  return merged;
}

// 学習セッションをマージ（重複排除）
function mergeArraysByDate(arr1: StudySession[], arr2: StudySession[]): StudySession[] {
  const map = new Map<string, StudySession>();
  
  [...arr1, ...arr2].forEach(item => {
    const key = item.id;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  
  return Array.from(map.values()).sort((a, b) => 
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// 間違えた問題をマージ
function mergeIncorrectQuestions(arr1: any[], arr2: any[]): any[] {
  const map = new Map<string, any>();
  
  [...arr1, ...arr2].forEach(item => {
    const existing = map.get(item.questionId);
    if (!existing || item.lastAttemptDate > existing.lastAttemptDate) {
      map.set(item.questionId, item);
    } else if (existing) {
      // 間違えた回数は加算
      map.set(item.questionId, {
        ...item,
        incorrectCount: Math.max(item.incorrectCount, existing.incorrectCount),
        reviewCount: Math.max(item.reviewCount, existing.reviewCount)
      });
    }
  });
  
  return Array.from(map.values());
}

// 克服した問題をマージ
function mergeOvercomeQuestions(arr1: any[], arr2: any[]): any[] {
  const map = new Map<string, any>();
  
  [...arr1, ...arr2].forEach(item => {
    const existing = map.get(item.questionId);
    if (!existing || item.overcomeDate > existing.overcomeDate) {
      map.set(item.questionId, item);
    }
  });
  
  return Array.from(map.values());
}

// カテゴリ進捗をマージ
function mergeCategoryProgress(local: any, remote: any): any {
  const merged: any = {};
  
  const allCategories = new Set([
    ...Object.keys(local || {}),
    ...Object.keys(remote || {})
  ]);
  
  allCategories.forEach(category => {
    const localCat = local?.[category] || { answeredQuestions: 0, correctAnswers: 0 };
    const remoteCat = remote?.[category] || { answeredQuestions: 0, correctAnswers: 0 };
    
    merged[category] = {
      totalQuestions: localCat.totalQuestions || remoteCat.totalQuestions,
      answeredQuestions: Math.max(localCat.answeredQuestions, remoteCat.answeredQuestions),
      correctAnswers: Math.max(localCat.correctAnswers, remoteCat.correctAnswers)
    };
  });
  
  return merged;
}

// 自動同期の設定
export async function enableAutoSync(userId: string, nickname: string): Promise<() => void> {
  try {
    // 初回ロード
    await loadFromFirestore(userId, nickname);
  } catch (error) {
    console.error('Initial load from Firestore failed:', error);
    // エラーがあってもローカルストレージで動作を続ける
  }
  
  // 定期的な同期（5分ごと）
  const syncInterval = setInterval(async () => {
    try {
      await syncToFirestore(userId, nickname);
    } catch (error) {
      console.error('Periodic sync failed:', error);
    }
  }, 5 * 60 * 1000);
  
  // ページを離れる時に同期
  const handleBeforeUnload = () => {
    syncToFirestore(userId, nickname).catch(console.error);
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // リアルタイム同期（エラーハンドリング付き）
  let unsubscribeRealtime: (() => void) | null = null;
  try {
    unsubscribeRealtime = setupRealtimeSync(userId, nickname, (progress) => {
      console.log('Progress updated from another device');
    });
  } catch (error) {
    console.error('Failed to setup realtime sync:', error);
  }
  
  // クリーンアップ関数
  return () => {
    clearInterval(syncInterval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
    }
  };
}