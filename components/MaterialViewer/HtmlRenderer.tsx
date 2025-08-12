import React, { useEffect, useRef, useCallback, useState, ForwardedRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { HighlightAnchor } from '@/types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface HtmlRendererProps {
  htmlContent: string;
  searchTerm: string;
  temporaryHighlight: HighlightAnchor | null;
}

let dompurifyHooked = false;
function ensureDompurifyHook() {
  if (dompurifyHooked) return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ((node as Element).tagName === 'A') {
      const el = node as Element;
      const href = el.getAttribute('href') || '';
      if (!/^https?:|^mailto:|^tel:/i.test(href)) {
        el.removeAttribute('href');
      }
      el.setAttribute('rel', 'noopener noreferrer nofollow ugc');
    }
    (node as Element).removeAttribute?.('style');
  });
  dompurifyHooked = true;
}

function InnerHtmlRenderer(
  { htmlContent, searchTerm, temporaryHighlight }: HtmlRendererProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = internalRef;
  // bridge forwarded ref
  const setRef = useCallback((el: HTMLDivElement | null) => {
    internalRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref && 'current' in (ref as any)) (ref as any).current = el;
  }, [ref]);
  const [searchResults, setSearchResults] = useState<Element[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Render sanitized HTML only when htmlContent changes
  useEffect(() => {
    if (!containerRef.current) return;
    // Sanitize HTML content to prevent XSS attacks
    ensureDompurifyHook();
    const sanitizedContent = DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                     'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u', 
                     'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                     'img', 'blockquote', 'pre', 'code'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id'],
      FORBID_ATTR: ['style'],
      ALLOWED_URI_REGEXP: /^https?:|^mailto:|^tel:/i
    });
    containerRef.current.innerHTML = sanitizedContent;
    // reset state after content change
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, [htmlContent]);

  // Debounced search highlighting when searchTerm changes
  useEffect(() => {
    if (!containerRef.current) return;
    // Clear previous search highlights
    clearSearchHighlights();
    if (!searchTerm || searchTerm.trim().length === 0) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    const handle = window.setTimeout(() => {
      const results = highlightSearchTerms(searchTerm);
      setSearchResults(results);
      setCurrentSearchIndex(0);
      if (results.length > 0) {
        results[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [searchTerm]);

  // Apply temporary highlight on demand
  useEffect(() => {
    if (!containerRef.current) return;
    if (temporaryHighlight && temporaryHighlight.selectedText) {
      highlightKeywords(temporaryHighlight.selectedText);
    }
  }, [temporaryHighlight]);

  // Function to highlight search terms
  const highlightSearchTerms = (term: string): Element[] => {
    const results: Element[] = [];
    if (!containerRef.current) return results;

    const walker = document.createTreeWalker(
      containerRef.current,
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
    while (node = walker.nextNode()) {
      const text = node.textContent || '';
      const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.style.backgroundColor = '#ffeb3b';
        span.style.color = '#000';
        span.style.padding = '0 2px';
        span.style.borderRadius = '2px';
        span.textContent = match[1];
        
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[1].length);
        
        try {
          range.deleteContents();
          range.insertNode(span);
          results.push(span);
        } catch (e) {
          console.warn('Failed to highlight match:', e);
        }
      }
    }
    
    return results;
  };

  // Function to highlight keywords (for temporary highlight)
  const highlightKeywords = (keywords: string) => {
    if (!containerRef.current) return;

    // Split keywords by space or comma
    const keywordList = keywords.split(/[,\s]+/).filter(k => k.length > 0);
    
    keywordList.forEach(keyword => {
      const walker = document.createTreeWalker(
        containerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent || '';
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        let match;
        
        if ((match = regex.exec(text)) !== null) {
          const span = document.createElement('span');
          span.className = 'keyword-highlight';
          span.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
          span.style.padding = '0 2px';
          span.style.borderRadius = '2px';
          span.style.transition = 'background-color 2s ease-out';
          span.textContent = match[1];
          
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[1].length);
          
          try {
            range.deleteContents();
            range.insertNode(span);
            
            // Scroll to first keyword
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
              span.style.backgroundColor = 'transparent';
            }, 5000);
          } catch (e) {
            console.warn('Failed to highlight keyword:', e);
          }
          
          break; // Only highlight first occurrence
        }
      }
    });
  };
  
  // Function to clear search highlights
  const clearSearchHighlights = () => {
    if (!containerRef.current) return;
    
    const highlights = containerRef.current.querySelectorAll('.search-highlight, .keyword-highlight');
    highlights.forEach(highlight => {
      const text = highlight.textContent || '';
      const textNode = document.createTextNode(text);
      highlight.parentNode?.replaceChild(textNode, highlight);
    });
  };
  
  // Navigate to next search result
  const nextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(newIndex);
    
    // Update highlight colors
    searchResults.forEach((element, index) => {
      (element as HTMLElement).style.backgroundColor = 
        index === newIndex ? '#ff9632' : '#ffeb3b';
    });
    
    searchResults[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchResults, currentSearchIndex]);
  
  // Navigate to previous search result
  const prevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex === 0 
      ? searchResults.length - 1 
      : currentSearchIndex - 1;
    setCurrentSearchIndex(newIndex);
    
    // Update highlight colors
    searchResults.forEach((element, index) => {
      (element as HTMLElement).style.backgroundColor = 
        index === newIndex ? '#ff9632' : '#ffeb3b';
    });
    
    searchResults[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchResults, currentSearchIndex]);
  
  // Escape special regex characters
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  return (
    <div className="relative">
      {searchTerm && searchResults.length > 0 && (
        <div className="fixed top-16 right-4 bg-white shadow-lg rounded-lg p-3 z-50 border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {currentSearchIndex + 1} / {searchResults.length} 件
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
      <div 
        ref={setRef} 
        className="html-content-container p-8 max-w-4xl mx-auto"
        style={{ minHeight: '600px' }}
      />
    </div>
  );
}

const HtmlRenderer = React.memo(React.forwardRef<HTMLDivElement, HtmlRendererProps>(InnerHtmlRenderer));
export default HtmlRenderer;