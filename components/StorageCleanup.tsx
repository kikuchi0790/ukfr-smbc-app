'use client';

import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { safeLocalStorage } from '@/utils/storage-utils';

export default function StorageCleanup() {
  const [showModal, setShowModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  
  const getStorageInfo = () => {
    const info = safeLocalStorage.getStorageInfo();
    const percentage = info.percentage;
    const usedMB = (info.used / 1024 / 1024).toFixed(2);
    const totalMB = (info.total / 1024 / 1024).toFixed(2);
    
    return {
      percentage,
      usedMB,
      totalMB,
      isNearLimit: percentage > 80
    };
  };
  
  const cleanupStorage = async () => {
    setCleaning(true);
    
    try {
      // 削除対象のキーを収集
      const keysToDelete: string[] = [];
      let sessionsCleaned = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // 一時的なMock試験結果（すべて削除）
        if (key.startsWith('tempMockResult_')) {
          keysToDelete.push(key);
        }
        
        // Mock試験の進捗（すべて削除）
        if (key.startsWith('mockExamProgress_')) {
          keysToDelete.push(key);
        }
        
        // 最新のMock試験結果（すべて削除）
        if (key.startsWith('latestMockExam_')) {
          keysToDelete.push(key);
        }
        
        // 回答済み問題トラッカー（すべて削除）
        if (key === 'answeredQuestionsTracker') {
          keysToDelete.push(key);
        }
        
        // Mock試験履歴（最新10件のみ保持）
        if (key.startsWith('mockExamHistory_')) {
          try {
            const data = safeLocalStorage.getItem<any[]>(key) || [];
            if (data.length > 10) {
              safeLocalStorage.setItem(key, data.slice(-10));
            }
          } catch (error) {
            console.error('Failed to clean mock exam history:', error);
          }
        }
        
        // 学習セッション（questionsフィールドを削除、最新30件のみ保持）
        if (key.startsWith('userProgress_')) {
          try {
            const progress = safeLocalStorage.getItem<any>(key);
            if (progress && progress.studySessions) {
              // questionsフィールドを削除
              progress.studySessions = progress.studySessions.map((session: any) => {
                if (session.questions) {
                  sessionsCleaned++;
                  const { questions, ...rest } = session;
                  return {
                    ...rest,
                    questionIds: questions.map((q: any) => q.questionId || q)
                  };
                }
                return session;
              });
              
              // 最新30件のみ保持
              if (progress.studySessions.length > 30) {
                progress.studySessions = progress.studySessions.slice(-30);
              }
              
              safeLocalStorage.setItem(key, progress);
            }
          } catch (error) {
            console.error('Failed to clean study sessions:', error);
          }
        }
      }
      
      // 削除実行
      keysToDelete.forEach(key => localStorage.removeItem(key));
      
      const newInfo = getStorageInfo();
      alert(`クリーンアップが完了しました。\n削除: ${keysToDelete.length}個\n最適化: ${sessionsCleaned}セッション\n\n使用量: ${newInfo.usedMB}MB / ${newInfo.totalMB}MB (${newInfo.percentage}%)`);
    } catch (error) {
      console.error('Storage cleanup failed:', error);
      alert('クリーンアップ中にエラーが発生しました。');
    } finally {
      setCleaning(false);
      setShowModal(false);
    }
  };
  
  const storageInfo = getStorageInfo();
  
  return (
    <>
      {storageInfo.isNearLimit && (
        <div className="fixed bottom-4 right-4 bg-orange-900/90 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">ストレージ容量が不足しています</p>
              <p className="text-sm opacity-90 mb-2">
                使用中: {storageInfo.usedMB}MB / {storageInfo.totalMB}MB ({storageInfo.percentage}%)
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="text-sm bg-orange-700 hover:bg-orange-600 px-3 py-1 rounded"
              >
                クリーンアップ
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              ストレージのクリーンアップ
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                現在の使用状況: {storageInfo.usedMB}MB / {storageInfo.totalMB}MB ({storageInfo.percentage}%)
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    storageInfo.percentage > 80 ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${storageInfo.percentage}%` }}
                />
              </div>
            </div>
            
            <p className="text-gray-300 mb-4">
              以下のデータが削除されます：
            </p>
            <ul className="list-disc list-inside text-sm text-gray-400 mb-6">
              <li>1日以上前の一時的なMock試験結果</li>
              <li>1週間以上前のMock試験履歴</li>
              <li>古い学習セッション（最新100件以外）</li>
            </ul>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={cleaning}
                className="px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={cleanupStorage}
                disabled={cleaning}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {cleaning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    クリーンアップ中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    クリーンアップ実行
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}