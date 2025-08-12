import { useState, useEffect } from 'react';
import { Highlight } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Highlighter, Calendar, FileText, ExternalLink } from 'lucide-react';
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
    loadHighlights();
  }, [user?.id]);

  const loadHighlights = () => {
    try {
      const allHighlights: Highlight[] = [];
      
      // LocalStorageからすべてのハイライトを取得
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`highlights_${user?.id}_`)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              allHighlights.push(...parsed);
            }
          }
        }
      }
      
      setHighlights(allHighlights);
    } catch (error) {
      console.error('Failed to load highlights:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // 色別の統計
  const colorStats = {
    yellow: highlights.filter(h => h.color === 'yellow').length,
    green: highlights.filter(h => h.color === 'green').length,
    red: highlights.filter(h => h.color === 'red').length,
    blue: highlights.filter(h => h.color === 'blue').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Highlighter className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-300">まだハイライトがありません</p>
        <p className="text-sm mt-2 text-gray-500">教材でテキストを選択してハイライトを作成しましょう</p>
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
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            すべて ({highlights.length})
          </button>
          <button
            onClick={() => setFilter('checkpoint')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'checkpoint' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Checkpoint
          </button>
          <button
            onClick={() => setFilter('companion')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'companion' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Study Companion
          </button>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'material')}
          className="px-3 py-1 rounded border border-gray-600 bg-gray-700 text-gray-200 text-sm"
        >
          <option value="date">日付順</option>
          <option value="material">教材順</option>
        </select>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2 text-center">
          <div className="text-xl font-bold text-yellow-400">{colorStats.yellow}</div>
          <div className="text-xs text-yellow-300">黄色</div>
        </div>
        <div className="bg-green-900/30 border border-green-700 rounded p-2 text-center">
          <div className="text-xl font-bold text-green-400">{colorStats.green}</div>
          <div className="text-xs text-green-300">緑</div>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded p-2 text-center">
          <div className="text-xl font-bold text-red-400">{colorStats.red}</div>
          <div className="text-xs text-red-300">赤</div>
        </div>
        <div className="bg-blue-900/30 border border-blue-700 rounded p-2 text-center">
          <div className="text-xl font-bold text-blue-400">{colorStats.blue}</div>
          <div className="text-xs text-blue-300">青</div>
        </div>
      </div>

      {/* ハイライト一覧 */}
      <div className="space-y-3">
        {filteredHighlights.map((highlight) => (
          <div
            key={highlight.id}
            className={`p-4 rounded-lg border-2 ${getHighlightColor(highlight.color)} cursor-pointer hover:shadow-md transition-shadow bg-opacity-20`}
            onClick={() => onHighlightClick?.(highlight)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">
                  {getMaterialName(highlight.materialId)}
                </span>
                {highlight.anchor?.pageNumber > 0 && (
                  <span className="text-xs text-gray-500">
                    ページ {highlight.anchor.pageNumber}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick?.(highlight);
                }}
                className="p-1 hover:bg-gray-700/50 rounded"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <p className="text-gray-200 mb-2 line-clamp-2">
              "{highlight.text}"
            </p>

            {highlight.note && (
              <div className="bg-gray-800/50 rounded p-2 mb-2">
                <p className="text-sm text-gray-300">{highlight.note.content}</p>
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