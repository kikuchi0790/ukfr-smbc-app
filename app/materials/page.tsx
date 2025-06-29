'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Book, ArrowLeft, Search, X, Highlighter } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { safeLocalStorage } from '@/utils/storage-utils';
import { HighlightAnchor } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import MaterialViewer from '@/components/MaterialViewer';

function MaterialsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPdf, setSelectedPdf] = useState('UKFR_ED32_Checkpoint.pdf');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [temporaryHighlight, setTemporaryHighlight] = useState<HighlightAnchor | null>(null);
  const [viewMode, setViewMode] = useState<'pdf' | 'html' | 'text'>('pdf');
  const [showToc, setShowToc] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    const navigationState = safeLocalStorage.getItem<any>('materialNavigationState');
    if (navigationState && navigationState.anchor) {
      setTemporaryHighlight(navigationState.anchor);
      // In a real implementation, we would use the anchor to scroll to the correct position.
      // For now, we'll just log it to the console.
      console.log('Found anchor in navigation state:', navigationState.anchor);
      safeLocalStorage.removeItem('materialNavigationState');
    }
  }, []);

  const handleViewModeChange = async (mode: string) => {
    setViewMode(mode as 'pdf' | 'html' | 'text');
    if (mode === 'html') {
      const baseFilename = selectedPdf.replace('.pdf', '');
      let htmlFilename = '';
      if (baseFilename.includes('Checkpoint')) {
        htmlFilename = 'Checkpoint.html';
      } else if (baseFilename.includes('Study_Companion')) {
        htmlFilename = 'StudyCompanion.html';
      }
      if (htmlFilename) {
        const response = await fetch(`/materials/${htmlFilename}`);
        const html = await response.text();
        setHtmlContent(html);
      }
    } else if (mode === 'text') {
      const txtFilename = selectedPdf.replace('.pdf', '_ja_fixed.txt');
      const response = await fetch(`/materials/${txtFilename}`);
      const text = await response.text();
      setTextContent(text);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 bg-gray-800 z-50 border-b border-gray-700">
          <div className="px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-1.5 text-gray-200 hover:bg-gray-700 rounded flex items-center gap-1 transition-colors"
                title="ダッシュボードに戻る"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">戻る</span>
              </button>
              <div className="w-px h-6 bg-gray-600" />
              <Book className="w-5 h-5 text-blue-400" />
              <select 
                value={selectedPdf}
                onChange={(e) => setSelectedPdf(e.target.value)}
                className="bg-gray-700 text-gray-200 px-3 py-1 rounded text-sm border border-gray-600 hover:bg-gray-600"
                aria-label="Select a PDF to view"
              >
                <option value="UKFR_ED32_Checkpoint.pdf">UKFR_ED32_Checkpoint.pdf</option>
                <option value="UKFR_ED32_Study_Companion.pdf">UKFR_ED32_Study_Companion.pdf</option>
              </select>
            </div>
            
            {viewMode === 'pdf' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-gray-200 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    className="w-12 px-2 py-1 bg-gray-700 text-gray-200 rounded text-center border border-gray-600"
                    min="1"
                    max={totalPages}
                  />
                  <span className="text-gray-400">/ {totalPages}</span>
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-gray-200 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="search"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-gray-700 text-gray-200 px-3 py-1 rounded text-sm border border-gray-600 hover:bg-gray-600"
                  aria-label="Search for text in the document"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowToc(!showToc)} className="p-2 text-gray-200 hover:bg-gray-700 rounded">
                  <Book className="w-5 h-5" />
                </button>
                <label className="text-sm text-gray-200">表示形式:</label>
                <select
                  onChange={(e) => handleViewModeChange(e.target.value)}
                  value={viewMode}
                  className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm border border-gray-600 hover:bg-gray-600"
                  aria-label="Select view mode"
                >
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                  <option value="text">テキスト</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="h-screen pt-12 bg-gray-600">
          <MaterialViewer
            materialId={selectedPdf}
            viewMode={viewMode}
            pdfFile={viewMode === 'pdf' ? `/materials/${selectedPdf}` : undefined}
            currentPage={currentPage}
            onLoadSuccess={(numPages) => setTotalPages(numPages)}
            htmlContent={htmlContent}
            textContent={textContent}
            searchTerm={searchTerm}
            temporaryHighlight={temporaryHighlight}
            showToc={showToc}
            onJumpToPage={(pageNumber) => {
              setCurrentPage(pageNumber);
              setShowToc(false);
            }}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">Loading...</div>}>
      <MaterialsContent />
    </Suspense>
  );
}
