'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Book, ArrowLeft, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<any>;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function MaterialsPage() {
  const router = useRouter();
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPdf, setSelectedPdf] = useState('UKFR_ED32_Checkpoint.pdf');
  const [selectedText, setSelectedText] = useState('UKFR_ED32_Checkpoint_ja_fixed.txt');
  const [syncScroll, setSyncScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [textContent, setTextContent] = useState<Record<number, string>>({});
  const [isRendering, setIsRendering] = useState(false);
  const [pdfCanvases, setPdfCanvases] = useState<Array<{ pageNum: number; canvas: HTMLCanvasElement }>>([]);
  const [isHtmlContent, setIsHtmlContent] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scriptLoadedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const htmlContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 既にスクリプトが読み込まれている場合はスキップ
    if (scriptLoadedRef.current || window.pdfjsLib) {
      if (window.pdfjsLib) {
        loadPDF(selectedPdf);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      // CMapの設定を追加
      window.pdfjsLib.cMapUrl = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
      window.pdfjsLib.cMapPacked = true;
      loadPDF(selectedPdf);
    };
    document.body.appendChild(script);

    return () => {
      // クリーンアップ時にAbortControllerをキャンセル
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (window.pdfjsLib && scriptLoadedRef.current) {
      loadPDF(selectedPdf);
    }
  }, [selectedPdf]);

  // 検索状態のクリーンアップ
  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [isHtmlContent]);

  const loadPDF = async (filename: string) => {
    // 既にレンダリング中の場合はスキップ
    if (isRendering) {
      console.log('Already rendering, skipping...');
      return;
    }

    // 前のAbortControllerをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setIsRendering(true);

    try {
      console.log('Attempting to load PDF:', `/materials/${filename}`);
      
      // First check if the file is accessible
      const testResponse = await fetch(`/materials/${filename}`, {
        signal: abortController.signal
      });
      console.log('Fetch test response:', testResponse.status, testResponse.statusText);
      
      if (!testResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      // Try loading with ArrayBuffer method for better compatibility
      const pdfData = await testResponse.arrayBuffer();
      console.log('PDF data loaded, size:', pdfData.byteLength);
      
      // Abortされていないかチェック
      if (abortController.signal.aborted) {
        console.log('PDF loading was aborted');
        return;
      }
      
      const loadingTask = window.pdfjsLib.getDocument({
        data: pdfData,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        disableFontFace: true,  // フォント処理を無効化
        useSystemFonts: false,  // システムフォントも使用しない
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
        verbosity: 0  // エラーログを減らす
      });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      console.log('PDF loaded successfully, pages:', pdf.numPages);
      
      // Reactの方法でキャンバスをクリア
      setPdfCanvases([]);
      
      // すべてのページをレンダリング
      const newCanvases: Array<{ pageNum: number; canvas: HTMLCanvasElement }> = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        // Abortされていないかチェック
        if (abortController.signal.aborted) {
          console.log('Rendering was aborted');
          break;
        }
        
        const canvas = await renderPage(pdf, pageNum);
        if (canvas) {
          newCanvases.push({ pageNum, canvas });
        }
      }
      
      // 一度にすべてのキャンバスを設定
      setPdfCanvases(newCanvases);
      
      // 対応するテキストまたはHTMLファイルを読み込む
      const baseFilename = filename.replace('.pdf', '');
      
      // まずHTMLファイルを試す
      let htmlFilename = '';
      if (baseFilename.includes('Checkpoint')) {
        htmlFilename = 'Checkpoint.html';
      } else if (baseFilename.includes('Study_Companion')) {
        htmlFilename = 'StudyCompanion.html';
      }
      
      if (htmlFilename) {
        try {
          const htmlResponse = await fetch(`/materials/${htmlFilename}`);
          if (htmlResponse.ok) {
            await loadHtmlContent(htmlFilename);
            setSelectedText(htmlFilename);
          } else {
            throw new Error('HTML file not found');
          }
        } catch (error) {
          // HTMLファイルが見つからない場合は、テキストファイルを試す
          const txtFilename = baseFilename + '_ja_fixed.txt';
          try {
            const txtResponse = await fetch(`/materials/${txtFilename}`);
            if (txtResponse.ok) {
              await loadText(txtFilename);
              setSelectedText(txtFilename);
            }
          } catch (error) {
            console.error('Failed to load text file:', error);
          }
        }
      }
      
      setLoading(false);
      setIsRendering(false);
    } catch (error) {
      // AbortErrorの場合は無視
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('PDF loading was cancelled');
        return;
      }
      
      console.error('Error loading PDF:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      setLoading(false);
      setIsRendering(false);
      // Display error in UI
      if (pdfWrapperRef.current) {
        pdfWrapperRef.current.innerHTML = `
          <div class="text-red-400 text-center p-8">
            <div class="mb-4 text-lg">PDFの読み込みに失敗しました</div>
            <div class="text-sm text-gray-400 mb-4">${error instanceof Error ? error.message : 'Unknown error'}</div>
            <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              ページを再読み込み
            </button>
          </div>
        `;
      }
    }
  };

  const renderPage = async (pdf: PDFDocument, pageNum: number): Promise<HTMLCanvasElement | null> => {
    try {
      const page = await pdf.getPage(pageNum);
      const desiredWidth = 800;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(desiredWidth / viewport.width, 1.5);
      const scaledViewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        // Canvasのスタイルを設定
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
          // フォントエラーを回避するための追加オプション
          renderInteractiveForms: false,
          includeAnnotationStorage: false
        };
        
        console.log(`Rendering page ${pageNum}, dimensions: ${canvas.width}x${canvas.height}`);
        
        await page.render(renderContext).promise;
        console.log(`Page ${pageNum} rendered successfully`);
        
        return canvas;
      }
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      // エラーが発生してもレンダリングを継続
    }
    return null;
  };

  const loadHtmlContent = async (filename: string) => {
    try {
      const response = await fetch(`/materials/${filename}`);
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const pageContents: Record<number, string> = {};
      
      // スタイルを取得
      const styles = doc.querySelectorAll('style');
      let styleContent = '';
      styles.forEach(style => {
        styleContent += style.outerHTML;
      });
      
      // HTML全体を1つのコンテンツとして設定
      const bodyContent = doc.body.innerHTML;
      pageContents[1] = styleContent + bodyContent;
      
      console.log('Loaded HTML content for', filename);
      
      setTextContent(pageContents);
      setIsHtmlContent(true);
    } catch (error) {
      console.error('Error loading HTML:', error);
    }
  };

  const loadText = async (filename: string) => {
    try {
      const response = await fetch(`/materials/${filename}`);
      const text = await response.text();
      
      const pages = text.split(/(?=ページ\s+\d+)/);
      const pageContents: Record<number, string> = {};
      
      pages.forEach((pageContent) => {
        if (pageContent.trim()) {
          const pageMatch = pageContent.match(/ページ\s+(\d+)/);
          const pageNum = pageMatch ? parseInt(pageMatch[1]) : 0;
          if (pageNum > 0) {
            pageContents[pageNum] = pageContent.replace(/ページ\s+\d+/, '').trim();
          }
        }
      });
      
      setTextContent(pageContents);
      setIsHtmlContent(false);
    } catch (error) {
      console.error('Error loading text:', error);
    }
  };

  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    // スクロール同期を一時的に無効化
    scrollingRef.current = true;
    setCurrentPage(pageNum);
    
    const pdfPage = document.getElementById(`pdf-page-${pageNum}`);
    const textPage = document.getElementById(`text-page-${pageNum}`);
    
    if (pdfPage) {
      pdfPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (textPage && syncScroll) {
      setTimeout(() => {
        textPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // スクロール完了後に同期を再開
        setTimeout(() => { scrollingRef.current = false; }, 500);
      }, 50);
    } else {
      setTimeout(() => { scrollingRef.current = false; }, 500);
    }
  };

  const processTextContent = (content: string) => {
    let processed = content
      .replace(/^([A-Z][^\n]{0,100})$/gm, '<h2 class="text-xl font-semibold mt-8 mb-4 text-gray-900">$1</h2>')
      .replace(/^(\d+\.\s+[^\n]+)$/gm, '<h3 class="text-lg font-medium mt-6 mb-3 text-gray-800">$1</h3>')
      .replace(/^(\d+\.\d+\.\s+[^\n]+)$/gm, '<h4 class="text-base font-medium mt-4 mb-2 text-gray-800">$1</h4>');
    
    const paragraphs = processed.split('\n\n').map(para => {
      para = para.trim();
      if (para && !para.match(/^<[^>]+>/)) {
        return `<p class="mb-4 text-justify text-gray-900 leading-relaxed">${para}</p>`;
      }
      return para;
    });
    
    return paragraphs.join('\n');
  };

  // 検索機能の実装
  const performSearch = (term: string) => {
    if (!term || !htmlContentRef.current) {
      clearSearch();
      return;
    }

    // 既存のハイライトをクリア
    clearSearch();

    const content = htmlContentRef.current;
    const text = content.textContent || '';
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...text.matchAll(regex)];
    
    setTotalMatches(matches.length);
    
    if (matches.length > 0) {
      // テキストノードを探してハイライト
      highlightMatches(content, term);
      setCurrentMatch(1);
      scrollToMatch(1);
    }
  };

  const clearSearch = () => {
    if (!htmlContentRef.current) return;
    
    // すべてのハイライトを削除
    const highlights = htmlContentRef.current.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
    
    setTotalMatches(0);
    setCurrentMatch(0);
  };

  const highlightMatches = (element: HTMLElement, term: string) => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let matchIndex = 0;

    textNodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const matches = [...text.matchAll(regex)];
      
      if (matches.length > 0) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach(match => {
          matchIndex++;
          const matchStart = match.index!;
          const matchEnd = matchStart + match[0].length;

          // マッチ前のテキスト
          if (matchStart > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchStart)));
          }

          // マッチ部分をハイライト
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.setAttribute('data-match-index', matchIndex.toString());
          span.style.backgroundColor = '#ffeb3b';
          span.style.color = '#000';
          span.style.padding = '2px 0';
          span.style.borderRadius = '2px';
          span.textContent = match[0];
          fragment.appendChild(span);

          lastIndex = matchEnd;
        });

        // マッチ後のテキスト
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });
  };

  const scrollToMatch = (matchNumber: number) => {
    if (!htmlContentRef.current) return;
    
    const highlights = htmlContentRef.current.querySelectorAll('.search-highlight');
    highlights.forEach((highlight, index) => {
      if (index + 1 === matchNumber) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (highlight as HTMLElement).style.backgroundColor = '#ff9800';
      } else {
        (highlight as HTMLElement).style.backgroundColor = '#ffeb3b';
      }
    });
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (totalMatches === 0) return;
    
    let newMatch = currentMatch;
    if (direction === 'next') {
      newMatch = currentMatch >= totalMatches ? 1 : currentMatch + 1;
    } else {
      newMatch = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    }
    
    setCurrentMatch(newMatch);
    scrollToMatch(newMatch);
  };

  // スクロール同期のためのイベントリスナー
  useEffect(() => {
    const pdfPanel = pdfPanelRef.current;
    const textPanel = textPanelRef.current;
    
    if (!pdfPanel || !textPanel || !syncScroll) return;
    
    let scrollTimeout: NodeJS.Timeout;
    
    const handlePdfScroll = () => {
      if (scrollingRef.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scrollingRef.current = true;
        
        // 現在表示されているPDFページを検出
        const pageElements = pdfPanel.querySelectorAll('[id^="pdf-page-"]');
        let visiblePage = currentPage; // デフォルトを現在のページに
        
        for (let i = 0; i < pageElements.length; i++) {
          const rect = pageElements[i].getBoundingClientRect();
          const pdfPanelRect = pdfPanel.getBoundingClientRect();
          
          // ページの中央がビューポート内にあるか確認
          const pageCenterY = rect.top + rect.height / 2;
          if (pageCenterY > pdfPanelRect.top && pageCenterY < pdfPanelRect.bottom) {
            visiblePage = i + 1;
            break;
          }
        }
        
        // ページが変わった場合のみ同期
        if (visiblePage !== currentPage) {
          setCurrentPage(visiblePage);
          const textPage = document.getElementById(`text-page-${visiblePage}`);
          if (textPage) {
            textPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        
        setTimeout(() => { scrollingRef.current = false; }, 300);
      }, 150);
    };
    
    const handleTextScroll = () => {
      if (scrollingRef.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scrollingRef.current = true;
        
        // 現在表示されているテキストページを検出
        const pageElements = textPanel.querySelectorAll('[id^="text-page-"]');
        let visiblePage = currentPage; // デフォルトを現在のページに
        
        for (let i = 0; i < pageElements.length; i++) {
          const rect = pageElements[i].getBoundingClientRect();
          const textPanelRect = textPanel.getBoundingClientRect();
          
          // より正確なページ検出
          if (rect.top <= textPanelRect.top + 50 && rect.bottom > textPanelRect.top + 50) {
            const match = pageElements[i].id.match(/text-page-(\d+)/);
            if (match) {
              visiblePage = parseInt(match[1]);
              break;
            }
          }
        }
        
        // ページが変わった場合のみ同期
        if (visiblePage !== currentPage) {
          setCurrentPage(visiblePage);
          const pdfPage = document.getElementById(`pdf-page-${visiblePage}`);
          if (pdfPage) {
            pdfPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        setTimeout(() => { scrollingRef.current = false; }, 300);
      }, 150);
    };
    
    pdfPanel.addEventListener('scroll', handlePdfScroll);
    textPanel.addEventListener('scroll', handleTextScroll);
    
    return () => {
      clearTimeout(scrollTimeout);
      pdfPanel.removeEventListener('scroll', handlePdfScroll);
      textPanel.removeEventListener('scroll', handleTextScroll);
    };
  }, [syncScroll, pdfCanvases.length, currentPage]);

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
              >
                <option value="UKFR_ED32_Checkpoint.pdf">UKFR_ED32_Checkpoint.pdf</option>
                <option value="UKFR_ED32_Study_Companion.pdf">UKFR_ED32_Study_Companion.pdf</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 text-gray-200 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
                      goToPage(page);
                    }
                  }}
                  className="w-12 px-2 py-1 bg-gray-700 text-gray-200 rounded text-center border border-gray-600"
                  min="1"
                  max={totalPages}
                />
                <span className="text-gray-400">/ {totalPages}</span>
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 text-gray-200 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-200">表示形式:</label>
                <select
                  onChange={(e) => {
                    const useHtml = e.target.value === 'html';
                    const baseFilename = selectedPdf.replace('.pdf', '');
                    
                    if (useHtml) {
                      let htmlFilename = '';
                      if (baseFilename.includes('Checkpoint')) {
                        htmlFilename = 'Checkpoint.html';
                      } else if (baseFilename.includes('Study_Companion')) {
                        htmlFilename = 'StudyCompanion.html';
                      }
                      
                      if (htmlFilename) {
                        loadHtmlContent(htmlFilename);
                        setSelectedText(htmlFilename);
                      }
                    } else {
                      const txtFilename = baseFilename + '_ja_fixed.txt';
                      loadText(txtFilename);
                      setSelectedText(txtFilename);
                    }
                  }}
                  defaultValue={isHtmlContent ? 'html' : 'text'}
                  className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm border border-gray-600 hover:bg-gray-600"
                >
                  <option value="text">テキスト</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              
              {!isHtmlContent && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="syncScroll"
                    checked={syncScroll}
                    onChange={(e) => setSyncScroll(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="syncScroll" className="text-sm text-gray-200 cursor-pointer">
                    スクロール同期
                  </label>
                </div>
              )}
              
              {isHtmlContent && (
                <div className="flex items-center gap-2">
                  {!searchVisible && (
                    <button
                      onClick={() => {
                        setSearchVisible(true);
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }}
                      className="p-2 text-gray-200 hover:bg-gray-700 rounded transition-colors touch-manipulation"
                      title="検索"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  )}
                  
                  {searchVisible && (
                    <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          performSearch(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            navigateSearch('next');
                          } else if (e.key === 'Escape') {
                            setSearchVisible(false);
                            setSearchTerm('');
                            clearSearch();
                          }
                        }}
                        placeholder="検索..."
                        className="bg-transparent text-gray-200 placeholder-gray-400 outline-none w-32 sm:w-40"
                      />
                      
                      {totalMatches > 0 && (
                        <>
                          <span className="text-xs text-gray-400">
                            {currentMatch}/{totalMatches}
                          </span>
                          <button
                            onClick={() => navigateSearch('prev')}
                            className="p-1.5 hover:bg-gray-600 rounded touch-manipulation"
                            title="前へ"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigateSearch('next')}
                            className="p-1.5 hover:bg-gray-600 rounded touch-manipulation"
                            title="次へ"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => {
                          setSearchVisible(false);
                          setSearchTerm('');
                          clearSearch();
                        }}
                        className="p-1.5 hover:bg-gray-600 rounded touch-manipulation"
                        title="閉じる"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex h-screen pt-12">
          {/* PDF Panel */}
          <div 
            ref={pdfPanelRef}
            className="flex-1 overflow-y-auto bg-gray-600 p-5"
          >
            <div ref={pdfWrapperRef} className="max-w-4xl mx-auto">
              {loading && (
                <div className="text-center py-20 text-gray-300">
                  <div className="mb-4">PDFを読み込み中...</div>
                  <div className="text-sm text-gray-400">
                    問題が続く場合は、ページを再読み込みしてください
                  </div>
                </div>
              )}
              {/* Reactでキャンバスをレンダリング */}
              {pdfCanvases.map(({ pageNum, canvas }) => (
                <div 
                  key={pageNum}
                  id={`pdf-page-${pageNum}`}
                  className="mb-3 shadow-lg bg-white w-fit mx-auto"
                  ref={(node) => {
                    if (node && canvas) {
                      // 既存の子要素をクリア
                      while (node.firstChild) {
                        node.removeChild(node.firstChild);
                      }
                      // キャンバスを追加
                      node.appendChild(canvas);
                    }
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Text Panel */}
          <div 
            ref={textPanelRef}
            className="flex-1 overflow-y-auto bg-white text-gray-900"
          >
            {loading ? (
              <div className="text-center py-20 text-gray-600">
                テキストを読み込み中...
              </div>
            ) : isHtmlContent ? (
              <div className="max-w-3xl mx-auto px-20 py-12">
                <div 
                  ref={htmlContentRef}
                  className="prose prose-lg max-w-none prose-gray"
                  dangerouslySetInnerHTML={{ __html: textContent[1] || '' }}
                />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-20 py-12">
                {Object.entries(textContent).map(([pageNum, content]) => (
                  <div 
                    key={pageNum}
                    id={`text-page-${pageNum}`}
                    className="min-h-screen mb-12"
                  >
                    <div className="text-sm text-gray-600 uppercase tracking-wider mb-8 pb-4 border-b border-gray-200">
                      ページ {pageNum}
                    </div>
                    <div 
                      className="prose prose-lg max-w-none prose-gray"
                      dangerouslySetInnerHTML={{ __html: processTextContent(content) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}