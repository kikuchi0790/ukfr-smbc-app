import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Highlight, HighlightColor, HighlightAnchor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import HighlightPopup from './HighlightPopup';
import NoteEditor from './MaterialViewer/NoteEditor';

interface HighlightManagerProps {
  materialId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  relatedQuestionId?: string;
  children: React.ReactNode;
}

export default function HighlightManager({ materialId, contentRef, relatedQuestionId, children }: HighlightManagerProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [editingNote, setEditingNote] = useState<Highlight | null>(null);
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);

  // Load highlights from localStorage
  useEffect(() => {
    if (!user) return;
    loadHighlights();
  }, [user, materialId]);

  const loadHighlights = () => {
    if (!user) return;
    const storageKey = `highlights_${user.id}_${materialId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setHighlights(parsed);
      } catch (error) {
        console.error('Failed to load highlights:', error);
      }
    }
  };

  const saveHighlights = (newHighlights: Highlight[]) => {
    if (!user) return;
    const storageKey = `highlights_${user.id}_${materialId}`;
    localStorage.setItem(storageKey, JSON.stringify(newHighlights));
    setHighlights(newHighlights);
  };

  const handleMouseUp = (e: MouseEvent) => {
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

    if (!contentRef.current?.contains(selection.anchorNode)) {
      setShowPopup(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedRange(range.cloneRange());
    setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setShowPopup(true);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [contentRef]);

  const handleColorSelect = async (color: HighlightColor) => {
    if (!selectedRange || !user) return;

    const anchor = createAnchor(selectedRange);
    if (!anchor) return;

    const newHighlight: Highlight = {
      id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      materialId,
      text: selectedRange.toString(),
      anchor,
      color,
      relatedQuestionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: {}
    };

    const updatedHighlights = [...highlights, newHighlight];
    saveHighlights(updatedHighlights);
    setShowPopup(false);
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const createAnchor = (range: Range): HighlightAnchor | null => {
    try {
      const selectedText = range.toString();
      
      // Get parent element
      const startContainer = range.startContainer;
      const startElement = startContainer.nodeType === Node.TEXT_NODE 
        ? startContainer.parentElement 
        : startContainer as Element;
      
      if (!startElement) return null;

      // Create simple selector
      let selector = startElement.tagName.toLowerCase();
      if (startElement.id) {
        selector = `#${startElement.id}`;
      } else if (startElement.className) {
        const classes = startElement.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }

      // Get context text
      const beforeText = startContainer.textContent?.slice(
        Math.max(0, range.startOffset - 30), 
        range.startOffset
      ) || '';
      
      const afterText = range.endContainer.textContent?.slice(
        range.endOffset,
        Math.min(range.endContainer.textContent?.length || 0, range.endOffset + 30)
      ) || '';

      return {
        selector,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        selectedText,
        beforeText,
        afterText,
        pageNumber: 0, // For PDF support later
        textQuote: {
          exact: selectedText,
          prefix: beforeText,
          suffix: afterText,
        }
      };
    } catch (error) {
      console.error('Failed to create anchor:', error);
      return null;
    }
  };

  const handleDeleteHighlight = (highlightId: string) => {
    const updatedHighlights = highlights.filter(h => h.id !== highlightId);
    saveHighlights(updatedHighlights);
  };

  const handleSaveNote = (highlightId: string, noteContent: string) => {
    const updatedHighlights = highlights.map(h => {
      if (h.id === highlightId) {
        return {
          ...h,
          note: {
            content: noteContent,
            updatedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        };
      }
      return h;
    });
    saveHighlights(updatedHighlights);
    setEditingNote(null);
  };

  // Render highlights (DOM-safe using Range.surroundContents when possible)
  useEffect(() => {
    if (!contentRef.current) return;

    // Clear existing highlight spans
    const existingHighlights = contentRef.current.querySelectorAll('.user-highlight');
    existingHighlights.forEach(el => {
      const text = el.textContent || '';
      const textNode = document.createTextNode(text);
      el.parentNode?.replaceChild(textNode, el);
    });

    // Apply highlights
    const root = contentRef.current;
    const applyHighlightToElement = (element: Element, highlight: Highlight) => {
      const selected = highlight.anchor.selectedText;
      if (!selected) return false;

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const textNode = node as Text;
        let idx = textNode.data.indexOf(selected);
        while (idx !== -1) {
          const range = document.createRange();
          range.setStart(textNode, idx);
          range.setEnd(textNode, idx + selected.length);

          // If textQuote exists, verify context
          const tq = highlight.anchor.textQuote;
          if (tq) {
            const before = textNode.data.slice(Math.max(0, idx - 30), idx);
            const after = textNode.data.slice(idx + selected.length, idx + selected.length + 30);
            if (tq.prefix && !before.endsWith(tq.prefix.slice(-Math.min(30, tq.prefix.length)))) {
              idx = textNode.data.indexOf(selected, idx + 1);
              continue;
            }
            if (tq.suffix && !after.startsWith(tq.suffix.slice(0, Math.min(30, tq.suffix.length)))) {
              idx = textNode.data.indexOf(selected, idx + 1);
              continue;
            }
          }

          try {
            const span = document.createElement('span');
            span.className = 'user-highlight';
            span.style.backgroundColor = getColorValue(highlight.color);
            span.style.opacity = '0.4';
            span.style.cursor = 'pointer';
            span.onclick = () => setEditingNote(highlight);
            range.surroundContents(span);
            return true;
          } catch {
            // If surroundContents fails (range partially selects), skip to next occurrence
            idx = textNode.data.indexOf(selected, idx + 1);
          }
        }
      }
      return false;
    };

    highlights.forEach(highlight => {
      try {
        const elements = root.querySelectorAll(highlight.anchor.selector);
        let done = false;
        if (elements.length > 0) {
          elements.forEach(element => {
            if (!done) done = applyHighlightToElement(element, highlight);
          });
        }
        // Fallback: search in entire root using textQuote if selector failed
        if (!done) {
          applyHighlightToElement(root, highlight);
        }
      } catch (error) {
        console.error('Failed to render highlight:', error);
      }
    });
  }, [highlights, contentRef]);

  const getColorValue = (color: string): string => {
    const colorMap: Record<string, string> = {
      yellow: '#fef08a',
      green: '#bbf7d0',
      red: '#fecaca',
      blue: '#bfdbfe',
    };
    return colorMap[color] || colorMap.yellow;
  };

  return (
    <div className="h-full">
      {children}
      
      {showPopup && (
        <HighlightPopup
          position={popupPosition}
          onSelectColor={handleColorSelect}
          onClose={() => setShowPopup(false)}
          onNote={() => {
            // Create highlight with note
            handleColorSelect('yellow');
          }}
        />
      )}
      
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-100 mb-3">ノートを編集</h3>
            <NoteEditor
              initialContent={editingNote.note?.content || ''}
              onSave={(content) => {
                handleSaveNote(editingNote.id, content);
                setEditingNote(null);
              }}
              onCancel={() => setEditingNote(null)}
            />
            <button
              onClick={() => {
                handleDeleteHighlight(editingNote.id);
                setEditingNote(null);
              }}
              className="mt-2 text-red-400 text-sm hover:text-red-300"
            >
              ハイライトを削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}