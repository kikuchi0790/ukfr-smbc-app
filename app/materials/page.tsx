'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Book, ArrowLeft } from 'lucide-react';
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
  const [syncScroll, setSyncScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [textContent, setTextContent] = useState<Record<number, string>>({});
  const [isRendering, setIsRendering] = useState(false);
  const [pdfCanvases, setPdfCanvases] = useState<Array<{ pageNum: number; canvas: HTMLCanvasElement }>>([]);

  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scriptLoadedRef = useRef(false);

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
      
      // テキストファイルを読み込む
      const baseFilename = filename.replace('.pdf', '_ja');
      const fixedFilename = baseFilename + '_fixed.txt';
      
      try {
        const response = await fetch(`/materials/${fixedFilename}`);
        if (response.ok) {
          await loadText(fixedFilename);
        }
      } catch (error) {
        console.error('Failed to load text file:', error);
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
    } catch (error) {
      console.error('Error loading text:', error);
    }
  };

  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    setCurrentPage(pageNum);
    
    const pdfPage = document.getElementById(`pdf-page-${pageNum}`);
    const textPage = document.getElementById(`text-page-${pageNum}`);
    
    if (pdfPage) {
      pdfPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (textPage && syncScroll) {
      setTimeout(() => {
        textPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const processTextContent = (content: string) => {
    let processed = content
      .replace(/^([A-Z][^\n]{0,100})$/gm, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>')
      .replace(/^(\d+\.\s+[^\n]+)$/gm, '<h3 class="text-lg font-medium mt-6 mb-3">$1</h3>')
      .replace(/^(\d+\.\d+\.\s+[^\n]+)$/gm, '<h4 class="text-base font-medium mt-4 mb-2">$1</h4>');
    
    const paragraphs = processed.split('\n\n').map(para => {
      para = para.trim();
      if (para && !para.match(/^<[^>]+>/)) {
        return `<p class="mb-4 text-justify">${para}</p>`;
      }
      return para;
    });
    
    return paragraphs.join('\n');
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
        let visiblePage = 1;
        
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
        
        // 対応するテキストページにスクロール
        const textPage = document.getElementById(`text-page-${visiblePage}`);
        if (textPage) {
          textPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        let visiblePage = 1;
        
        for (let i = 0; i < pageElements.length; i++) {
          const rect = pageElements[i].getBoundingClientRect();
          const textPanelRect = textPanel.getBoundingClientRect();
          
          // ページの上部がビューポート内にあるか確認
          if (rect.top >= textPanelRect.top && rect.top < textPanelRect.top + 100) {
            const match = pageElements[i].id.match(/text-page-(\d+)/);
            if (match) {
              visiblePage = parseInt(match[1]);
              break;
            }
          }
        }
        
        // 対応するPDFページにスクロール
        const pdfPage = document.getElementById(`pdf-page-${visiblePage}`);
        if (pdfPage) {
          pdfPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        setCurrentPage(visiblePage);
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
  }, [syncScroll, pdfCanvases.length]);

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
            className="flex-1 overflow-y-auto bg-white"
          >
            {loading ? (
              <div className="text-center py-20 text-gray-500">
                テキストを読み込み中...
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-20 py-12">
                {Object.entries(textContent).map(([pageNum, content]) => (
                  <div 
                    key={pageNum}
                    id={`text-page-${pageNum}`}
                    className="min-h-screen mb-12"
                  >
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-8 pb-4 border-b">
                      ページ {pageNum}
                    </div>
                    <div 
                      className="prose prose-lg max-w-none"
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