import { useState, useEffect } from 'react';
import { Highlight } from '@/types';
import { getAllHighlights } from '@/services/highlight-sync';
import { useAuth } from '@/contexts/AuthContext';
import { Highlighter, Calendar, FileText, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface HighlightsListProps {
  onHighlightClick?: (highlight: Highlight) => void;
}

export default function HighlightsList({ onHighlightClick }: HighlightsListProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'checkpoint' | 'companion'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'material'>('date');

  useEffect(() => {
    if (!user?.id) return;

    const loadHighlights = async () => {
      try {
        const allHighlights = await getAllHighlights(user.id);
        setHighlights(allHighlights);
      } catch (error) {
        console.error('Failed to load highlights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHighlights();
  }, [user?.id]);

  const getHighlightColor = (color: string) => {
    const colors: Record<string, string> = {
      yellow: 'bg-yellow-200 border-yellow-400',
      green: 'bg-green-200 border-green-400',
      red: 'bg-red-200 border-red-400',
      blue: 'bg-blue-200 border-blue-400'
    };
    return colors[color] || colors.yellow;
  };

  const getMaterialName = (materialId: string) => {
    if (materialId.includes('Checkpoint')) return 'Checkpoint';
    if (materialId.includes('Study_Companion')) return 'Study Companion';
    return materialId;
  };

  const filteredHighlights = highlights
    .filter(h => {
      if (filter === 'all') return true;
      if (filter === 'checkpoint') return h.materialId.includes('Checkpoint');
      if (filter === 'companion') return h.materialId.includes('Study_Companion');
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.materialId.localeCompare(b.materialId);
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Highlighter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>まだハイライトがありません</p>
        <p className="text-sm mt-2">教材でテキストを選択してハイライトを作成しましょう</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* フィルターとソート */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて ({highlights.length})
          </button>
          <button
            onClick={() => setFilter('checkpoint')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'checkpoint' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Checkpoint
          </button>
          <button
            onClick={() => setFilter('companion')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'companion' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Study Companion
          </button>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'material')}
          className="px-3 py-1 rounded border border-gray-300 text-sm"
        >
          <option value="date">日付順</option>
          <option value="material">教材順</option>
        </select>
      </div>

      {/* ハイライト一覧 */}
      <div className="space-y-3">
        {filteredHighlights.map((highlight) => (
          <div
            key={highlight.id}
            className={`p-4 rounded-lg border-2 ${getHighlightColor(highlight.color)} cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => onHighlightClick?.(highlight)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {getMaterialName(highlight.materialId)}
                </span>
                {highlight.pageNumber && (
                  <span className="text-xs text-gray-500">
                    ページ {highlight.pageNumber}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // 削除機能は別途実装
                }}
                className="p-1 hover:bg-white/50 rounded"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <p className="text-gray-800 mb-2 line-clamp-2">
              "{highlight.text}"
            </p>

            {highlight.note && (
              <div className="bg-white/50 rounded p-2 mb-2">
                <p className="text-sm text-gray-700">{highlight.note}</p>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>
                  {format(new Date(highlight.createdAt), 'yyyy年MM月dd日', { locale: ja })}
                </span>
              </div>
              {highlight.relatedQuestionId && (
                <div className="flex items-center gap-1">
                  <span>問題ID: {highlight.relatedQuestionId}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}