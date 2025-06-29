import React, { useEffect, useRef, useMemo } from 'react';
// @ts-ignore
const uniqueSelector: any = require('unique-selector');
import { Highlight, HighlightAnchor } from '@/types';
import HighlightService from '@/services/data/highlight.service';
import { useAuth } from '@/contexts/AuthContext';

interface HighlightLayerProps {
  highlights: Highlight[];
  materialId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onHighlightClick: (highlight: Highlight) => void;
}

function HighlightLayer({ highlights, materialId, contentRef, onHighlightClick }: HighlightLayerProps) {
  const { user } = useAuth();
  const highlightService = user ? new HighlightService(user.id) : null;
  const processedHighlights = useRef<Set<string>>(new Set());
  const renderHighlight = (highlight: Highlight) => {
    if (!contentRef.current) return null;

    try {
      // Try to find the element using the selector
      const element = contentRef.current.querySelector(highlight.anchor.selector);

      if (element) {
        // Attempt to find the text within the element
        const textNodes = getTextNodesIn(element);
        const range = findTextInNodes(textNodes, highlight.anchor);
        
        if (range) {
          const rects = range.getClientRects();
          const containerRect = contentRef.current.getBoundingClientRect();

          return Array.from(rects).map((rect, index) => (
            <div
              key={`${highlight.id}-${index}`}
              style={{
                position: 'absolute',
                left: `${rect.left - containerRect.left}px`,
                top: `${rect.top - containerRect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: getColorValue(highlight.color),
                opacity: 0.4,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              onClick={() => onHighlightClick(highlight)}
              title={highlight.note?.content || 'Click to add note'}
            />
          ));
        }
      } else {
        // Fallback: Search for text contextually across the entire content
        console.warn(`Selector not found for highlight ${highlight.id}, attempting contextual search`);
        const range = findTextContextually(contentRef.current, highlight.anchor);
        
        if (range) {
          // Self-healing: Update the anchor with the new location
          if (highlightService && !processedHighlights.current.has(highlight.id)) {
            processedHighlights.current.add(highlight.id);
            updateHighlightAnchor(highlight, range);
          }
          
          const rects = range.getClientRects();
          const containerRect = contentRef.current.getBoundingClientRect();

          return Array.from(rects).map((rect, index) => (
            <div
              key={`${highlight.id}-${index}`}
              style={{
                position: 'absolute',
                left: `${rect.left - containerRect.left}px`,
                top: `${rect.top - containerRect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: getColorValue(highlight.color),
                opacity: 0.4,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              onClick={() => onHighlightClick(highlight)}
              title={highlight.note?.content || 'Click to add note'}
            />
          ));
        }
      }
    } catch (error) {
      console.error('Failed to render highlight:', error, highlight);
    }

    return null;
  };
  
  // Helper function to get all text nodes within an element
  const getTextNodesIn = (node: Node): Text[] => {
    const textNodes: Text[] = [];
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
    } else {
      for (const child of Array.from(node.childNodes)) {
        textNodes.push(...getTextNodesIn(child));
      }
    }
    return textNodes;
  };
  
  // Helper function to find text within nodes using anchor information
  const findTextInNodes = (textNodes: Text[], anchor: Highlight['anchor']): Range | null => {
    const fullText = textNodes.map(node => node.textContent || '').join('');
    const searchText = anchor.beforeText + anchor.selectedText + anchor.afterText;
    const index = fullText.indexOf(searchText);
    
    if (index !== -1) {
      const startIndex = index + anchor.beforeText.length;
      const endIndex = startIndex + anchor.selectedText.length;
      
      // Create range from character indices
      let charCount = 0;
      const range = document.createRange();
      
      for (const node of textNodes) {
        const nodeLength = node.textContent?.length || 0;
        
        if (charCount + nodeLength >= startIndex && !range.startContainer) {
          range.setStart(node, startIndex - charCount);
        }
        
        if (charCount + nodeLength >= endIndex) {
          range.setEnd(node, endIndex - charCount);
          break;
        }
        
        charCount += nodeLength;
      }
      
      return range;
    }
    
    return null;
  };
  
  // Fallback function to search for text contextually in the entire content
  const findTextContextually = (container: HTMLElement, anchor: Highlight['anchor']): Range | null => {
    const textNodes = getTextNodesIn(container);
    return findTextInNodes(textNodes, anchor);
  };
  
  // Helper function to get color value
  const getColorValue = (color: string): string => {
    const colorMap: Record<string, string> = {
      yellow: '#fef08a',
      green: '#bbf7d0',
      red: '#fecaca',
      blue: '#bfdbfe',
    };
    return colorMap[color] || colorMap.yellow;
  };

  // Self-healing function to update anchor when found at new location
  const updateHighlightAnchor = async (highlight: Highlight, range: Range) => {
    if (!highlightService) return;
    
    try {
      const startElement = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer as Element;
      
      if (!startElement) return;
      
      // Generate new selector for the found location
      const newSelector = uniqueSelector(startElement, {
        selectorTypes: ['id', 'class', 'tag', 'attribute', 'nthchild']
      });
      
      // Calculate relative offsets
      const elementText = startElement.textContent || '';
      const selectedText = range.toString();
      const selectedIndex = elementText.indexOf(selectedText);
      const relativeStartOffset = selectedIndex >= 0 ? selectedIndex : range.startOffset;
      const relativeEndOffset = relativeStartOffset + selectedText.length;
      
      // Create updated anchor
      const newAnchor: HighlightAnchor = {
        ...highlight.anchor,
        selector: newSelector,
        startOffset: relativeStartOffset,
        endOffset: relativeEndOffset
      };
      
      // Update the highlight with new anchor
      await highlightService.updateAnchor(highlight.id, newAnchor);
      console.log(`Updated anchor for highlight ${highlight.id}`);
    } catch (error) {
      console.error('Failed to update highlight anchor:', error);
    }
  };
  
  // Clear processed highlights when highlights change
  useEffect(() => {
    processedHighlights.current.clear();
  }, [highlights]);
  
  const highlightElements = useMemo(() => {
    return highlights.map(renderHighlight);
  }, [highlights, contentRef]);
  
  return <>{highlightElements}</>;
}

export default React.memo(HighlightLayer, (prevProps, nextProps) => {
  return (
    prevProps.highlights === nextProps.highlights &&
    prevProps.materialId === nextProps.materialId &&
    prevProps.contentRef === nextProps.contentRef &&
    prevProps.onHighlightClick === nextProps.onHighlightClick
  );
});
