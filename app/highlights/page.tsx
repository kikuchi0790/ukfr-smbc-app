'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import HighlightsList from '@/components/HighlightsList';
import { Highlight } from '@/types';

export default function HighlightsPage() {
  const router = useRouter();

  const handleHighlightClick = (highlight: Highlight) => {
    // 該当する教材に遷移
    const params = new URLSearchParams({
      autoOpen: highlight.materialId,
      highlightId: highlight.id,
    });
    router.push(`/materials?${params.toString()}`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="p-2 text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-100">ハイライト一覧</h1>
                  <p className="text-sm text-gray-400 mt-1">保存したハイライトを確認・管理</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <HighlightsList onHighlightClick={handleHighlightClick} />
            </div>

            {/* 使い方の説明 */}
            <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-100 mb-3">ハイライトの使い方</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>教材ビューでテキストを選択すると、ハイライトメニューが表示されます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">•</span>
                  <span>4つの色（黄、緑、赤、青）から選択できます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>ノートを追加して、重要なポイントをメモできます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span>問題演習から教材に移動した際のハイライトは、問題IDと関連付けられます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <span>ハイライトをクリックすると、該当する教材ページに移動します</span>
                </li>
              </ul>
            </div>

            {/* 統計情報 */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-1">0</div>
                <div className="text-sm text-gray-400">黄色のハイライト</div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">0</div>
                <div className="text-sm text-gray-400">緑のハイライト</div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">0</div>
                <div className="text-sm text-gray-400">赤のハイライト</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}