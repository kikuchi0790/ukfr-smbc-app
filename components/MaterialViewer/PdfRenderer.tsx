import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FixedSizeList as List } from 'react-window';
import { Loader2, AlertCircle } from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <mark key={index} className="bg-yellow-300">{part}</mark>;
      }
      return part;
    });
  }

  const textRenderer = useCallback((textItem: TextItem) => {
    // CustomTextRenderer expects a string return type, not JSX
    // For now, we'll disable search highlighting in PDF view
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
