'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Database, Trash2 } from 'lucide-react';
import { UserProgress } from '@/types';
import { safeLocalStorage } from '@/utils/storage-utils';
import { formatPercentage, formatFileSize } from '@/utils/formatters';

export default function StorageDebugInfo({ nickname }: { nickname?: string }) {
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    analyzeStorage();
  }, [nickname]);

  const analyzeStorage = () => {
    const info: {
      totalKeys: number;
      userProgressKeys: Array<{
        key: string;
        isOldKey: boolean;
        totalQuestions: number;
        categories: Record<string, {
          answered: number;
          total: number;
          percentage: number;
        }>;
      }>;
      oldDataKeys: string[];
      currentUserKey: string | null;
      storageSize: string;
    } = {
      totalKeys: localStorage.length,
      userProgressKeys: [],
      oldDataKeys: [],
      currentUserKey: nickname ? `userProgress_${nickname}` : null,
      storageSize: '0'
    };

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    // ユーザー進捗キーを分析
    keys.forEach(key => {
      if (key.startsWith('userProgress')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          const isOldKey = key === 'userProgress';
          const keyInfo: {
            key: string;
            isOldKey: boolean;
            totalQuestions: number;
            categories: Record<string, {
              answered: number;
              total: number;
              percentage: number;
            }>;
          } = {
            key,
            isOldKey,
            totalQuestions: data.totalQuestionsAnswered || 0,
            categories: {}
          };

          if (data.categoryProgress) {
            Object.entries(data.categoryProgress).forEach(([cat, prog]: [string, any]) => {
              if (prog.answeredQuestions > 0) {
                keyInfo.categories[cat] = {
                  answered: prog.answeredQuestions,
                  total: prog.totalQuestions,
                  percentage: parseFloat(formatPercentage(prog.answeredQuestions, prog.totalQuestions))
                };
              }
            });
          }

          info.userProgressKeys.push(keyInfo);
        } catch (e) {
          console.error('Error parsing key:', key, e);
        }
      }

      // 古いデータパターンを検出
      if (key === 'userProgress' || 
          key === 'mockExamHistory' ||
          key.startsWith('tempMock') ||
          key === 'mockExamProgress' ||
          key === 'latestMockExam') {
        info.oldDataKeys.push(key);
      }
    });

    // ストレージサイズを計算
    let totalSize = 0;
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    });
    info.storageSize = formatFileSize(totalSize, 2);

    setStorageInfo(info);
  };

  const handleClearOldData = () => {
    if (confirm('古いデータを削除しますか？この操作は取り消せません。')) {
      storageInfo.oldDataKeys.forEach((key: string) => {
        localStorage.removeItem(key);
      });
      analyzeStorage();
      alert('古いデータを削除しました。');
    }
  };

  if (!storageInfo) return null;

  return (
    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-yellow-500" />
          <h3 className="text-yellow-400 font-semibold">ストレージデバッグ情報</h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-yellow-500 hover:text-yellow-400 underline"
        >
          {showDetails ? '詳細を隠す' : '詳細を表示'}
        </button>
      </div>

      <div className="text-sm text-gray-300 space-y-1">
        <p>総キー数: {storageInfo.totalKeys} | ストレージ使用量: {storageInfo.storageSize}</p>
        <p>現在のユーザーキー: {storageInfo.currentUserKey || 'なし'}</p>
        
        {storageInfo.oldDataKeys.length > 0 && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-600/30 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-red-400">古いデータが検出されました ({storageInfo.oldDataKeys.length}個)</p>
              </div>
              <button
                onClick={handleClearOldData}
                className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
              >
                <Trash2 className="w-3 h-3" />
                削除
              </button>
            </div>
          </div>
        )}

        {showDetails && (
          <div className="mt-4 space-y-3">
            <h4 className="text-yellow-400 font-medium">進捗データキー詳細:</h4>
            {storageInfo.userProgressKeys.map((keyInfo: any, index: number) => (
              <div key={index} className={`p-3 rounded ${keyInfo.isOldKey ? 'bg-red-900/20 border border-red-600/30' : 'bg-gray-800/50'}`}>
                <p className="font-mono text-xs mb-2">
                  {keyInfo.key} {keyInfo.isOldKey && <span className="text-red-400">(古いデータ)</span>}
                </p>
                <p className="text-xs text-gray-400">総回答数: {keyInfo.totalQuestions}</p>
                {Object.entries(keyInfo.categories).map(([cat, data]: [string, any]) => (
                  <p key={cat} className="text-xs text-gray-400 ml-2">
                    • {cat}: {data.answered}/{data.total} ({data.percentage}%)
                  </p>
                ))}
              </div>
            ))}

            {storageInfo.oldDataKeys.length > 0 && (
              <>
                <h4 className="text-yellow-400 font-medium mt-4">検出された古いキー:</h4>
                <div className="bg-gray-800/50 p-3 rounded">
                  {storageInfo.oldDataKeys.map((key: string, index: number) => (
                    <p key={index} className="font-mono text-xs text-gray-400">• {key}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}