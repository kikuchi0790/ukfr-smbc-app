import React, { useEffect, useState, useCallback, useRef } from 'react';
// @ts-ignore
const uniqueSelector: any = require('unique-selector');
import { Highlight, HighlightColor, HighlightAnchor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import HighlightService from '@/services/data/highlight.service';
import HighlightPopup from './HighlightPopup';
import HighlightLayer from './MaterialViewer/HighlightLayer';
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
  const highlightService = user ? new HighlightService(user.id) : null;

  useEffect(() => {
    if (highlightService) {
      const unsubscribe = highlightService.subscribeToMaterial(materialId, setHighlights);
      return () => unsubscribe();
    }
  }, [highlightService, materialId]);

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
    if (!selectedRange || !highlightService) return;

    const anchor = createAnchor(selectedRange);
    if (!anchor) return;

    const newHighlight: Omit<Highlight, 'updatedAt' | 'versions'> = {
      id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user!.id,
      materialId,
      text: selectedRange.toString(),
      anchor,
      color,
      relatedQuestionId,
      createdAt: new Date().toISOString(),
    };

    await highlightService.save(newHighlight);
    setShowPopup(false);
  };

  const createAnchor = (range: Range): HighlightAnchor | null => {
    try {
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      const selectedText = range.toString();
      
      // Get parent elements for selector generation
      const startElement = startContainer.nodeType === Node.TEXT_NODE 
        ? startContainer.parentElement 
        : startContainer as Element;
      const endElement = endContainer.nodeType === Node.TEXT_NODE 
        ? endContainer.parentElement 
        : endContainer as Element;
      
      if (!startElement || !endElement) return null;

      // Generate unique selector using the unique-selector library
      // This creates a more robust and specific selector
      let selector: string;
      try {
        // If start and end are in the same element, use that element's selector
        if (startElement === endElement) {
          selector = uniqueSelector(startElement, {
            selectorTypes: ['id', 'class', 'tag', 'attribute', 'nthchild']
          });
        } else {
          // Find common ancestor and generate selector for it
          const commonAncestor = range.commonAncestorContainer;
          const ancestorElement = commonAncestor.nodeType === Node.TEXT_NODE
            ? commonAncestor.parentElement
            : commonAncestor as Element;
          
          if (ancestorElement) {
            selector = uniqueSelector(ancestorElement, {
              selectorTypes: ['id', 'class', 'tag', 'attribute', 'nthchild']
            });
          } else {
            // Fallback to start element
            selector = uniqueSelector(startElement, {
              selectorTypes: ['id', 'class', 'tag', 'attribute', 'nthchild']
            });
          }
        }
      } catch (selectorError) {
        console.warn('Failed to generate unique selector, using fallback', selectorError);
        // Fallback to a simpler selector
        selector = startElement.tagName.toLowerCase();
        if (startElement.id) {
          selector = `#${startElement.id}`;
        } else if (startElement.className) {
          selector += `.${startElement.className.split(' ')[0]}`;
        }
      }

      // Get context text for fallback searching
      const beforeText = startContainer.textContent?.slice(
        Math.max(0, range.startOffset - 30), 
        range.startOffset
      ) || '';
      
      const afterText = endContainer.textContent?.slice(
        range.endOffset,
        Math.min(endContainer.textContent?.length || 0, range.endOffset + 30)
      ) || '';

      // Calculate relative offsets within the element
      const elementText = startElement.textContent || '';
      const selectedIndex = elementText.indexOf(selectedText);
      const relativeStartOffset = selectedIndex >= 0 ? selectedIndex : range.startOffset;
      const relativeEndOffset = relativeStartOffset + selectedText.length;

      // Get page number for PDFs (if available)
      const pageNumber = getPageNumber(startElement);

      return {
        selector,
        startOffset: relativeStartOffset,
        endOffset: relativeEndOffset,
        selectedText,
        beforeText,
        afterText,
        pageNumber
      };
    } catch (error) {
      console.error('Failed to create anchor:', error);
      return null;
    }
  };

  // Helper function to get page number for PDF content
  const getPageNumber = (element: Element): number => {
    // Look for page container in PDF viewer
    const pageContainer = element.closest('[data-page-number]');
    if (pageContainer) {
      const pageNum = pageContainer.getAttribute('data-page-number');
      return pageNum ? parseInt(pageNum, 10) : 1;
    }
    
    // Check for react-pdf page class
    const pdfPage = element.closest('.react-pdf__Page');
    if (pdfPage) {
      const pageMatch = pdfPage.className.match(/react-pdf__Page__page(\d+)/);
      if (pageMatch) {
        return parseInt(pageMatch[1], 10);
      }
    }
    
    return 1; // Default to page 1
  };

  const handleNoteClick = (highlight: Highlight) => {
    setEditingNote(highlight);
  };

  const handleSaveNote = async (content: string) => {
    if (editingNote && highlightService) {
      await highlightService.saveNote(editingNote.id, content);
      setEditingNote(null);
    }
  };

  return (
    <>
      {children}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <NoteEditor
            initialContent={editingNote.note?.content || ''}
            onSave={handleSaveNote}
            onCancel={() => setEditingNote(null)}
          />
        </div>
      )}
      {showPopup && (
        <div className="highlight-popup">
          <HighlightPopup
            position={popupPosition}
            onSelectColor={handleColorSelect}
            onClose={() => setShowPopup(false)}
            onNote={() => {
              // This is a placeholder. In a real implementation, we would create a temporary highlight
              // object here and then open the note editor.
              setShowPopup(false);
            }}
          />
        </div>
      )}
      <HighlightLayer 
        highlights={highlights} 
        materialId={materialId}
        contentRef={contentRef} 
        onHighlightClick={handleNoteClick} 
      />
    </>
  );
}