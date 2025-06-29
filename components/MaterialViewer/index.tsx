import React, { useRef } from 'react';
import ErrorBoundary from './ErrorBoundary';
import PdfRenderer from './PdfRenderer';
import HtmlRenderer from './HtmlRenderer';
import TableOfContents from './TableOfContents';
import HighlightManager from '../HighlightManager';
import { HighlightAnchor } from '@/types';

interface MaterialViewerProps {
  materialId: string;
  viewMode: 'pdf' | 'html' | 'text';
  
  // PDF specific props
  pdfFile?: string;
  currentPage?: number;
  onLoadSuccess?: (numPages: number) => void;
  
  // HTML specific props
  htmlContent?: string;
  
  // Text specific props
  textContent?: string;
  
  // Common props
  searchTerm?: string;
  temporaryHighlight?: HighlightAnchor | null;
  
  // Table of Contents props
  showToc?: boolean;
  onJumpToPage?: (pageNumber: number) => void;
  
  // Related question for study integration
  relatedQuestionId?: string;
}

export default function MaterialViewer({
  materialId,
  viewMode,
  pdfFile,
  currentPage = 1,
  onLoadSuccess,
  htmlContent = '',
  textContent = '',
  searchTerm = '',
  temporaryHighlight = null,
  showToc = false,
  onJumpToPage,
  relatedQuestionId,
}: MaterialViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const renderContent = () => {
    switch (viewMode) {
      case 'pdf':
        if (!pdfFile) return <div className="text-red-500">PDFファイルが指定されていません。</div>;
        return (
          <PdfRenderer
            file={pdfFile}
            currentPage={currentPage}
            onLoadSuccess={onLoadSuccess || (() => {})}
            searchTerm={searchTerm}
          />
        );
      
      case 'html':
        if (!htmlContent) return <div className="text-gray-500">HTMLコンテンツが読み込まれていません。</div>;
        return (
          <HtmlRenderer
            htmlContent={htmlContent}
            searchTerm={searchTerm}
            temporaryHighlight={temporaryHighlight}
          />
        );
      
      case 'text':
        if (!textContent) return <div className="text-gray-500">テキストコンテンツが読み込まれていません。</div>;
        return (
          <div className="max-w-4xl mx-auto p-8">
            <pre className="whitespace-pre-wrap font-mono text-sm">{textContent}</pre>
          </div>
        );
      
      default:
        return <div className="text-red-500">無効な表示モード: {viewMode}</div>;
    }
  };

  return (
    <div className="flex h-full">
      {showToc && (
        <div className="w-64 bg-gray-800 text-white overflow-y-auto">
          <ErrorBoundary>
            <TableOfContents 
              materialId={materialId}
              onJumpToPage={onJumpToPage || (() => {})}
            />
          </ErrorBoundary>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto" ref={contentRef}>
          <ErrorBoundary>
            {viewMode !== 'text' ? (
              <HighlightManager
                materialId={materialId}
                contentRef={contentRef}
                relatedQuestionId={relatedQuestionId}
              >
                {renderContent()}
              </HighlightManager>
            ) : (
              renderContent()
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// Re-export individual components for backward compatibility
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as PdfRenderer } from './PdfRenderer';
export { default as HtmlRenderer } from './HtmlRenderer';
export { default as TableOfContents } from './TableOfContents';
export { default as HighlightLayer } from './HighlightLayer';
export { default as NoteEditor } from './NoteEditor';