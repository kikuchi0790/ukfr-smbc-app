import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Highlight } from '@/types';
import { safeLocalStorage } from '@/utils/storage-utils';

// ローカルストレージのキー
const HIGHLIGHTS_KEY = 'userHighlights';

// ハイライトをFirestoreに保存
export async function saveHighlight(userId: string, highlight: Highlight): Promise<void> {
  if (!db) {
    console.warn('Firebase is not initialized. Saving to local storage only.');
    saveHighlightToLocal(highlight);
    return;
  }

  try {
    // Firestoreに保存
    const highlightRef = doc(db, 'users', userId, 'highlights', highlight.id);
    await setDoc(highlightRef, highlight);
    
    // ローカルストレージにも保存
    saveHighlightToLocal(highlight);
    
    console.log('ハイライトが保存されました:', highlight.id);
  } catch (error) {
    console.error('ハイライト保存エラー:', error);
    // エラー時はローカルストレージのみに保存
    saveHighlightToLocal(highlight);
    throw error;
  }
}

// ハイライトを削除
export async function deleteHighlight(userId: string, highlightId: string): Promise<void> {
  if (!db) {
    console.warn('Firebase is not initialized. Deleting from local storage only.');
    deleteHighlightFromLocal(highlightId);
    return;
  }

  try {
    // Firestoreから削除
    const highlightRef = doc(db, 'users', userId, 'highlights', highlightId);
    await deleteDoc(highlightRef);
    
    // ローカルストレージからも削除
    deleteHighlightFromLocal(highlightId);
    
    console.log('ハイライトが削除されました:', highlightId);
  } catch (error) {
    console.error('ハイライト削除エラー:', error);
    throw error;
  }
}

// 特定の教材のハイライトを取得
export async function getHighlightsForMaterial(userId: string, materialId: string): Promise<Highlight[]> {
  if (!db) {
    console.warn('Firebase is not initialized. Getting from local storage only.');
    return getHighlightsFromLocal(materialId);
  }

  try {
    // Firestoreから取得
    const highlightsRef = collection(db, 'users', userId, 'highlights');
    const q = query(highlightsRef, where('materialId', '==', materialId));
    const snapshot = await getDocs(q);
    
    const highlights: Highlight[] = [];
    snapshot.forEach((doc) => {
      highlights.push(doc.data() as Highlight);
    });
    
    // ローカルストレージと同期
    syncHighlightsToLocal(materialId, highlights);
    
    return highlights;
  } catch (error) {
    console.error('ハイライト取得エラー:', error);
    // エラー時はローカルストレージから取得
    return getHighlightsFromLocal(materialId);
  }
}

// すべてのハイライトを取得
export async function getAllHighlights(userId: string): Promise<Highlight[]> {
  if (!db) {
    console.warn('Firebase is not initialized. Getting from local storage only.');
    return getAllHighlightsFromLocal();
  }

  try {
    const highlightsRef = collection(db, 'users', userId, 'highlights');
    const snapshot = await getDocs(highlightsRef);
    
    const highlights: Highlight[] = [];
    snapshot.forEach((doc) => {
      highlights.push(doc.data() as Highlight);
    });
    
    return highlights;
  } catch (error) {
    console.error('全ハイライト取得エラー:', error);
    return getAllHighlightsFromLocal();
  }
}

// リアルタイム同期のセットアップ
export function setupHighlightSync(userId: string, materialId: string, callback: (highlights: Highlight[]) => void): () => void {
  if (!db) {
    console.warn('Firebase is not initialized. Real-time sync is not available.');
    return () => {};
  }

  const highlightsRef = collection(db, 'users', userId, 'highlights');
  const q = query(highlightsRef, where('materialId', '==', materialId));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const highlights: Highlight[] = [];
    snapshot.forEach((doc) => {
      highlights.push(doc.data() as Highlight);
    });
    
    // ローカルストレージと同期
    syncHighlightsToLocal(materialId, highlights);
    
    // コールバックを実行
    callback(highlights);
  }, (error) => {
    console.error('リアルタイム同期エラー:', error);
  });
  
  return unsubscribe;
}

// ローカルストレージ操作関数
function saveHighlightToLocal(highlight: Highlight): void {
  const highlights = safeLocalStorage.getItem<Record<string, Highlight>>(HIGHLIGHTS_KEY) || {};
  highlights[highlight.id] = highlight;
  safeLocalStorage.setItem(HIGHLIGHTS_KEY, highlights);
}

function deleteHighlightFromLocal(highlightId: string): void {
  const highlights = safeLocalStorage.getItem<Record<string, Highlight>>(HIGHLIGHTS_KEY) || {};
  delete highlights[highlightId];
  safeLocalStorage.setItem(HIGHLIGHTS_KEY, highlights);
}

function getHighlightsFromLocal(materialId: string): Highlight[] {
  const highlights = safeLocalStorage.getItem<Record<string, Highlight>>(HIGHLIGHTS_KEY) || {};
  return Object.values(highlights).filter(h => h.materialId === materialId);
}

function getAllHighlightsFromLocal(): Highlight[] {
  const highlights = safeLocalStorage.getItem<Record<string, Highlight>>(HIGHLIGHTS_KEY) || {};
  return Object.values(highlights);
}

function syncHighlightsToLocal(materialId: string, highlights: Highlight[]): void {
  const allHighlights = safeLocalStorage.getItem<Record<string, Highlight>>(HIGHLIGHTS_KEY) || {};
  
  // 既存のハイライトから該当する教材のものを削除
  Object.keys(allHighlights).forEach(key => {
    if (allHighlights[key].materialId === materialId) {
      delete allHighlights[key];
    }
  });
  
  // 新しいハイライトを追加
  highlights.forEach(highlight => {
    allHighlights[highlight.id] = highlight;
  });
  
  safeLocalStorage.setItem(HIGHLIGHTS_KEY, allHighlights);
}