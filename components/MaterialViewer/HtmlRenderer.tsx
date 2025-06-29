import React, { useEffect, useRef, useCallback, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { HighlightAnchor } from '@/types';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface HtmlRendererProps {
  htmlContent: string;
  searchTerm: string;
  temporaryHighlight: HighlightAnchor | null;
}

function HtmlRenderer({ htmlContent, searchTerm, temporaryHighlight }: HtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchResults, setSearchResults] = useState<Range[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchCount, setSearchCount] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      const shadowRoot = containerRef.current.shadowRoot;
      if (shadowRoot) {
        // Sanitize HTML content to prevent XSS attacks
      const sanitizedContent = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                       'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u', 
                       'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                       'img', 'blockquote', 'pre', 'code'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
      shadowRoot.innerHTML = sanitizedContent;

        // Clear previous search highlights
        clearSearchHighlights(shadowRoot);
        
        if (searchTerm && searchTerm.trim().length > 0) {
          const results = highlightSearchTerms(shadowRoot, searchTerm);
          setSearchResults(results);
          setSearchCount(results.length);
          setCurrentSearchIndex(0);
          
          // Scroll to first result if found
          if (results.length > 0) {
            scrollToSearchResult(results[0]);
          }
        } else {
          setSearchResults([]);
          setSearchCount(0);
          setCurrentSearchIndex(0);
        }

        if (temporaryHighlight) {
          try {
            const element = shadowRoot.querySelector(temporaryHighlight.selector);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Apply temporary highlight style
              (element as HTMLElement).style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
              
              // Remove highlight after 3 seconds
              setTimeout(() => {
                (element as HTMLElement).style.backgroundColor = '';
              }, 3000);
            }
          } catch (error) {
            console.error('Failed to apply temporary highlight:', error, temporaryHighlight);
          }
        }
      }
    }
  }, [htmlContent, searchTerm, temporaryHighlight]);

  useEffect(() => {
    if (containerRef.current && !containerRef.current.shadowRoot) {
      containerRef.current.attachShadow({ mode: 'open' });
    }
  }, []);

  // Function to highlight search terms
  const highlightSearchTerms = (root: ShadowRoot, term: string): Range[] => {
    const results: Range[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent || '';
          if (text.toLowerCase().includes(term.toLowerCase())) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let node;
    let highlightIndex = 0;
    while (node = walker.nextNode()) {
      const text = node.textContent || '';
      const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[1].length);
        
        // Create highlight span
        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.setAttribute('data-highlight-index', String(highlightIndex));
        span.style.backgroundColor = highlightIndex === 0 ? '#ff9632' : '#ffeb3b';
        span.style.color = '#000';
        span.style.padding = '0 2px';
        span.style.borderRadius = '2px';
        
        try {
          range.surroundContents(span);
          results.push(range);
          highlightIndex++;
        } catch (e) {
          // Range may span multiple elements, skip this match
          console.warn('Failed to highlight match:', e);
        }
      }
    }
    
    return results;
  };
  
  // Function to clear search highlights
  const clearSearchHighlights = (root: ShadowRoot) => {
    const highlights = root.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent?.insertBefore(highlight.firstChild, highlight);
      }
      parent?.removeChild(highlight);
    });
  };
  
  // Function to scroll to search result
  const scrollToSearchResult = (range: Range) => {
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: rect.top + container.scrollTop - container.offsetHeight / 2,
        behavior: 'smooth'
      });
    }
  };
  
  // Navigate to next search result
  const nextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(newIndex);
    
    // Update highlight colors
    const shadowRoot = containerRef.current?.shadowRoot;
    if (shadowRoot) {
      const highlights = shadowRoot.querySelectorAll('.search-highlight');
      highlights.forEach((highlight, index) => {
        (highlight as HTMLElement).style.backgroundColor = 
          index === newIndex ? '#ff9632' : '#ffeb3b';
      });
    }
    
    scrollToSearchResult(searchResults[newIndex]);
  }, [searchResults, currentSearchIndex]);
  
  // Navigate to previous search result
  const prevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex === 0 
      ? searchResults.length - 1 
      : currentSearchIndex - 1;
    setCurrentSearchIndex(newIndex);
    
    // Update highlight colors
    const shadowRoot = containerRef.current?.shadowRoot;
    if (shadowRoot) {
      const highlights = shadowRoot.querySelectorAll('.search-highlight');
      highlights.forEach((highlight, index) => {
        (highlight as HTMLElement).style.backgroundColor = 
          index === newIndex ? '#ff9632' : '#ffeb3b';
      });
    }
    
    scrollToSearchResult(searchResults[newIndex]);
  }, [searchResults, currentSearchIndex]);
  
  // Escape special regex characters
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  };

  return (
    <div className="relative">
      {searchTerm && searchCount > 0 && (
        <div className="fixed top-16 right-4 bg-white shadow-lg rounded-lg p-3 z-50 border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {currentSearchIndex + 1} / {searchCount} 件
            </span>
            <button
              onClick={prevSearchResult}
              className="p-1 hover:bg-gray-100 rounded"
              title="前の検索結果"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={nextSearchResult}
              className="p-1 hover:bg-gray-100 rounded"
              title="次の検索結果"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div ref={containerRef} className="html-content-container" />
    </div>
  );
}

export default React.memo(HtmlRenderer);
