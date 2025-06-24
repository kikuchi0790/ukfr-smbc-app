import { useEffect, useState, useCallback, useRef } from 'react';
import { Highlight, HighlightColor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { saveHighlight, deleteHighlight, setupHighlightSync } from '@/services/highlight-sync';
import HighlightPopup from './HighlightPopup';
import { Trash2, StickyNote } from 'lucide-react';

interface HighlightManagerProps {
  materialId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  highlights: Highlight[];
  onHighlightsChange: (highlights: Highlight[]) => void;
  relatedQuestionId?: string;
}

export default function HighlightManager({
  materialId,
  contentRef,
  highlights,
  onHighlightsChange,
  relatedQuestionId
}: HighlightManagerProps) {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ハイライトの同期設定
  useEffect(() => {
    if (!user?.id || !materialId) return;

    const unsubscribe = setupHighlightSync(user.id, materialId, (syncedHighlights) => {
      onHighlightsChange(syncedHighlights);
    });

    return () => unsubscribe();
  }, [user?.id, materialId, onHighlightsChange]);

  // テキスト選択のハンドリング
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // ポップアップ内のクリックは無視
      if ((e.target as HTMLElement).closest('.highlight-popup')) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setShowPopup(false);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) {
        setShowPopup(false);
        return;
      }

      // 選択範囲がコンテンツ内かチェック
      if (!contentRef.current?.contains(selection.anchorNode)) {
        setShowPopup(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedText(text);
      setSelectedRange(range.cloneRange());
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });

      // 少し遅延してポップアップを表示
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        setShowPopup(true);
      }, 200);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [contentRef]);

  // 既存のハイライトを適用
  useEffect(() => {
    if (!contentRef.current || highlights.length === 0) return;

    // 既存のハイライトをクリア
    clearExistingHighlights();

    // ハイライトを適用
    highlights.forEach(highlight => {
      applyHighlight(highlight);
    });
  }, [highlights, contentRef]);

  const clearExistingHighlights = () => {
    if (!contentRef.current) return;

    const highlightedElements = contentRef.current.querySelectorAll('.text-highlight');
    highlightedElements.forEach(elem => {
      const parent = elem.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(elem.textContent || ''), elem);
        parent.normalize();
      }
    });
  };

  const applyHighlight = (highlight: Highlight) => {
    if (!contentRef.current) return;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let node;

    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const nodeLength = textNode.length;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLength;

      // このノードがハイライト範囲に含まれるかチェック
      if (highlight.startOffset < nodeEnd && highlight.endOffset > nodeStart) {
        const startInNode = Math.max(0, highlight.startOffset - nodeStart);
        const endInNode = Math.min(nodeLength, highlight.endOffset - nodeStart);

        if (startInNode < endInNode) {
          const span = document.createElement('span');
          span.className = `text-highlight highlight-${highlight.color}`;
          span.setAttribute('data-highlight-id', highlight.id);
          span.style.backgroundColor = getHighlightColor(highlight.color);
          span.style.padding = '2px 0';
          span.style.borderRadius = '2px';
          span.style.cursor = 'pointer';
          span.style.position = 'relative';

          const highlightedText = textNode.splitText(startInNode);
          if (endInNode < nodeLength) {
            highlightedText.splitText(endInNode - startInNode);
          }

          span.textContent = highlightedText.textContent;
          highlightedText.parentNode?.replaceChild(span, highlightedText);

          // ホバー時のツールチップ
          span.addEventListener('mouseenter', () => setHoveredHighlight(highlight.id));
          span.addEventListener('mouseleave', () => setHoveredHighlight(null));
          span.addEventListener('click', (e) => {
            e.stopPropagation();
            handleHighlightClick(highlight);
          });
        }
      }

      currentOffset += nodeLength;
    }
  };

  const getHighlightColor = (color: HighlightColor): string => {
    const colors = {
      yellow: '#fef3c7',
      green: '#d1fae5',
      red: '#fee2e2',
      blue: '#dbeafe'
    };
    return colors[color];
  };

  const handleColorSelect = async (color: HighlightColor) => {
    if (!selectedRange || !selectedText || !user?.id) return;

    // 選択範囲の開始・終了位置を計算
    const { startOffset, endOffset } = calculateOffsets(selectedRange);

    const newHighlight: Highlight = {
      id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      materialId,
      text: selectedText,
      startOffset,
      endOffset,
      color,
      relatedQuestionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveHighlight(user.id, newHighlight);
      onHighlightsChange([...highlights, newHighlight]);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  };

  const calculateOffsets = (range: Range): { startOffset: number; endOffset: number } => {
    if (!contentRef.current) return { startOffset: 0, endOffset: 0 };

    const preRange = document.createRange();
    preRange.selectNodeContents(contentRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    preRange.setEnd(range.endContainer, range.endOffset);
    const endOffset = preRange.toString().length;

    return { startOffset, endOffset };
  };

  const handleHighlightClick = (highlight: Highlight) => {
    // ハイライトのオプションメニューを表示（削除、ノート編集など）
    const confirmed = window.confirm(`このハイライトを削除しますか？\n\n"${highlight.text}"`);
    if (confirmed) {
      handleDeleteHighlight(highlight.id);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!user?.id) return;

    try {
      await deleteHighlight(user.id, highlightId);
      onHighlightsChange(highlights.filter(h => h.id !== highlightId));
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  return (
    <>
      {showPopup && (
        <div className="highlight-popup">
          <HighlightPopup
            position={popupPosition}
            onSelectColor={handleColorSelect}
            onClose={() => setShowPopup(false)}
          />
        </div>
      )}

      {/* ハイライトのツールチップ */}
      {hoveredHighlight && (
        <div className="fixed z-40 pointer-events-none">
          {highlights
            .filter(h => h.id === hoveredHighlight && h.note)
            .map(h => (
              <div
                key={h.id}
                className="bg-gray-800 text-white text-sm rounded px-2 py-1 max-w-xs"
                style={{
                  position: 'fixed',
                  // ツールチップの位置は実装時に調整
                }}
              >
                <div className="flex items-center gap-1">
                  <StickyNote className="w-3 h-3" />
                  <span>{h.note}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
}