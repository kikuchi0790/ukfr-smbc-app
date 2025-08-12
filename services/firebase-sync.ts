import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProgress, Category, StudySession } from '@/types';
import { safeLocalStorage, getUserKey } from '@/utils/storage-utils';
import { DataMerger } from '@/utils/data-merge-utils';

// Firestoreと同期するデータ構造
interface SyncData {
  userProgress: UserProgress;
  lastSyncedAt: string;
  deviceId: string;
}

// デバイスIDを生成・取得（簡略化版）
function getDeviceId(): string {
  // シンプルなデバイス識別のため、固定値を使用
  return 'default-device';
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
  return DataMerger.mergeProgress(local, remote);
}

// 以下の関数はDataMergerクラスに移行済み
// - mergeArraysByDate -> DataMerger.mergeStudySessions
// - mergeIncorrectQuestions -> DataMerger.mergeIncorrectQuestions
// - mergeOvercomeQuestions -> DataMerger.mergeOvercomeQuestions
// - mergeCategoryProgress -> DataMerger.mergeCategoryProgress

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