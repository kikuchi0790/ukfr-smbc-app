"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FixedSizeList as List } from 'react-window';
import { Loader2, AlertCircle } from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set workerSrc on client only to avoid SSR issues (use HTTPS CDN for reliability)
if (typeof window !== 'undefined') {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface PdfRendererProps {
  file: string;
  currentPage?: number;
  onLoadSuccess: (numPages: number) => void;
  searchTerm: string;
}

interface TextItem {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

function PdfRenderer({ file, currentPage, onLoadSuccess, searchTerm }: PdfRendererProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    onLoadSuccess(numPages);
    setLoading(false);
    setError(null);
  }
  
  function onDocumentLoadError(error: Error) {
    console.error('PDF loading error:', error);
    setError('PDFの読み込みに失敗しました。ファイルが破損しているか、アクセスできません。');
    setLoading(false);
  }

  function highlightPattern(text: string, pattern: string) {
    if (!pattern) return text;
    // Keep disabled for now; PDF layer highlighting requires deeper integration
    return text;
  }

  const textRenderer = useCallback((textItem: TextItem) => {
    return textItem.str;
  }, []);

  // Calculate page width based on container size
  useEffect(() => {
    const updatePageSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Leave some padding
        setPageWidth(Math.min(containerWidth - 40, 800));
      }
    };
    
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  // PDF text layer highlighting
  const clearPdfHighlights = useCallback(() => {
    if (!containerRef.current) return;
    const highlights = containerRef.current.querySelectorAll('.pdf-search-highlight');
    highlights.forEach((el) => {
      const text = el.textContent || '';
      const textNode = document.createTextNode(text);
      el.parentNode?.replaceChild(textNode, el);
    });
  }, []);

  const highlightTextLayer = useCallback((root: Element, term: string) => {
    const results: Element[] = [];
    if (!term || term.trim().length === 0) return results;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let matchesApplied = 0;
    const MATCH_LIMIT = 200;
    while ((node = walker.nextNode()) && matchesApplied < MATCH_LIMIT) {
      const textNode = node as Text;
      const text = textNode.data;
      if (!regex.test(text)) continue;
      // reset regex lastIndex for reuse
      regex.lastIndex = 0;
      const fragments: (Text | HTMLElement)[] = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) && matchesApplied < MATCH_LIMIT) {
        const start = m.index;
        const end = start + m[1].length;
        if (start > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, start)));
        }
        const span = document.createElement('span');
        span.className = 'pdf-search-highlight';
        span.style.backgroundColor = '#ffeb3b';
        span.style.color = '#000';
        span.style.padding = '0 2px';
        span.style.borderRadius = '2px';
        span.textContent = text.slice(start, end);
        fragments.push(span);
        results.push(span);
        lastIndex = end;
        matchesApplied += 1;
      }
      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.slice(lastIndex)));
      }
      if (fragments.length > 0) {
        const parent = textNode.parentNode;
        if (!parent) continue;
        fragments.forEach((f) => parent.insertBefore(f, textNode));
        parent.removeChild(textNode);
      }
    }
    return results;
  }, []);

  const applyPdfHighlights = useCallback(() => {
    if (!containerRef.current) return;
    clearPdfHighlights();
    if (!searchTerm || searchTerm.trim().length === 0) return;
    const textLayers = containerRef.current.querySelectorAll('.react-pdf__Page__textContent');
    textLayers.forEach((layer) => highlightTextLayer(layer, searchTerm));
  }, [clearPdfHighlights, highlightTextLayer, searchTerm]);

  // Re-apply highlights when searchTerm changes or after pages render
  useEffect(() => {
    // Debounce to wait for layer to render
    const handle = window.setTimeout(() => applyPdfHighlights(), 200);
    return () => window.clearTimeout(handle);
  }, [applyPdfHighlights, searchTerm, numPages, pageWidth]);

  // Observe text layer mutations to re-apply highlights (e.g., rerenders)
  useEffect(() => {
    if (!containerRef.current) return;
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    const observer = new MutationObserver(() => {
      if (searchTerm) {
        // microtask -> debounce apply
        Promise.resolve().then(() => applyPdfHighlights());
      }
    });
    observer.observe(containerRef.current, { subtree: true, childList: true });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [applyPdfHighlights, searchTerm]);
  
  // Jump to specific page when currentPage changes
  useEffect(() => {
    if (currentPage && listRef.current && numPages > 0) {
      listRef.current.scrollToItem(currentPage - 1, 'start');
    }
  }, [currentPage, numPages]);
  
  // Calculate dynamic item size based on page width
  const getItemSize = useCallback(() => {
    // Approximate A4 ratio (1.414)
    return Math.round(pageWidth * 1.414) + 20; // Add padding
  }, [pageWidth]);
  
  // Get container height
  const getContainerHeight = () => {
    if (typeof window !== 'undefined') {
      return window.innerHeight - 200; // Subtract header and padding
    }
    return 600; // Default height
  };
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <p className="text-center">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          再読み込み
        </button>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <Document 
        file={file} 
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2">PDFを読み込んでいます...</span>
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
            <p className="text-center">PDFの読み込みに失敗しました</p>
          </div>
        }
      >
        {!loading && pageWidth > 0 && (
          <List
            ref={listRef}
            height={getContainerHeight()}
            itemCount={numPages}
            itemSize={getItemSize()}
            width="100%"
            overscanCount={2}
          >
            {({ index, style }) => (
              <div 
                style={style} 
                className="flex justify-center items-start"
                data-page-number={index + 1}
              >
                <div className="bg-white shadow-lg">
                  <Page 
                    pageNumber={index + 1} 
                    width={pageWidth}
                    customTextRenderer={textRenderer}
                    loading={
                      <div className="flex items-center justify-center" 
                           style={{ width: pageWidth, height: getItemSize() }}>
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    }
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                  />
                  <div className="text-center text-sm text-gray-500 py-2 border-t">
                    ページ {index + 1} / {numPages}
                  </div>
                </div>
              </div>
            )}
          </List>
        )}
      </Document>
    </div>
  );
}

export default React.memo(PdfRenderer);
