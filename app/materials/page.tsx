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
  const [navigationState, setNavigationState] = useState<any>(null);

  useEffect(() => {
    // URLパラメータからキーワードを取得
    const keywordsParam = searchParams.get('keywords');
    const autoSearch = searchParams.get('autoSearch');
    
    const savedState = safeLocalStorage.getItem<any>('materialNavigationState');
    if (savedState) {
      setNavigationState(savedState);
      if (savedState.anchor) {
        setTemporaryHighlight(savedState.anchor);
      }
      console.log('Found navigation state:', savedState);
      // 注意: ここではまだ削除しない（戻るボタンで使用するため）
    }
    
    // キーワードが指定されている場合、自動的に検索
    if (keywordsParam && autoSearch === 'true') {
      const keywords = keywordsParam.split(',').map(k => k.trim());
      if (keywords.length > 0) {
        // 最初のキーワードで検索
        setSearchTerm(keywords[0]);
        
        // 一時的なハイライト用のアンカーを作成
        const anchor: HighlightAnchor = {
          selector: '',
          startOffset: 0,
          endOffset: 0,
          selectedText: keywords.join(', '),
          beforeText: '',
          afterText: '',
          pageNumber: 0
        };
        setTemporaryHighlight(anchor);
      }
    }

    // 検索結果（RAG）からのページジャンプ/ハイライト
    if (savedState?.questionId) {
      const stored = safeLocalStorage.getItem<any>(`retrieveResults_${savedState.questionId}`);
      if (stored && Array.isArray(stored.passages) && stored.passages.length > 0) {
        // rerank結果があればそれを優先
        const pageFromState = typeof savedState.page === 'number' ? savedState.page : undefined;
        let top = stored.passages[0];
        if (stored.best && typeof stored.best.page === 'number') {
          const bestPage = Number(stored.best.page);
          const matched = stored.passages.find((p: any) => Number(p.page) === bestPage) || stored.passages[0];
          top = { materialId: matched.materialId, page: bestPage, quote: stored.best.exactQuote || matched.quote };
        }
        if (pageFromState) {
          const matchedByState = stored.passages.find((p: any) => Number(p.page) === pageFromState);
          if (matchedByState) {
            top = { materialId: matchedByState.materialId, page: pageFromState, quote: matchedByState.quote };
          }
        }
        // 材料の自動切替（Checkpoint/StudyCompanion）
        if (typeof top.materialId === 'string') {
          const mid = top.materialId.toLowerCase();
          if (mid.includes('studycompanion')) {
            setSelectedPdf('UKFR_ED32_Study_Companion.pdf');
          } else if (mid.includes('checkpoint')) {
            setSelectedPdf('UKFR_ED32_Checkpoint.pdf');
          }
        }
        if (typeof top.page === 'number') {
          setCurrentPage(top.page);
        }
        if (typeof top.quote === 'string' && top.quote.length > 0) {
          // 取り回しのため短めのスニペットを使用
          const snippet = top.quote.length > 160 ? `${top.quote.slice(0, 160)}…` : top.quote;
          setSearchTerm(snippet);
        }
      }
    }
  }, [searchParams]);

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
        try {
          const response = await fetch(`/materials/${htmlFilename}`);
          if (!response.ok) throw new Error(`Failed to load ${htmlFilename}`);
          const html = await response.text();
          setHtmlContent(html);
        } catch (e) {
          setHtmlContent('<p>コンテンツの読み込みに失敗しました。</p>');
        }
      }
    } else if (mode === 'text') {
      const txtFilename = selectedPdf.replace('.pdf', '_ja_fixed.txt');
      try {
        const response = await fetch(`/materials/${txtFilename}`);
        if (!response.ok) throw new Error(`Failed to load ${txtFilename}`);
        const text = await response.text();
        setTextContent(text);
      } catch (e) {
        setTextContent('コンテンツの読み込みに失敗しました。');
      }
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
                onClick={() => {
                  // 学習セッションから来た場合は元のセッションに戻る
                  if (navigationState && navigationState.from) {
                    // navigationStateは削除しない（復元時に必要）
                    const params = new URLSearchParams();
                    if (navigationState.mode) params.set('mode', navigationState.mode);
                    if (navigationState.category) params.set('category', navigationState.category);
                    if (navigationState.part) params.set('part', navigationState.part);
                    if (navigationState.studyMode) params.set('studyMode', navigationState.studyMode);
                    if (navigationState.questionCount) params.set('questionCount', navigationState.questionCount);
                    // セッションIDとrestore フラグを追加
                    if (navigationState.sessionId) params.set('sessionId', navigationState.sessionId);
                    params.set('restore', 'true');
                    router.push(`/study/session?${params.toString()}`);
                    return;
                  }
                  // フォールバック: URLのreturn* から復元
                  const returnMode = searchParams.get('returnMode');
                  const returnCategory = searchParams.get('returnCategory');
                  const returnPart = searchParams.get('returnPart');
                  const returnStudyMode = searchParams.get('returnStudyMode');
                  const returnQuestionCount = searchParams.get('returnQuestionCount');
                  if (returnMode && returnCategory) {
                    const params = new URLSearchParams();
                    params.set('mode', returnMode);
                    params.set('category', returnCategory);
                    if (returnPart) params.set('part', returnPart);
                    if (returnStudyMode) params.set('studyMode', returnStudyMode);
                    if (returnQuestionCount) params.set('questionCount', returnQuestionCount);
                    router.push(`/study/session?${params.toString()}`);
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="p-1.5 text-gray-200 hover:bg-gray-700 rounded flex items-center gap-1 transition-colors"
                title={navigationState ? "学習に戻る" : "ダッシュボードに戻る"}
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
                {/* External search shortcuts */}
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  <button
                    onClick={() => {
                      const q = encodeURIComponent(searchTerm || (temporaryHighlight?.selectedText || ''));
                      if (!q) return;
                      window.open(`https://www.google.com/search?q=site:fca.org.uk+${q}`, '_blank', 'noopener');
                    }}
                    className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
                    title="FCA公式サイトを検索"
                  >FCA</button>
                  <button
                    onClick={() => {
                      const q = encodeURIComponent(searchTerm || (temporaryHighlight?.selectedText || ''));
                      if (!q) return;
                      window.open(`https://www.google.com/search?q=site:legislation.gov.uk+${q}`, '_blank', 'noopener');
                    }}
                    className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
                    title="legislation.gov.uk を検索"
                  >Legislation</button>
                  <button
                    onClick={() => {
                      const q = encodeURIComponent(searchTerm || (temporaryHighlight?.selectedText || ''));
                      if (!q) return;
                      window.open(`https://www.google.com/search?q=${q}+UK+financial+regulation`, '_blank', 'noopener');
                    }}
                    className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
                    title="Web全体を検索"
                  >Web</button>
                </div>
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
