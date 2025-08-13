'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Book, ArrowLeft, Search, X, Highlighter, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { safeLocalStorage } from '@/utils/storage-utils';
import { HighlightAnchor } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import MaterialViewer from '@/components/MaterialViewer';
import QuestionPanel from '@/components/QuestionPanel';

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
  const [showQuestionPanel, setShowQuestionPanel] = useState(true);
  const [questionPanelWidth, setQuestionPanelWidth] = useState(30); // パネル幅（%）

  useEffect(() => {
    // URLパラメータからキーワードを取得
    const keywordsParam = searchParams.get('keywords');
    const autoSearch = searchParams.get('autoSearch');
    
    const savedState = safeLocalStorage.getItem<any>('materialNavigationState');
    if (savedState) {
      // 古いデータ形式のクリーンアップ（StudyCompanion_backup.html等）
      if (savedState.materialId && savedState.materialId.includes('_backup.html')) {
        console.warn('[Materials] Cleaning up old materialId format:', savedState.materialId);
        savedState.materialId = undefined;
      }
      
      setNavigationState(savedState);
      if (savedState.anchor) {
        setTemporaryHighlight(savedState.anchor);
      }
      console.log('[Materials] Found navigation state:', {
        materialId: savedState.materialId,
        page: savedState.page,
        anchorPage: savedState.anchor?.pageNumber,
        questionId: savedState.questionId
      });
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
      console.log('[Materials] RAG results for question', savedState.questionId, ':', stored);
      
      // 古いデータ形式のクリーンアップ（StudyCompanion_backup.html等）
      if (stored && Array.isArray(stored.passages)) {
        stored.passages = stored.passages.map((p: any) => {
          if (p.materialId && p.materialId.includes('_backup.html')) {
            console.warn('[Materials] Cleaning up old materialId in passage:', p.materialId);
            return { ...p, materialId: undefined };
          }
          return p;
        });
      }
      
      if (stored && Array.isArray(stored.passages) && stored.passages.length > 0) {
        // rerank結果があればそれを優先
        const pageFromState = typeof savedState.page === 'number' ? savedState.page : undefined;
        let top = stored.passages[0];
        
        // リランク結果を優先
        if (stored.best && typeof stored.best.page === 'number') {
          const bestPage = Number(stored.best.page);
          const matched = stored.passages.find((p: any) => Number(p.page) === bestPage) || stored.passages[0];
          top = { materialId: matched.materialId, page: bestPage, quote: stored.best.exactQuote || matched.quote };
          console.log('[Materials] Using reranked result, page:', bestPage);
        }
        
        // navigationStateからのページ番号があればそれを使用
        if (pageFromState) {
          const matchedByState = stored.passages.find((p: any) => Number(p.page) === pageFromState);
          if (matchedByState) {
            top = { materialId: matchedByState.materialId, page: pageFromState, quote: matchedByState.quote };
            console.log('[Materials] Using page from navigation state:', pageFromState);
          }
        }
        
        console.log('[Materials] Final selection:', {
          materialId: top.materialId,
          page: top.page,
          hasQuote: !!top.quote
        });
        
        // 材料の自動切替（PDFファイル名に正確にマッチ）
        if (typeof top.materialId === 'string' && !top.materialId.includes('_backup')) {
          const mid = top.materialId;
          if (mid === 'UKFR_ED32_Study_Companion' || mid.includes('Study_Companion')) {
            setSelectedPdf('UKFR_ED32_Study_Companion.pdf');
            console.log('[Materials] Selected PDF: UKFR_ED32_Study_Companion.pdf');
          } else if (mid === 'UKFR_ED32_Checkpoint' || mid.includes('Checkpoint')) {
            setSelectedPdf('UKFR_ED32_Checkpoint.pdf');
            console.log('[Materials] Selected PDF: UKFR_ED32_Checkpoint.pdf');
          }
        } else if (!top.materialId || top.materialId.includes('_backup')) {
          // materialIdが無効な場合、デフォルトのPDFを選択
          console.warn('[Materials] Invalid or old materialId, using default PDF');
          // ページ番号からPDFを推測（Study Companionは112ページ、Checkpointは44ページ）
          if (typeof top.page === 'number' && top.page > 44) {
            setSelectedPdf('UKFR_ED32_Study_Companion.pdf');
            console.log('[Materials] Guessed PDF based on page number: Study_Companion');
          } else {
            setSelectedPdf('UKFR_ED32_Checkpoint.pdf');
            console.log('[Materials] Using default PDF: Checkpoint');
          }
        }
        
        if (typeof top.page === 'number' && top.page > 0) {
          console.log('[Materials] Setting current page to:', top.page);
          setCurrentPage(top.page);
        } else {
          console.warn('[Materials] Invalid page number:', top.page);
        }
        
        if (typeof top.quote === 'string' && top.quote.length > 0) {
          // 取り回しのため短めのスニペットを使用
          const snippet = top.quote.length > 160 ? `${top.quote.slice(0, 160)}…` : top.quote;
          setSearchTerm(snippet);
        }
      } else {
        console.warn('[Materials] No RAG results found for question:', savedState.questionId);
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
                {/* Toggle Question Panel Button */}
                {navigationState?.currentQuestion && (
                  <button 
                    onClick={() => setShowQuestionPanel(!showQuestionPanel)} 
                    className="p-2 text-gray-200 hover:bg-gray-700 rounded transition-colors"
                    title={showQuestionPanel ? "問題パネルを隠す" : "問題パネルを表示"}
                  >
                    {showQuestionPanel ? (
                      <PanelLeftClose className="w-5 h-5" />
                    ) : (
                      <PanelLeft className="w-5 h-5" />
                    )}
                  </button>
                )}
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
        <div className="h-screen pt-12 bg-gray-600 flex">
          {/* Question Panel */}
          {showQuestionPanel && navigationState?.currentQuestion && (
            <div 
              className="flex-shrink-0 border-r border-gray-700 overflow-y-auto"
              style={{ width: `${questionPanelWidth}%` }}
            >
              <QuestionPanel
                questionData={navigationState.currentQuestion}
                selectedAnswer={navigationState.selectedAnswer}
                showResult={navigationState.showResult}
                isCollapsible={false}
              />
            </div>
          )}
          
          {/* Resizer */}
          {showQuestionPanel && navigationState?.currentQuestion && (
            <div 
              className="w-1 bg-gray-700 hover:bg-blue-600 cursor-col-resize transition-colors"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startWidth = questionPanelWidth;
                
                const handleMouseMove = (e: MouseEvent) => {
                  const deltaX = e.clientX - startX;
                  const newWidth = startWidth + (deltaX / window.innerWidth * 100);
                  setQuestionPanelWidth(Math.max(20, Math.min(50, newWidth)));
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          )}
          
          {/* Material Viewer */}
          <div className="flex-1 overflow-hidden">
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
