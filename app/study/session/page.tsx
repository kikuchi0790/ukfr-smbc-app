"use client";

import { useEffect, useLayoutEffect, useState, Suspense, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import KeyboardHelpModal from '@/components/KeyboardHelpModal';
import { 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertCircle,
  BookOpen,
  Languages,
  Timer
} from "lucide-react";
import { Question, StudySession, Answer, UserProgress, StudyMode, Category, CategoryProgress, HighlightAnchor, IncorrectQuestion } from "@/types";
import StudyTimer from "@/components/StudyTimer";
import ErrorAlert from "@/components/ErrorAlert";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";
import { fetchJSON } from "@/utils/fetch-utils";
import { safeLocalStorage, getUserKey } from "@/utils/storage-utils";
import { 
  getRandomQuestionsForCategory, 
  getMockQuestions, 
  getReviewQuestions,
  saveIncorrectQuestion,
  updateReviewCount,
  moveToOvercomeQuestions,
  getSequentialQuestionsForCategory,
  getAnsweredQuestionIds
} from "@/utils/study-utils";
import { getCategoryInfo, categories } from "@/utils/category-utils";
import { AnsweredQuestionsTracker } from "@/utils/answered-questions-tracker";
import { validateAndFixProgress } from "@/utils/progress-tracker";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { progressSync } from "@/services/progress-sync";
import { extractKeywords } from "@/services/keyword-extraction";
import { SessionPersistence } from "@/utils/session-persistence";
import { syncAnsweredQuestionsWithProgress } from "@/utils/progress-sync-utils";
import { createBackup } from "@/utils/data-backup";

function StudySessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const mode = searchParams.get("mode") as StudyMode;
  const categoryParam = searchParams.get("category") ? decodeURIComponent(searchParams.get("category")!) : null;
  const partParam = searchParams.get("part");
  const studyModeParam = searchParams.get("studyMode") as "random" | "sequential" | null;
  const questionCountParam = searchParams.get("questionCount");
  const restoreParam = searchParams.get("restore") === "true";
  const sessionIdParam = searchParams.get("sessionId");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [mockAnswers, setMockAnswers] = useState<Map<string, string>>(new Map()); // Mock試験用の回答記録
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJapanese, setShowJapanese] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showOvercomeMessage, setShowOvercomeMessage] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [questionsToRestore, setQuestionsToRestore] = useState<string[] | null>(null);
  const [ragStatus, setRagStatus] = useState<string | null>(null); // RAG検索ステータスメッセージ
  const [ragElapsedTime, setRagElapsedTime] = useState<number>(0); // RAG検索の経過時間（秒）
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false); // 保存中インジケーター
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false); // キーボードヘルプ
  const [keyboardSelectedOption, setKeyboardSelectedOption] = useState<string | null>(null); // キーボード選択
  const [screenReaderMessage, setScreenReaderMessage] = useState<string>(''); // スクリーンリーダー用メッセージ
  const sessionPersistence = useRef<SessionPersistence | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null); // フォーカス管理用
  const isLoadingQuestions = useRef(false);
  const hasRestoredRef = useRef(false);
  // RAG検索結果のキャッシュ（セッション永続化）
  const ragResultsCache = useRef<Map<string, any>>((() => {
    // sessionStorageから復元を試みる
    try {
      const cached = sessionStorage.getItem('ragResultsCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return new Map(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore RAG cache from sessionStorage:', e);
    }
    return new Map();
  })());
  const ragTimerRef = useRef<NodeJS.Timeout | null>(null); // RAG検索タイマー
  const { error, isError, clearError, handleError, withErrorHandling } = useErrorHandler();

  // スクリーンリーダー用アナウンス関数
  const announceToScreenReader = (message: string) => {
    setScreenReaderMessage(message);
    // 短時間後にメッセージをクリア（次のアナウンスのため）
    setTimeout(() => setScreenReaderMessage(''), 100);
  };

  const isMockMode = mode === "mock25" || mode === "mock75";

  // セッション保存関数
  const saveSessionState = useCallback(async () => {
    if (!session || !questions.length) return false;

    setIsSaving(true); // 保存開始を表示
    const persistence = sessionPersistence.current || SessionPersistence.getInstance();
    const saved = await persistence.saveSession(
      session,
      questions,
      currentQuestionIndex,
      isMockMode ? mockAnswers : undefined,
      showJapanese,
      selectedAnswer || undefined,
      showResult,
      mode,
      categoryParam || undefined,
      partParam || undefined,
      studyModeParam || undefined,
      questionCountParam || undefined,
      user?.nickname
    );
    if (saved) {
      setHasUnsavedChanges(false);
      setLastSaveTime(new Date());
    }
    
    // 保存完了後、インジケーターを非表示にする
    setTimeout(() => setIsSaving(false), 1000); // 1秒後に非表示
    return saved;
  }, [session, questions, currentQuestionIndex, mockAnswers, showJapanese,
      selectedAnswer, showResult, mode, categoryParam, partParam,
      studyModeParam, questionCountParam, isMockMode, user?.nickname]);

  // セッション永続化の初期化と問題の読み込み
  useEffect(() => {
    if (!mode) {
      router.push('/study');
      return;
    }

    // セッション永続化の初期化
    sessionPersistence.current = SessionPersistence.getInstance();

    // カスタムイベントリスナーの設定は別のuseEffectで行う

    if (!hasRestoredRef.current) {
      loadQuestions();
    }

    return () => {
      if (sessionPersistence.current) {
        sessionPersistence.current.stopAutosave();
      }
    };
  }, [mode, categoryParam, partParam, studyModeParam, questionCountParam, router]);
  
  // カスタムイベントリスナーの設定
  useEffect(() => {
    const handleAutosave = () => saveSessionState();
    const handleCheckUnsaved = (event: any) => {
      event.detail.hasChanges = hasUnsavedChanges;
    };

    window.addEventListener('session-autosave', handleAutosave);
    window.addEventListener('check-unsaved-changes', handleCheckUnsaved);
    
    return () => {
      window.removeEventListener('session-autosave', handleAutosave);
      window.removeEventListener('check-unsaved-changes', handleCheckUnsaved);
    };
  }, [hasUnsavedChanges, saveSessionState]);

  // Mock試験の進捗を自動保存
  useEffect(() => {
    if (isMockMode && session && mockAnswers.size > 0) {
      const mockProgress = {
        session: {
          ...session,
          currentQuestionIndex,
          savedAt: new Date().toISOString()
        },
        mockAnswers: Array.from(mockAnswers.entries()),
        questions
      };
      const progressKey = `mockExamProgress_${user?.nickname}`;
      safeLocalStorage.setItem(progressKey, mockProgress);
    }
  }, [mockAnswers, currentQuestionIndex, session, questions, mode, user]);

  // セッション終了時のリダイレクト
  useEffect(() => {
    console.log('sessionEnded changed:', sessionEnded);
    if (sessionEnded) {
      console.log('Navigating to /study/complete');
      router.push('/study/complete');
    }
  }, [sessionEnded, router]);

  // セッション復元処理（同期的に適用して描画前に整合性を保つ）
  useLayoutEffect(() => {
    if (authLoading) return; // 認証未確定なら待機
    
    const applyRestoration = (saved: any, source: 'persistence' | 'legacy') => {
      try {
        setSession(saved.session);
        setShowJapanese(saved.showJapanese);

        // Prefer questions array if present (v2)
        if (Array.isArray(saved.questions) && saved.questions.length > 0 && typeof saved.questions[0] !== 'string') {
          const qs = saved.questions as Question[];
          setQuestions(qs);
          // Recalculate index by ID if available
          const idBasedIndex = saved.currentQuestionId ? qs.findIndex(q => q.questionId === saved.currentQuestionId) : -1;
          const resolvedIndex = idBasedIndex >= 0 ? idBasedIndex : (saved.currentQuestionIndex || saved.session?.currentQuestionIndex || 0);
          setCurrentQuestionIndex(resolvedIndex);

          // Restore answer/showResult only when IDs match
          const current = qs[resolvedIndex];
          if (current && saved.currentQuestionId && current.questionId === saved.currentQuestionId) {
            if (saved.selectedAnswer !== undefined) setSelectedAnswer(saved.selectedAnswer);
            if (saved.showResult !== undefined) setShowResult(saved.showResult);
          } else {
            setSelectedAnswer(null);
            setShowResult(false);
          }
          hasRestoredRef.current = true;
          // Ensure UI resumes immediately without waiting for loader
          setLoading(false);
          isLoadingQuestions.current = false;
          // Start autosave loop when restored directly
          if (sessionPersistence.current) {
            sessionPersistence.current.startAutosave(() => { void saveSessionState(); });
          }
        } else if (Array.isArray(saved.questionIds) || (Array.isArray(saved.questions) && typeof saved.questions[0] === 'string')) {
          // v1 compatibility: let loader reconstruct
          const ids = (saved.questionIds as string[]) || (saved.questions as string[]);
          setQuestionsToRestore(ids);
          setCurrentQuestionIndex(saved.currentQuestionIndex || saved.session?.currentQuestionIndex || 0);
          hasRestoredRef.current = false; // allow loader to run
        }

        if (saved.mockAnswers) setMockAnswers(new Map(saved.mockAnswers));

        // Cleanup only when not returning from materials
        if (source === 'legacy' && !restoreParam) {
          safeLocalStorage.removeItem('studySessionState');
          safeLocalStorage.removeItem('materialNavigationState');
        }
      } catch (e) {
        console.error('[Session] Failed to apply restoration:', e);
      }
    };

    // 1) Prefer unified persistence
    const persistence = sessionPersistence.current || SessionPersistence.getInstance();
    const savedSession = persistence.loadSession(user?.nickname);
    if (savedSession) {
      // モード、カテゴリ、パートが一致するか確認
      const isMatchingSession = savedSession.mode === mode && 
                                savedSession.category === categoryParam && 
                                (!partParam || savedSession.part === partParam);
      
      if (isMatchingSession) {
        console.log('[Session Restore] Found matching session from persistence');
        applyRestoration(savedSession, 'persistence');
        
        // 復元成功メッセージを表示
        const answersCount = savedSession.session?.answers?.length || 0;
        if (answersCount > 0) {
          const timeSince = Date.now() - new Date(savedSession.savedAt).getTime();
          const minutesSince = Math.floor(timeSince / 60000);
          const message = minutesSince < 1 
            ? `前回のセッションを復元しました（${answersCount}問回答済み）`
            : `前回のセッションを復元しました（${minutesSince}分前・${answersCount}問回答済み）`;
          
          // 一時的なトースト表示（3秒後に自動で消える）
          const toast = document.createElement('div');
          toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-500';
          toast.textContent = message;
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 500);
          }, 3000);
        }
        return;
      } else {
        console.log('[Session Restore] Session found but not matching current mode/category');
      }
    }

    // 2) Fallback: manual snapshot (used for materials navigation)
    const savedLegacy = safeLocalStorage.getItem<any>('studySessionState');
    if (savedLegacy && savedLegacy.mode === mode && savedLegacy.category === categoryParam && savedLegacy.part === partParam) {
      // Validate within 60 minutes (extended from 30)
      const savedTime = new Date(savedLegacy.savedAt).getTime();
      const currentTime = Date.now();
      if (currentTime - savedTime < 60 * 60 * 1000) {
        console.log('[Session Restore] Found matching session from legacy storage');
        applyRestoration(savedLegacy, 'legacy');
        return;
      } else {
        console.log('[Session Restore] Legacy session expired');
      }
    }
  }, [mode, categoryParam, partParam, user?.nickname, authLoading, restoreParam]);

  const loadQuestionsCore = async () => {
    // 既に読み込み中の場合はスキップ
    if (isLoadingQuestions.current) {
      console.log('Already loading questions, skipping...');
      return;
    }
    
    isLoadingQuestions.current = true;
    setLoading(true);
    
    // Add a loading timeout
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      isLoadingQuestions.current = false;
      handleError(new Error('問題の読み込みがタイムアウトしました。ページを更新してください。'));
    }, 60000); // 60 seconds timeout
    
    try {
      console.log('Starting to load questions...', { mode, categoryParam, partParam });
      let questionSet: Question[] = [];
      let timeLimit: number | undefined;
      
      // Load all questions first
      const allQuestions = await fetchJSON<Question[]>('/data/all-questions.json');

      const userProgressKey = getUserKey('userProgress', user?.nickname);
      const savedProgress = safeLocalStorage.getItem<any>(userProgressKey);
      
      // デフォルトのUserProgressオブジェクト
      const defaultProgress: UserProgress = {
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        categoryProgress: {} as Record<Category, CategoryProgress>,
        studySessions: [],
        incorrectQuestions: [],
        overcomeQuestions: [],
        currentStreak: 0,
        bestStreak: 0,
        lastStudyDate: new Date().toISOString(),
        preferences: {
          showJapaneseInStudy: true,
          showJapaneseInMock: false,
          autoReviewIncorrect: true,
          notificationEnabled: false,
          categoryStudyMode: 'random'
        }
      };
      
      // savedProgressが存在し、必要なプロパティがある場合はマージ、そうでなければデフォルトを使用
      const progress: UserProgress = savedProgress ? {
        ...defaultProgress,
        ...savedProgress,
        preferences: {
          ...defaultProgress.preferences,
          ...(savedProgress.preferences || {})
        }
      } : defaultProgress;

      if (mode === "category" && categoryParam) {
        // カテゴリ別学習：デフォルト10問（パラメータがあれば5問も可能）
        const questionCount = questionCountParam === "5" ? 5 : 10;
        const categoryQuestions = allQuestions.filter(q => q.category === categoryParam);
        
        if (categoryQuestions.length === 0) {
          // カテゴリが見つからない場合のエラーメッセージ
          handleError(new Error(`カテゴリ「${categoryParam}」の問題が見つかりませんでした。`));
          return;
        }
        
        // 順番に出題するか、ランダムに出題するか
        if (studyModeParam === "sequential") {
          const answeredIds = getAnsweredQuestionIds(categoryParam, user?.nickname);
          questionSet = getSequentialQuestionsForCategory(
            categoryQuestions,
            answeredIds,
            questionCount
          );
        } else {
          questionSet = getRandomQuestionsForCategory(
            categoryQuestions,
            progress?.incorrectQuestions || [],
            questionCount
          );
        }
        
        setShowJapanese(progress?.preferences?.showJapaneseInStudy ?? true);
      } else if (mode === "review") {
        // 復習モード：間違えた問題からデフォルト10問（パラメータがあれば5問も可能）
        const questionCount = questionCountParam === "5" ? 5 : 10;
        const reviewType = searchParams.get('reviewType') as 'category' | 'mock' || 'category';
        
        questionSet = getReviewQuestions(allQuestions, questionCount, user?.nickname, reviewType);
        if (questionSet.length === 0) {
          const message = reviewType === 'mock' 
            ? "Mock試験で間違えた問題がありません。まずはMock試験を受けてください。"
            : "復習する問題がありません。まずは学習を始めてください。";
          alert(message);
          router.push('/study');
          return;
        }
        setShowJapanese(progress?.preferences?.showJapaneseInStudy ?? true);
      } else if (mode === "mock25" || mode === "mock75") {
        // Mock試験モード - 個別のMockファイルから読み込む
        let mockQuestions: Question[] = [];
        
        // Mock試験番号を抽出 (例: "Regulations Mock 1" -> "1")
        const mockNumber = categoryParam?.match(/Mock (\d+)/)?.[1];
        if (mockNumber) {
          try {
            // 個別のMock試験ファイルから読み込む
            const mockData = await fetchJSON<Question[]>(`/data/category-regulations-mock-${mockNumber}.json`);
            mockQuestions = mockData;
          } catch (error) {
            console.warn(`Failed to load mock file, falling back to all-questions.json`, error);
            // フォールバック: all-questions.jsonから読み込む
            mockQuestions = allQuestions.filter(q => q.category === categoryParam);
          }
        } else {
          // Mock番号が取得できない場合はall-questions.jsonから読み込む
          mockQuestions = allQuestions.filter(q => q.category === categoryParam);
        }
        
        const part = partParam ? parseInt(partParam) as 1 | 2 | 3 : undefined;
        questionSet = getMockQuestions(mockQuestions, mode, part);
        timeLimit = mode === "mock25" ? 30 : 90;
        setShowJapanese(progress?.preferences?.showJapaneseInMock ?? false);
      }

      setQuestions(questionSet);
      
      // 復元する問題がある場合は、そのIDに基づいて問題を再構築
      if (questionsToRestore && questionsToRestore.length > 0) {
        const restoredQuestions = questionsToRestore
          .map(id => allQuestions.find(q => q.questionId === id))
          .filter((q): q is Question => q !== undefined);
        
        if (restoredQuestions.length === questionsToRestore.length) {
          setQuestions(restoredQuestions);
        }
      }
      
      // ユーザー固有の進捗が存在しない場合は初期化
      if (!savedProgress && user) {
        const defaultProgress: UserProgress = {
          totalQuestionsAnswered: 0,
          correctAnswers: 0,
          categoryProgress: {} as Record<Category, CategoryProgress>,
          studySessions: [],
          incorrectQuestions: [],
          overcomeQuestions: [],
          currentStreak: 0,
          bestStreak: 0,
          lastStudyDate: new Date().toISOString(),
          preferences: {
            showJapaneseInStudy: true,
            showJapaneseInMock: false,
            autoReviewIncorrect: true,
            notificationEnabled: false,
            categoryStudyMode: 'random'
          }
        };
        
        // カテゴリプログレスを初期化
        categories.forEach(category => {
          defaultProgress.categoryProgress[category.name] = {
            totalQuestions: category.totalQuestions,
            answeredQuestions: 0,
            correctAnswers: 0
          };
        });
        
        safeLocalStorage.setItem(userProgressKey, defaultProgress);
      }
      
      // Check for saved Mock exam progress
      let savedMockProgress = null;
      if ((mode === "mock25" || mode === "mock75") && categoryParam) {
        const progressKey = `mockExamProgress_${user?.nickname}`;
        savedMockProgress = safeLocalStorage.getItem<any>(progressKey);
        if (savedMockProgress && savedMockProgress.session.category === categoryParam && savedMockProgress.session.mode === mode) {
          // Restore saved progress
          const mockAnswersMap = new Map<string, string>(savedMockProgress.mockAnswers);
          setMockAnswers(mockAnswersMap);
          setCurrentQuestionIndex(savedMockProgress.session.currentQuestionIndex);
          setSession(savedMockProgress.session);
          
          // Show confirmation message
          const timeSince = new Date().getTime() - new Date(savedMockProgress.session.savedAt).getTime();
          const minutesSince = Math.floor(timeSince / 60000);
          if (minutesSince < 60) {
            alert(`前回の進捗を復元しました（${minutesSince}分前に保存）`);
          }
          return;
        }
      }
      
      // Initialize new session if no saved progress
      const newSession: StudySession = {
        id: Date.now().toString(),
        mode,
        category: categoryParam as any,
        mockPart: partParam ? parseInt(partParam) as 1 | 2 | 3 : undefined,
        startedAt: new Date().toISOString(),
        currentQuestionIndex: 0,
        questions: questionSet,
        answers: [],
        timeLimit,
        showJapanese
      };
      setSession(newSession);
      
      // Clear the timeout if loading successful
      clearTimeout(loadingTimeout);
      
      // 自動保存を開始
      if (sessionPersistence.current) {
        sessionPersistence.current.startAutosave(saveSessionState);
      }
    } catch (error) {
      clearTimeout(loadingTimeout);
      console.error('Failed to load questions:', error);
      
      // More specific error messages
      if (!navigator.onLine) {
        handleError(new Error('インターネット接続がありません。接続を確認してください。'));
      } else if (!categoryParam) {
        handleError(new Error('カテゴリが指定されていません'));
      } else if (error instanceof Error && error.message.includes('404')) {
        handleError(new Error('問題ファイルが見つかりません。管理者にお問い合わせください。'));
      } else {
        handleError(error instanceof Error ? error : new Error('問題の読み込みに失敗しました'));
      }
      throw error;
    } finally {
      setLoading(false);
      isLoadingQuestions.current = false;
    }
  };
  
  const loadQuestions = useCallback(() => {
    loadQuestionsCore().catch(error => {
      console.error('Error in loadQuestions:', error);
    });
  }, [mode, categoryParam, partParam, questionCountParam, studyModeParam, user?.nickname]);

  const handleAnswerSelect = (answer: string) => {
    if (!showResult) {
      setSelectedAnswer(answer);
      setKeyboardSelectedOption(null); // キーボード選択をクリア
      setHasUnsavedChanges(true);
    }
  };

  // キーボードショートカットの設定
  useKeyboardNavigation({
    shortcuts: [
      // 選択肢選択
      {
        key: ['1', 'a', 'A'],
        handler: () => {
          const currentQuestion = questions[currentQuestionIndex];
          if (currentQuestion && currentQuestion.options.length > 0 && !showResult) {
            const option = currentQuestion.options[0].letter;
            setKeyboardSelectedOption(option);
            setSelectedAnswer(option);
            setHasUnsavedChanges(true);
            // スクリーンリーダーアナウンス
            const optionText = currentQuestion.options[0].text;
            announceToScreenReader(`選択肢 ${option} を選択しました: ${optionText}`);
          }
        },
        description: '選択肢Aを選択',
        enabled: !showResult && !loading
      },
      {
        key: ['2', 'b', 'B'],
        handler: () => {
          const currentQuestion = questions[currentQuestionIndex];
          if (currentQuestion && currentQuestion.options.length > 1 && !showResult) {
            const option = currentQuestion.options[1].letter;
            setKeyboardSelectedOption(option);
            setSelectedAnswer(option);
            setHasUnsavedChanges(true);
            // スクリーンリーダーアナウンス
            const optionText = currentQuestion.options[1].text;
            announceToScreenReader(`選択肢 ${option} を選択しました: ${optionText}`);
          }
        },
        description: '選択肢Bを選択',
        enabled: !showResult && !loading
      },
      {
        key: ['3', 'c', 'C'],
        handler: () => {
          const currentQuestion = questions[currentQuestionIndex];
          if (currentQuestion && currentQuestion.options.length > 2 && !showResult) {
            const option = currentQuestion.options[2].letter;
            setKeyboardSelectedOption(option);
            setSelectedAnswer(option);
            setHasUnsavedChanges(true);
            // スクリーンリーダーアナウンス
            const optionText = currentQuestion.options[2].text;
            announceToScreenReader(`選択肢 ${option} を選択しました: ${optionText}`);
          }
        },
        description: '選択肢Cを選択',
        enabled: !showResult && !loading
      },
      {
        key: ['4', 'd', 'D'],
        handler: () => {
          const currentQuestion = questions[currentQuestionIndex];
          if (currentQuestion && currentQuestion.options.length > 3 && !showResult) {
            const option = currentQuestion.options[3].letter;
            setKeyboardSelectedOption(option);
            setSelectedAnswer(option);
            setHasUnsavedChanges(true);
            // スクリーンリーダーアナウンス
            const optionText = currentQuestion.options[3].text;
            announceToScreenReader(`選択肢 ${option} を選択しました: ${optionText}`);
          }
        },
        description: '選択肢Dを選択',
        enabled: !showResult && !loading
      },
      // アクション
      {
        key: ['Enter', ' '],
        handler: () => {
          if (!showResult && selectedAnswer) {
            handleSubmitAnswer();
          } else if (showResult) {
            handleNextQuestion();
          }
        },
        description: '回答を送信 / 次の問題へ',
        enabled: !loading
      },
      {
        key: ['ArrowLeft', 'p', 'P'],
        handler: () => {
          if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
          }
        },
        description: '前の問題へ',
        enabled: currentQuestionIndex > 0 && !loading
      },
      {
        key: ['ArrowRight', 'n', 'N'],
        handler: () => {
          if (showResult) {
            handleNextQuestion();
          } else if (isMockMode && selectedAnswer) {
            handleSubmitAnswer();
          }
        },
        description: '次の問題へ',
        enabled: !loading
      },
      // 機能
      {
        key: ['j', 'J'],
        handler: () => {
          toggleJapanese();
          announceToScreenReader(`日本語表示を${!showJapanese ? '有効' : '無効'}にしました`);
        },
        description: '日本語表示のON/OFF',
        enabled: true
      },
      {
        key: ['m', 'M'],
        handler: () => {
          if (showResult) {
            handleCheckInMaterials();
          }
        },
        description: '教材で詳しく確認',
        enabled: showResult && !extractingKeywords
      },
      {
        key: ['Escape'],
        handler: () => {
          if (!showKeyboardHelp) {
            // 確認ダイアログを表示
            if (session?.answers && session.answers.length > 0) {
              const confirmMessage = isMockMode
                ? 'Mock試験を終了しますか？\n進捗は保存されます。'
                : `学習セッションを終了しますか？\n${session.answers.length}問回答済み（自動保存済み）`;
              
              if (window.confirm(confirmMessage)) {
                if (sessionPersistence.current) {
                  sessionPersistence.current.saveImmediately(saveSessionState);
                }
                
                if (isMockMode) {
                  setShowExitConfirm(true);
                } else {
                  router.push('/study');
                }
              }
            } else {
              router.push('/study');
            }
          }
        },
        description: '学習セッションを終了',
        enabled: !showKeyboardHelp
      },
      {
        key: ['?', '/'],
        shift: true,
        handler: () => {
          setShowKeyboardHelp(true);
          announceToScreenReader('キーボードヘルプを開きました');
        },
        description: 'キーボードヘルプを表示',
        enabled: true
      }
    ],
    enabled: !loading && !showExitConfirm && !showCompleteConfirm
  });

  // キーボード選択をクリア（問題変更時）とフォーカス管理
  useEffect(() => {
    setKeyboardSelectedOption(null);
    // 新しい問題に移動したときにフォーカスを設定
    if (mainContentRef.current) {
      mainContentRef.current.focus();
    }
    // 問題変更をアナウンス
    if (questions[currentQuestionIndex]) {
      announceToScreenReader(`問題 ${currentQuestionIndex + 1} / ${questions.length}`);
    }
  }, [currentQuestionIndex]);

  // Mock試験で前の問題に戻った時に前回の回答を復元
  useEffect(() => {
    const question = questions[currentQuestionIndex];
    if (question && (mode === "mock25" || mode === "mock75")) {
      const previousAnswer = mockAnswers.get(question.questionId);
      if (previousAnswer) {
        setSelectedAnswer(previousAnswer);
      } else {
        setSelectedAnswer(null);
      }
    }
  }, [currentQuestionIndex, questions, mockAnswers, mode]);

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !session || !questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    // スクリーンリーダーアナウンス
    announceToScreenReader(isCorrect ? '正解です！' : '不正解です。解説を確認してください。');
    const isMockMode = mode === "mock25" || mode === "mock75";
    
    // Record answer
    const newAnswer: Answer = {
      questionId: currentQuestion.questionId,
      selectedAnswer,
      isCorrect,
      answeredAt: new Date().toISOString()
    };

    const updatedSession = {
      ...session,
      answers: [...session.answers, newAnswer]
    };
    setSession(updatedSession);
    setHasUnsavedChanges(true);
    
    // 回答後即座に保存（誤操作による進捗喪失を防ぐ）
    if (sessionPersistence.current) {
      sessionPersistence.current.incrementAnswerCount(saveSessionState);
      // 追加: 即座に保存を実行
      sessionPersistence.current.saveImmediately(saveSessionState);
    }
    
    // Mock試験モードでは採点を保留
    if (!isMockMode) {
      // Update user progress
      updateUserProgress(isCorrect, currentQuestion);
      
      // Save incorrect question if wrong
      if (!isCorrect) {
        saveIncorrectQuestion(currentQuestion.questionId, currentQuestion.category, user?.nickname);
      }
      
      // Update review count if in review mode
      if (mode === "review") {
        updateReviewCount(currentQuestion.questionId, user?.nickname);
        
        // 復習モードで正解した場合、克服フォルダに移動
        if (isCorrect) {
          const moved = moveToOvercomeQuestions(currentQuestion.questionId, mode, user?.nickname);
          if (moved) {
            setShowOvercomeMessage(true);
            // 3秒後にメッセージを非表示
            setTimeout(() => setShowOvercomeMessage(false), 3000);
          }
        }
      }
      
      setShowResult(true);
    } else {
      // Mock試験モードでは回答を記録
      const newMockAnswers = new Map(mockAnswers);
      newMockAnswers.set(currentQuestion.questionId, selectedAnswer);
      setMockAnswers(newMockAnswers);
      
      if (currentQuestionIndex < questions.length - 1) {
        // 次の問題へ
        handleNextQuestion();
      } else {
        // 最後の問題の場合は確認画面を表示
        setShowCompleteConfirm(true);
      }
    }
  };

  const handleCheckInMaterials = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !session) return;

    // キャッシュがある場合は即座に遷移（UI表示なし）
    const cachedResult = ragResultsCache.current.get(currentQuestion.questionId);
    if (cachedResult) {
      console.log('[Study Session] Using cached RAG results for question:', currentQuestion.questionId);
      
      // セッションを保存（待機表示なし）
      await saveSessionState();
      const sessionSnapshot = {
        mode,
        category: categoryParam,
        part: partParam,
        studyMode: studyModeParam,
        questionCount: questionCountParam,
        session: {
          ...session,
          currentQuestionIndex,
        },
        showJapanese,
        selectedAnswer,
        showResult,
        savedAt: new Date().toISOString(),
        questions: questions,
        currentQuestionId: currentQuestion.questionId,
        currentQuestionIndex,
        currentQuestion // 問題情報も保存
      };
      safeLocalStorage.setItem('studySessionState', sessionSnapshot);
      
      // ナビゲーション情報を保存
      const navigationState = {
        from: 'study',
        mode,
        category: categoryParam,
        part: partParam,
        studyMode: studyModeParam,
        questionCount: questionCountParam,
        sessionId: session.id,
        materialId: cachedResult.materialId,
        page: cachedResult.page,
        anchor: cachedResult.anchor,
        questionId: currentQuestion.questionId,
        currentQuestion // 問題情報を含める
      };
      safeLocalStorage.setItem('materialNavigationState', navigationState);
      
      // 教材画面へ遷移
      const queryParams = new URLSearchParams({
        from: 'study',
        questionId: currentQuestion.questionId,
        keywords: cachedResult.keywords?.join(',') || '',
        autoSearch: 'true',
        returnMode: mode,
        returnCategory: categoryParam || '',
        returnPart: partParam || '',
        returnStudyMode: studyModeParam || '',
        returnQuestionCount: questionCountParam || ''
      });
      
      router.push(`/materials?${queryParams.toString()}`);
      return;
    }

    setExtractingKeywords(true);
    setRagStatus('教材を検索中...');
    setRagElapsedTime(0);
    
    // タイマー開始
    const startTime = Date.now();
    ragTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRagElapsedTime(elapsed);
      setRagStatus(`教材を検索中... (${elapsed}秒経過)`);
    }, 1000);
    
    let chosenMaterialId: string | undefined;
    let chosenPage: number | undefined;
    
    try {
      // セッションを保存（完了を待ってから遷移）
      await saveSessionState();
      // 明示的に studySessionState を書き出して確実に復元可能にする
      const sessionSnapshot = {
        mode,
        category: categoryParam,
        part: partParam,
        studyMode: studyModeParam,
        questionCount: questionCountParam,
        session: {
          ...session,
          currentQuestionIndex,
        },
        showJapanese,
        selectedAnswer,
        showResult,
        savedAt: new Date().toISOString(),
        questions: questions, // 問題リスト全体を保存（IDだけでなく）
        currentQuestionId: currentQuestion.questionId, // 現在の問題IDを保存
        currentQuestionIndex // インデックスも明示的に保存
      };
      safeLocalStorage.setItem('studySessionState', sessionSnapshot);
      
      // キーワードを抽出
      const keywords = await extractKeywords(currentQuestion);

      // RAG検索を実行し、結果を保存（7日）
      try {
        // 選定された材料ID/ページ（見つからない場合はundefinedのまま）
        // タイムアウト設定（10秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // Prepare enhanced query with explanation
        const questionWithOptions = `${currentQuestion.question} \nOptions: ${currentQuestion.options.map(o=>`${o.letter}. ${o.text}`).join(' ')}`;
        const correctAnswer = currentQuestion.options.find(o => o.letter === currentQuestion.correctAnswer)?.text;
        
        const ragResp = await fetch('/api/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            k: 10,  // Increased for better coverage
            question: questionWithOptions,
            questionId: currentQuestion.questionId,
            explanation: currentQuestion.explanation,  // Pass explanation for better context
            useAdvancedSearch: true  // Enable GPT-4o powered multi-stage search
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await ragResp.json();
        console.log('[Study Session] RAG response:', { 
          ok: ragResp.ok, 
          success: data.success, 
          passagesCount: data.data?.passages?.length,
          fallback: data.fallback
        });
        
        if (ragResp.ok && data.success && data.data?.passages) {
          let storedPayload = data.data as any;
          console.log('[Study Session] RAG passages:', storedPayload.passages.slice(0, 5).map((p: any) => ({
            materialId: p.materialId,
            page: p.page,
            score: p.score?.toFixed(3),
            queryHits: p.queryHits || 1,
            snippet: p.quote ? p.quote.slice(0, 80) + '...' : ''
          })));
          
          // 古いmaterialIdが含まれているか検査
          const hasOldFormat = storedPayload.passages.some((p: any) => 
            p.materialId && p.materialId.includes('_backup')
          );
          if (hasOldFormat) {
            console.warn('[Study Session] WARNING: RAG results contain old materialId format. Index rebuild required!');
          }
          
          // Enhanced reranking with more context
          try {
            const topForRerank = Array.isArray(storedPayload.passages) ? storedPayload.passages.slice(0, 8) : [];  // Increased to 8 for better accuracy
            if (topForRerank.length > 0) {
              // Extract amounts from question and explanation
              const amountRegex = /£[\d,]+|\d{2,3},\d{3}ポンド|\$[\d,]+|\d+%/g;
              const extractedAmounts = [
                ...(currentQuestion.question.match(amountRegex) || []),
                ...(currentQuestion.explanation?.match(amountRegex) || [])
              ].filter((v, i, a) => a.indexOf(v) === i);  // Unique values
              
              const rerankResp = await fetch('/api/rerank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  question: currentQuestion.question,
                  passages: topForRerank,
                  explanation: currentQuestion.explanation,
                  extractedAmounts
                })
              });
              if (rerankResp.ok) {
                const rerankJson = await rerankResp.json();
                console.log('[Study Session] Rerank result:', {
                  ...rerankJson?.data,
                  confidence: rerankJson?.data?.confidence,
                  reasoning: rerankJson?.data?.reasoning?.slice(0, 100)
                });
                if (rerankJson?.success && rerankJson?.data) {
                  storedPayload = { ...storedPayload, best: rerankJson.data };
                  // ページはbestから、materialIdは候補から推定
                  chosenPage = Number(rerankJson.data.page);
                  const matched = topForRerank.find((p: any) => Number(p.page) === chosenPage);
                  chosenMaterialId = matched?.materialId || topForRerank[0]?.materialId;
                  console.log('[Study Session] After rerank - materialId:', chosenMaterialId, 'page:', chosenPage);
                }
              }
            }
          } catch (e) {
            console.warn('Rerank failed, using top passage as-is');
          }
          
          // リランクが無い場合や失敗時は先頭を使用
          if (!chosenMaterialId || !chosenPage) {
            const first = Array.isArray(storedPayload.passages) ? storedPayload.passages[0] : undefined;
            if (first) {
              chosenMaterialId = first.materialId;
              chosenPage = first.page;
              console.log('[Study Session] Using first passage - materialId:', chosenMaterialId, 'page:', chosenPage);
            }
          }
          
          // 古いmaterialId形式を修正
          if (chosenMaterialId && chosenMaterialId.includes('_backup')) {
            console.warn('[Study Session] Fixing old materialId format:', chosenMaterialId);
            if (chosenMaterialId.includes('StudyCompanion')) {
              chosenMaterialId = 'UKFR_ED32_Study_Companion';
            } else if (chosenMaterialId.includes('Checkpoint')) {
              chosenMaterialId = 'UKFR_ED32_Checkpoint';
            }
            console.log('[Study Session] Fixed materialId to:', chosenMaterialId);
          }

          safeLocalStorage.setItem(`retrieveResults_${currentQuestion.questionId}`, storedPayload);
          
          // キャッシュに保存
          const cacheData = {
            materialId: chosenMaterialId,
            page: chosenPage,
            anchor: null,
            keywords,
            storedPayload
          };
          ragResultsCache.current.set(currentQuestion.questionId, cacheData);
          
          // sessionStorageにも保存
          try {
            const cacheArray = Array.from(ragResultsCache.current.entries());
            sessionStorage.setItem('ragResultsCache', JSON.stringify(cacheArray));
          } catch (e) {
            console.warn('Failed to save RAG cache to sessionStorage:', e);
          }
          
          setRagStatus('関連箇所を特定しました');
        } else if (data.fallback && data.data?.passages) {
          // Fallback to local search was used
          console.info('Using local vector search fallback');
          const fallbackData = data.data as any;
          
          // Fallback時も変数を設定
          if (Array.isArray(fallbackData.passages) && fallbackData.passages.length > 0) {
            const first = fallbackData.passages[0];
            chosenMaterialId = first.materialId;
            chosenPage = first.page;
            console.log('[Study Session] Fallback - materialId:', chosenMaterialId, 'page:', chosenPage);
            
            // 古いmaterialId形式を修正
            if (chosenMaterialId && chosenMaterialId.includes('_backup')) {
              console.warn('[Study Session] Fixing old materialId format in fallback:', chosenMaterialId);
              if (chosenMaterialId.includes('StudyCompanion')) {
                chosenMaterialId = 'UKFR_ED32_Study_Companion';
              } else if (chosenMaterialId.includes('Checkpoint')) {
                chosenMaterialId = 'UKFR_ED32_Checkpoint';
              }
              console.log('[Study Session] Fixed materialId to:', chosenMaterialId);
            }
          }
          
          safeLocalStorage.setItem(`retrieveResults_${currentQuestion.questionId}`, fallbackData);
          
          // キャッシュに保存
          const cacheData = {
            materialId: chosenMaterialId,
            page: chosenPage,
            anchor: null,
            keywords,
            fallbackData
          };
          ragResultsCache.current.set(currentQuestion.questionId, cacheData);
          
          // sessionStorageにも保存
          try {
            const cacheArray = Array.from(ragResultsCache.current.entries());
            sessionStorage.setItem('ragResultsCache', JSON.stringify(cacheArray));
          } catch (e) {
            console.warn('Failed to save RAG cache to sessionStorage:', e);
          }
          
          setRagStatus('ローカル検索で関連箇所を特定しました');
        } else if (!ragResp.ok) {
          console.warn('RAG search error:', data.error || 'Unknown error');
          setRagStatus('検索に失敗しました。キーワードのみで表示します');
        }
      } catch (e) {
        console.error('[Study Session] RAG retrieve error:', e);
        // Continue with keyword extraction only
        if (e instanceof Error && e.name === 'AbortError') {
          setRagStatus('検索がタイムアウトしました。キーワードのみで表示します');
        } else {
          setRagStatus('検索エラーが発生しました。キーワードのみで表示します');
        }
      }
      
      // 現在のセッション情報を保存
      // In a real implementation, the anchor would be pre-calculated and stored with the question.
      const anchor: HighlightAnchor = {
        selector: 'p:nth-child(3)',      // Placeholder
        startOffset: 0,                  // Placeholder
        endOffset: 100,                  // Placeholder
        selectedText: keywords.join(' '), // Using keywords as the selected text
        beforeText: '',                  // Placeholder
        afterText: '',                   // Placeholder
        pageNumber: chosenPage || 1      // Use the actual page from RAG search
      };

      const navigationState = {
        from: mode === 'review' ? 'review' : isMockMode ? 'mock' : 'study',
        sessionId: session.id,
        questionIndex: currentQuestionIndex,
        questionId: currentQuestion.questionId,
        keywords,
        anchor, // Add the anchor to the navigation state
        materialId: (typeof chosenMaterialId === 'string' ? chosenMaterialId : undefined),
        page: (typeof chosenPage === 'number' ? chosenPage : undefined),
        mode,
        category: categoryParam,
        part: partParam,
        studyMode: studyModeParam,
        questionCount: questionCountParam,
        // 問題データ全体を追加
        currentQuestion: {
          question: currentQuestion.question,
          questionJa: currentQuestion.questionJa,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.correctAnswer,
          explanation: currentQuestion.explanation,
          explanationJa: currentQuestion.explanationJa,
          category: currentQuestion.category
        },
        // 回答状態も追加
        selectedAnswer: selectedAnswer,
        showResult: showResult,
        showJapanese: showJapanese
      };
      
      // デバッグログ：RAG検索結果と保存する内容を確認
      console.log('[Study Session] Navigation state to save:', {
        materialId: navigationState.materialId,
        page: navigationState.page,
        anchorPage: navigationState.anchor.pageNumber,
        questionId: navigationState.questionId
      });
      
      // LocalStorageに保存
      safeLocalStorage.setItem('materialNavigationState', navigationState);
      
      // 教材ビューアへ遷移
      const queryParams = new URLSearchParams({
        from: navigationState.from,
        questionId: currentQuestion.questionId,
        keywords: keywords.join(','),
        autoSearch: 'true',
        returnMode: mode,
        returnCategory: categoryParam || '',
        returnPart: partParam || '',
        returnStudyMode: studyModeParam || '',
        returnQuestionCount: questionCountParam || ''
      });
      
      router.push(`/materials?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to extract keywords:', error);
      handleError(new Error('キーワード抽出に失敗しました'));
    } finally {
      setExtractingKeywords(false);
      
      // タイマーをクリア
      if (ragTimerRef.current) {
        clearInterval(ragTimerRef.current);
        ragTimerRef.current = null;
      }
      
      // ステータスメッセージを3秒後にクリア
      setTimeout(() => {
        setRagStatus(null);
        setRagElapsedTime(0);
      }, 3000);
    }
  };

  const updateUserProgress = (isCorrect: boolean, question: Question) => {
    try {
      // Check if this question was already answered in this session
      if (answeredQuestionIds.has(question.questionId)) {
        console.log('Question already answered in this session, skipping progress update');
        return;
      }
      
      // データ整合性チェック（初回のみ）
      if (!sessionPersistence.current?.hasPerformedDataSync) {
        console.log('🔄 Performing initial data sync...');
        syncAnsweredQuestionsWithProgress(user?.nickname, 'use_higher').then(result => {
          if (result.success) {
            console.log('✅ Initial data sync completed');
          }
        });
        if (sessionPersistence.current) {
          sessionPersistence.current.hasPerformedDataSync = true;
        }
      }
      
      // 復習モードの場合、既に回答済みの問題かチェック
      const isAlreadyAnswered = AnsweredQuestionsTracker.getAnsweredQuestions(question.category).has(question.questionId);
      
      // Add to answered questions for this session
      setAnsweredQuestionIds(prev => new Set(prev).add(question.questionId));
      
      // Update progress using the sync service
      progressSync.updateUserProgress(user?.nickname, (progress) => {
        // デバッグログ: 更新前の値
        console.log('📊 Progress Update - Before:', {
          total: progress.totalQuestionsAnswered,
          correct: progress.correctAnswers,
          question: question.questionId,
          isCorrect,
          mode
        });
        
        // 復習モードの場合、この問題が既に回答/正解したことがあるかチェック
        let shouldIncrementTotal = true;
        let shouldIncrementCorrect = isCorrect;
        
        if (mode === "review") {
          // 既に回答済みの問題かチェック（復習モードで重複カウントを防ぐ）
          if (isAlreadyAnswered) {
            console.log('📚 Review mode: Question was already answered, not incrementing totalQuestionsAnswered');
            shouldIncrementTotal = false;
          }
          
          if (isCorrect) {
            // 過去のセッションでこの問題を正解したことがあるかチェック
            const wasCorrectBefore = progress.studySessions?.some(session => 
              session.answers?.some(answer => 
                answer.questionId === question.questionId && 
                answer.isCorrect
              )
            );
            
            if (wasCorrectBefore) {
              console.log('📚 Review mode: Question was correct before, not incrementing correctAnswers');
              shouldIncrementCorrect = false;
            }
          }
        }
        
        if (shouldIncrementTotal) progress.totalQuestionsAnswered++;
        if (shouldIncrementCorrect) progress.correctAnswers++;
        
        // Update category progress with bounds checking
        const categoryName = question.category as keyof typeof progress.categoryProgress;
        
        // Initialize category if it doesn't exist
        if (!(categoryName in progress.categoryProgress)) {
          const categoryInfo = getCategoryInfo(question.category);
          if (categoryInfo) {
            progress.categoryProgress[categoryName] = {
              totalQuestions: categoryInfo.totalQuestions,
              answeredQuestions: 0,
              correctAnswers: 0
            };
          }
        }
        
        if (categoryName in progress.categoryProgress) {
          const categoryProgress = progress.categoryProgress[categoryName];
          if (categoryProgress) {
            // 復習モードでの新しい問題の判定
            const isNewQuestionInReview = mode === "review" && !isAlreadyAnswered;
            const shouldIncrementAnswered = mode !== "review" || isNewQuestionInReview;
            
            // 回答数を増やすべきかチェック
            if (shouldIncrementAnswered) {
              // 既に最大値に達していないかチェック
              if (categoryProgress.answeredQuestions < categoryProgress.totalQuestions) {
                categoryProgress.answeredQuestions++;
                console.log(`📊 Incremented answered count for ${question.category}: ${categoryProgress.answeredQuestions}/${categoryProgress.totalQuestions}`);
              } else {
                console.warn(`Category ${question.category} already at maximum (${categoryProgress.answeredQuestions}/${categoryProgress.totalQuestions})`);
              }
            } else {
              console.log('📚 Review mode: Not incrementing answered count for already answered question');
            }
            
            // 正解数の更新
            if (shouldIncrementCorrect) {
              categoryProgress.correctAnswers++;
            }
          }
        }
        
        // Update streak
        const today = new Date().toDateString();
        if (progress.lastStudyDate !== today) {
          const lastDate = new Date(progress.lastStudyDate);
          const daysDiff = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            progress.currentStreak++;
          } else if (daysDiff > 1) {
            progress.currentStreak = 1;
          }
          progress.lastStudyDate = today;
        }
        
        // デバッグログ: 更新後の値
        console.log('📊 Progress Update - After:', {
          total: progress.totalQuestionsAnswered,
          correct: progress.correctAnswers,
          categoryProgress: progress.categoryProgress[categoryName]
        });
        
        return progress;
      });
      
      // AnsweredQuestionsTrackerを更新（復習モードでの新しい問題のみ）
      const isNewQuestionInReview = mode === "review" && !isAlreadyAnswered;
      if (mode !== "review" || isNewQuestionInReview) {
        // AnsweredQuestionsTrackerを直接更新（進捗のインクリメントは上記で既に処理済み）
        AnsweredQuestionsTracker.addAnsweredQuestion(question.category as Category, question.questionId);
      }
      
    } catch (error) {
      console.error('Failed to update progress:', error);
      // 進捗の更新に失敗しても学習は継続
    }
  };

  const handleNextQuestion = () => {
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const is10thQuestion = (currentQuestionIndex + 1) % 10 === 0;
    
    console.log('handleNextQuestion:', { currentQuestionIndex, isLastQuestion, is10thQuestion, mode });
    
    // スクリーンリーダーアナウンス
    if (!isLastQuestion) {
      announceToScreenReader(`次の問題に移動しました。問題 ${currentQuestionIndex + 2} / ${questions.length}`);
    } else {
      announceToScreenReader('最後の問題です。結果を表示します。');
    }
    
    if (mode === "category" && (is10thQuestion || isLastQuestion)) {
      // カテゴリ学習：10問ごとに結果表示
      completeSession();
    } else if (isLastQuestion) {
      // 最後の問題
      completeSession();
    } else {
      // 次の問題へ
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = questions[nextIndex];
      
      // 現在の問題のキャッシュのみクリア（他の問題のキャッシュは保持）
      if (nextQuestion && currentQuestion.questionId !== nextQuestion.questionId) {
        // 次の問題が異なる場合のみ、現在の問題のキャッシュをクリア
        ragResultsCache.current.delete(currentQuestion.questionId);
      }
      
      setCurrentQuestionIndex(nextIndex);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const handleMockExamComplete = () => {
    if (!session || !user) {
      console.error('Missing session or user:', { session, user });
      // ユーザーがない場合はログイン画面へ
      if (!user) {
        router.push('/login');
      }
      return;
    }
    
    console.log('handleMockExamComplete called');
    console.log('Current user in handleMockExamComplete:', user);
    console.log('mockAnswers size:', mockAnswers.size);
    console.log('questions length:', questions.length);
    
    // デバッグ: 現在のlocalStorageの状況を確認
    console.log('=== PRE-SAVE DEBUG INFO ===');
    const currentKeys = Object.keys(localStorage);
    console.log('Current localStorage keys:', currentKeys);
    const currentStorage = safeLocalStorage.getStorageInfo();
    console.log('Current storage usage:', `${(currentStorage.used/1024/1024).toFixed(2)}MB / ${(currentStorage.total/1024/1024).toFixed(2)}MB (${currentStorage.percentage}%)`);
    
    // 大きなアイテムを特定
    const largeItems: { key: string, size: number }[] = [];
    currentKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = new Blob([item]).size;
        largeItems.push({ key, size });
      }
    });
    largeItems.sort((a, b) => b.size - a.size);
    console.log('Top 10 largest items:');
    largeItems.slice(0, 10).forEach(item => {
      console.log(`  ${item.key}: ${(item.size/1024).toFixed(2)}KB`);
    });
    
    // Mock試験保存前に積極的なクリーンアップを実行
    try {
      console.log('Performing aggressive cleanup before saving mock result...');
      const storageInfo = safeLocalStorage.getStorageInfo();
      console.log('Storage before cleanup:', `${(storageInfo.used/1024/1024).toFixed(2)}MB / ${(storageInfo.total/1024/1024).toFixed(2)}MB (${storageInfo.percentage}%)`);
      
      // 1. 古いMock試験の詳細データを削除（容量削減効果が高い）
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // 最新Mock試験詳細（latestMockExam_）を削除（400KB削減）
        if (key.startsWith('latestMockExam_')) {
          keysToDelete.push(key);
        }
        
        // 他ユーザーの一時データを削除
        if ((key.startsWith('tempMockResult_') || key.startsWith('tempMockQuestions_')) && 
            !key.includes(user.nickname) && !key.includes(user.id)) {
          keysToDelete.push(key);
        }
        
        // 古いMock試験進捗を削除
        if (key.startsWith('mockExamProgress_') && !key.includes(user.nickname)) {
          keysToDelete.push(key);
        }
        
        // 古いユーザーのデータを削除（きくち、きくち2など）
        if ((key.startsWith('userProgress_') || key.startsWith('answeredQuestions_') || 
             key.startsWith('mockExamHistory_')) && 
            !key.includes(user.nickname) && key !== 'userProgress' && key !== 'answeredQuestions') {
          keysToDelete.push(key);
        }
        
        // Clerkやその他の外部サービスの古いデータ
        if (key.includes('clerk') || key.includes('__clerk') || 
            key === 'ukfr_answered_questions' || key === 'ukfr_user_progress' ||
            key === 'userPreferences' || key.startsWith('userPreferences_')) {
          keysToDelete.push(key);
        }
        
        // その他の不要なデータ
        if (key === 'token' || key === 'key' || key === 'final' || 
            key === 'TanstackQueryDevtools.open' || key === 'ally-supports-cache') {
          keysToDelete.push(key);
        }
      }
      
      // 2. Mock試験履歴をさらに縮小（20→10件）
      const historyKey = `mockExamHistory_${user.nickname}`;
      const history = safeLocalStorage.getItem<any[]>(historyKey) || [];
      if (history.length > 10) {
        safeLocalStorage.setItem(historyKey, history.slice(-10));
        console.log(`Reduced mock exam history from ${history.length} to 10 items`);
      }
      
      // 3. 学習セッション履歴をさらに縮小（50→30件）
      const progressKey = `userProgress_${user.nickname}`;
      const progress = safeLocalStorage.getItem<any>(progressKey);
      if (progress && progress.studySessions && progress.studySessions.length > 30) {
        progress.studySessions = progress.studySessions.slice(-30);
        safeLocalStorage.setItem(progressKey, progress);
        console.log('Reduced study sessions to 30 most recent');
      }
      
      // 削除実行
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        console.log(`Deleted: ${key}`);
      });
      
      const newStorageInfo = safeLocalStorage.getStorageInfo();
      console.log('Storage after cleanup:', `${(newStorageInfo.used/1024/1024).toFixed(2)}MB / ${(newStorageInfo.total/1024/1024).toFixed(2)}MB (${newStorageInfo.percentage}%)`);
      const freedBytes = storageInfo.used - newStorageInfo.used;
      console.log(`Freed up: ${(freedBytes / 1024).toFixed(2)}KB`);
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      // クリーンアップが失敗してもMock試験保存は試行する
    }
    
    // Mock試験の回答をAnswerオブジェクトに変換（未回答も含める）
    const answers: Answer[] = [];
    const incorrectQuestions: string[] = []; // 間違えた問題のIDを収集
    
    questions.forEach((question, index) => {
      const selectedAnswer = mockAnswers.get(question.questionId);
      const isCorrect = selectedAnswer ? selectedAnswer === question.correctAnswer : false;
      
      // 回答の有無に関わらず、すべての問題を記録
      answers.push({
        questionId: question.questionId,
        selectedAnswer: selectedAnswer || '', // 未回答は空文字列
        isCorrect: isCorrect,
        answeredAt: selectedAnswer ? new Date().toISOString() : ''
      });
      
      // 間違えた問題を記録（Mock試験用）
      if (!isCorrect) {
        incorrectQuestions.push(question.questionId);
      }
    });
    
    console.log('answers length:', answers.length);
    console.log('incorrect questions count:', incorrectQuestions.length);
    
    // Mock試験の進捗と間違えた問題を保存
    try {
      const userProgressKey = getUserKey('userProgress', user.nickname);
      const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      
      if (progress) {
        // Mock番号を取得（例: "Regulations: Mock 1" -> 1）
        const mockNumber = session.category?.match(/Mock (\d+)/)?.[1];
        const mockNum = mockNumber ? parseInt(mockNumber) : 0;
        
        // Mock試験の進捗を更新（mockCategoryProgress）
        if (!progress.mockCategoryProgress) {
          progress.mockCategoryProgress = {};
        }
        
        const categoryName = session.category as Category;
        const correctCount = answers.filter(a => a.isCorrect).length;
        const totalCount = answers.length;
        const score = Math.round((correctCount / totalCount) * 100);
        
        if (!progress.mockCategoryProgress[categoryName]) {
          // 初回受験
          progress.mockCategoryProgress[categoryName] = {
            totalQuestions: totalCount,
            attemptsCount: 1,
            bestScore: score,
            latestScore: score,
            averageScore: score,
            passedCount: score >= 70 ? 1 : 0,
            lastAttemptDate: new Date().toISOString()
          };
        } else {
          // 2回目以降の受験
          const existing = progress.mockCategoryProgress[categoryName];
          existing.attemptsCount++;
          existing.latestScore = score;
          existing.bestScore = Math.max(existing.bestScore, score);
          existing.averageScore = Math.round(
            ((existing.averageScore * (existing.attemptsCount - 1)) + score) / existing.attemptsCount
          );
          if (score >= 70) existing.passedCount++;
          existing.lastAttemptDate = new Date().toISOString();
        }
        
        console.log('Mock progress updated:', {
          category: categoryName,
          score,
          attempts: progress.mockCategoryProgress[categoryName].attemptsCount
        });
        
        // 間違えた問題の処理
        if (incorrectQuestions.length > 0) {
          // incorrectQuestionsを初期化
          if (!progress.incorrectQuestions) {
            progress.incorrectQuestions = [];
          }
          
          // 間違えた問題を追加または更新
          incorrectQuestions.forEach(questionId => {
            const existingIndex = progress.incorrectQuestions!.findIndex(
              q => q.questionId === questionId
            );
            
            if (existingIndex >= 0) {
              // 既存の問題の場合は間違い回数を増やす
              progress.incorrectQuestions![existingIndex].incorrectCount++;
              progress.incorrectQuestions![existingIndex].lastIncorrectDate = new Date().toISOString();
              // Mock試験由来の場合、ソースとMock番号を更新
              progress.incorrectQuestions![existingIndex].source = 'mock';
              progress.incorrectQuestions![existingIndex].mockNumber = mockNum;
            } else {
              // 新規の間違い問題
              const question = questions.find(q => q.questionId === questionId);
              if (question) {
                const newIncorrect: IncorrectQuestion = {
                  questionId: questionId,
                  category: question.category,
                  incorrectCount: 1,
                  lastIncorrectDate: new Date().toISOString(),
                  reviewCount: 0,
                  source: 'mock',
                  mockNumber: mockNum
                };
                progress.incorrectQuestions!.push(newIncorrect);
              }
            }
          });
          
          // 互換性のため、mockIncorrectQuestionsも更新（段階的移行）
          if (!progress.mockIncorrectQuestions) {
            progress.mockIncorrectQuestions = [];
          }
          progress.mockIncorrectQuestions = progress.incorrectQuestions
            .filter(q => q.source === 'mock')
            .map(q => ({
              questionId: q.questionId,
              category: q.category,
              incorrectCount: q.incorrectCount,
              lastIncorrectDate: q.lastIncorrectDate,
              reviewCount: q.reviewCount,
              mockNumber: q.mockNumber || 0
            }));
          
        }
        
        // 保存
        safeLocalStorage.setItem(userProgressKey, progress);
        console.log('Mock incorrect questions saved:', progress.incorrectQuestions?.filter(q => q.source === 'mock').length);
      }
    } catch (error) {
      console.error('Failed to save mock progress and incorrect questions:', error);
      // エラーがあっても処理を続行
    }
    
    // Mock試験の結果を一時的に保存（questionsは別に保存）
    const mockResult = {
      session: {
        ...session,
        answers,
        completedAt: new Date().toISOString(),
        // Part情報を確実に保存
        mockPart: session.mockPart
      },
      questionIds: questions.map(q => q.questionId),
      // ユーザー情報も保存しておく（フォールバック用）
      userId: user.id,
      userNickname: user.nickname,
      // cleanupOldData関数用のタイムスタンプ
      savedAt: new Date().toISOString(),
      // デバッグ用の追加情報
      category: session.category,
      mode: session.mode
    };
    
    // 問題データは別のキーに保存（結果表示用）
    const questionsKey = `tempMockQuestions_${user.nickname}`;
    const questionsData = {
      questions,
      savedAt: new Date().toISOString() // タイムスタンプを追加
    };
    safeLocalStorage.setItem(questionsKey, questionsData);
    
    // LocalStorageに一時保存（複数のキーで保存して確実性を高める）
    const tempKey = `tempMockResult_${user.nickname}`;
    const tempKeyById = `tempMockResult_${user.id}`;
    const globalKey = 'tempMockResult_latest';
    
    console.log('Current user:', user);
    console.log('Saving to keys:', { tempKey, tempKeyById, globalKey });
    console.log('mockResult:', mockResult);
    
    try {
      // 保存前に古い一時データを削除
      const keysToClean = Object.keys(localStorage).filter(k => 
        (k.startsWith('tempMockResult_') || k.startsWith('tempMockQuestions_')) && 
        k !== tempKey && 
        k !== tempKeyById && 
        k !== globalKey &&
        k !== questionsKey &&
        k !== `tempMockQuestions_${user.id}` &&
        k !== 'tempMockQuestions_latest'
      );
      keysToClean.forEach(k => localStorage.removeItem(k));
      console.log(`Cleaned ${keysToClean.length} old temp mock results`);
      
      // 複数のキーで保存（結果と問題を分離）
      let savedSuccessfully = false;
      const saveOperations = [
        { key: tempKey, data: mockResult, description: 'Main result' },
        { key: tempKeyById, data: mockResult, description: 'Backup result by ID' },
        { key: globalKey, data: mockResult, description: 'Global result' },
        { key: questionsKey, data: questionsData, description: 'Main questions' },
        { key: `tempMockQuestions_${user.id}`, data: questionsData, description: 'Backup questions by ID' },
        { key: 'tempMockQuestions_latest', data: questionsData, description: 'Global questions' }
      ];
      
      const finalStorageCheck = safeLocalStorage.getStorageInfo();
      console.log('Storage before save attempt:', `${(finalStorageCheck.used/1024/1024).toFixed(2)}MB / ${(finalStorageCheck.total/1024/1024).toFixed(2)}MB (${finalStorageCheck.percentage}%)`);
      
      for (const operation of saveOperations) {
        try {
          console.log(`Attempting to save: ${operation.description} (${operation.key})`);
          const dataSize = new Blob([JSON.stringify(operation.data)]).size;
          console.log(`  Data size: ${(dataSize/1024).toFixed(2)}KB`);
          
          safeLocalStorage.setItem(operation.key, operation.data);
          console.log(`✓ Saved: ${operation.description} (${operation.key})`);
          if (!savedSuccessfully) savedSuccessfully = true; // 少なくとも1つ成功
        } catch (saveError) {
          console.error(`✗ Failed to save: ${operation.description} (${operation.key})`, saveError);
          
          // さらに詳細なエラー情報
          if (saveError instanceof Error) {
            console.error(`Error name: ${saveError.name}`);
            console.error(`Error message: ${saveError.message}`);
            console.error(`Error stack:`, saveError.stack);
          }
          
          // ストレージ状況を再確認
          const errorTimeStorage = safeLocalStorage.getStorageInfo();
          console.error(`Storage at error time: ${(errorTimeStorage.used/1024/1024).toFixed(2)}MB / ${(errorTimeStorage.total/1024/1024).toFixed(2)}MB (${errorTimeStorage.percentage}%)`);
          
          // 最初の保存が失敗した場合、ユーザーにエラーを通知
          if (operation.key === tempKey) {
            const errorMessage = saveError instanceof Error ? saveError.message : '不明なエラー';
            alert(`Mock試験結果の保存に失敗しました。\n\nエラー: ${errorMessage}\n\nストレージ使用量: ${errorTimeStorage.percentage}%\n\nStorageCleanupボタンでデータを削除してから再試行してください。`);
            return; // 保存を中止
          }
        }
      }
      
      if (!savedSuccessfully) {
        console.error('All save operations failed');
        alert('Mock試験結果の保存に完全に失敗しました。ページを再読み込みして再試行してください。');
        return;
      }
      
      console.log('Save operations completed');
      
      // 確認のため再度読み込んでみる
      const savedResult = safeLocalStorage.getItem(tempKey);
      const savedQuestionsData = safeLocalStorage.getItem<any>(questionsKey);
      
      // 新形式と旧形式の両方に対応した確認
      let savedQuestions = null;
      if (savedQuestionsData) {
        if (Array.isArray(savedQuestionsData)) {
          savedQuestions = savedQuestionsData;
        } else if (savedQuestionsData.questions) {
          savedQuestions = savedQuestionsData.questions;
        }
      }
      
      console.log('Verification - saved result:', !!savedResult);
      console.log('Verification - saved questions:', !!savedQuestions, `(${savedQuestions?.length || 0} items)`);
      
      if (!savedResult) {
        console.error('Main result verification failed!');
        alert('Mock試験結果の保存確認に失敗しました。');
        return;
      }
      
      // 保存された進捗をクリア
      const progressKey = `mockExamProgress_${user.nickname}`;
      safeLocalStorage.removeItem(progressKey);
      
      // セッションをクリア
      if (sessionPersistence.current) {
        sessionPersistence.current.clearSession(user?.nickname);
      }
      
      // 結果画面へ遷移（保存が確実に完了してから）
      console.log('Navigating to /study/mock-result');
      
      setTimeout(() => {
        router.push('/study/mock-result');
      }, 100);
    } catch (error) {
      console.error('Failed to save mock result:', error);
      alert('結果の保存に失敗しました。再度お試しください。');
    }
  };

  const handleSaveAndExit = () => {
    if (!isMockMode || !session) {
      router.push('/study');
      return;
    }
    
    // Mock試験の進捗を保存
    const mockProgress = {
      session: {
        ...session,
        currentQuestionIndex,
        savedAt: new Date().toISOString()
      },
      mockAnswers: Array.from(mockAnswers.entries()),
      questions
    };
    const progressKey = `mockExamProgress_${user?.nickname}`;
    safeLocalStorage.setItem(progressKey, mockProgress);
    
    // 学習画面に戻る
    router.push('/study');
  };

  const completeSession = () => {
    console.log('completeSession called', { session, isMockMode });
    if (session) {
      // Mock試験の場合は別の処理
      if (isMockMode) {
        // 確認画面を表示するだけで、ここでは何もしない
        return;
      }
      
      // 保存用のセッションデータを作成（questionsを除外）
      const { questions: _, ...sessionWithoutQuestions } = session;
      const sessionToSave: any = {
        ...sessionWithoutQuestions,
        completedAt: new Date().toISOString(),
        questionIds: session.questions.map(q => q.questionId)
      };
      
      // Save session to history
      try {
        const userProgressKey = getUserKey('userProgress', user?.nickname);
        const progress: UserProgress | null = safeLocalStorage.getItem(userProgressKey);
        if (progress) {
          if (!progress.studySessions) progress.studySessions = [];
          
          // 最新50セッションのみ保持
          progress.studySessions.push(sessionToSave);
          if (progress.studySessions.length > 50) {
            progress.studySessions = progress.studySessions.slice(-50);
          }
          
          safeLocalStorage.setItem(userProgressKey, progress);
        }
      } catch (error) {
        console.error('Failed to save session:', error);
        // セッション保存に失敗しても継続
      } finally {
        // エラーが発生してもセッションを終了して完了画面へ遷移
        console.log('Setting sessionEnded to true');
        setSessionEnded(true);
      }
      
      // セッションをクリア
      if (sessionPersistence.current) {
        sessionPersistence.current.clearSession(user?.nickname);
      }
    }
  };

  const handleTimeUp = () => {
    alert("制限時間に達しました。試験を終了します。");
    if (isMockMode) {
      handleMockExamComplete();
    } else {
      completeSession();
    }
  };

  const toggleJapanese = () => {
    setShowJapanese(!showJapanese);
    // Save preference
    try {
      const userProgressKey = getUserKey('userProgress', user?.nickname);
      const progress: UserProgress | null = safeLocalStorage.getItem(userProgressKey);
      if (progress) {
        if (!progress.preferences) {
          progress.preferences = {
            showJapaneseInStudy: true,
            showJapaneseInMock: false,
            autoReviewIncorrect: true,
            notificationEnabled: false
          };
        }
        if (mode === "mock25" || mode === "mock75") {
          progress.preferences.showJapaneseInMock = !showJapanese;
        } else {
          progress.preferences.showJapaneseInStudy = !showJapanese;
        }
        safeLocalStorage.setItem(userProgressKey, progress);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
      // 設定の保存に失敗しても継続
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center max-w-md">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-400">問題を読み込んでいます...</p>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-gray-500">
              カテゴリ: {categoryParam || "選択中..."}
            </p>
            <p className="text-sm text-gray-500">
              モード: {mode === "mock25" ? "Mock試験 (25問)" : mode === "mock75" ? "Mock試験 (75問)" : mode === "category" ? "カテゴリ学習" : mode === "review" ? "復習モード" : mode}
            </p>
          </div>
          <div className="mt-8">
            <p className="text-xs text-gray-600">
              読み込みに時間がかかる場合は、インターネット接続を確認してください
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-300 mb-2">問題が見つかりませんでした</p>
          <p className="text-gray-400">カテゴリ: {categoryParam || "未指定"}</p>
          <p className="text-gray-400">モード: {mode || "未指定"}</p>
          <Link href="/study" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">
            学習モードに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">完了画面へ移動中...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Screen Reader Announcer (非表示) */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {screenReaderMessage}
      </div>
      {/* Error Alert */}
      {isError && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <ErrorAlert 
            error={error!} 
            onClose={clearError}
            onRetry={() => {
              clearError();
              loadQuestions();
            }}
          />
        </div>
      )}

      {/* Exit Confirmation Dialog for Mock Exam */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">試験を中断しますか？</h3>
            <p className="text-gray-300 mb-6">
              現在の進捗は保存されます。後で続きから再開できます。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  handleSaveAndExit();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                保存して終了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Dialog for Mock Exam */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">試験を終了しますか？</h3>
            <p className="text-gray-300 mb-2">
              全{questions.length}問中{mockAnswers.size}問回答済み
            </p>
            {mockAnswers.size < questions.length && (
              <p className="text-orange-400 mb-4 text-sm">
                まだ{questions.length - mockAnswers.size}問が未回答です
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600"
              >
                問題に戻る
              </button>
              <button
                onClick={() => {
                  setShowCompleteConfirm(false);
                  handleMockExamComplete();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                試験を終了
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Overcome Message */}
      {showOvercomeMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-lg shadow-xl flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">おめでとうございます！</p>
              <p className="text-sm opacity-90">この問題を克服しました</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10" role="banner">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                // すべてのモードで確認ダイアログを表示（誤操作防止）
                if (session?.answers && session.answers.length > 0) {
                  // 回答済みの問題がある場合は確認
                  const confirmMessage = isMockMode
                    ? 'Mock試験を終了しますか？\n進捗は保存されます。'
                    : `学習セッションを終了しますか？\n${session.answers.length}問回答済み（自動保存済み）`;
                  
                  if (window.confirm(confirmMessage)) {
                    // セッションを即座に保存
                    if (sessionPersistence.current) {
                      sessionPersistence.current.saveImmediately(saveSessionState);
                    }
                    
                    if (isMockMode) {
                      setShowExitConfirm(true);
                    } else {
                      router.push('/study');
                    }
                  }
                } else {
                  // まだ回答していない場合はそのまま戻る
                  router.push('/study');
                }
              }}
              className="text-gray-400 hover:text-gray-100 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="学習画面に戻る"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              {isMockMode ? '保存して終了' : '学習モードに戻る'}
            </button>
            <div className="flex items-center gap-4">
              {/* 保存中インジケーター */}
              {isSaving && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-600 text-white animate-pulse">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">保存中...</span>
                </div>
              )}
              
              {/* 最終保存時刻 */}
              {!isSaving && lastSaveTime && (
                <span className="text-xs text-gray-400">
                  最終保存: {new Date(lastSaveTime).toLocaleTimeString()}
                </span>
              )}
              
              <button
                onClick={toggleJapanese}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={`日本語表示を${showJapanese ? '無効' : '有効'}にする`}
                aria-pressed={showJapanese}
              >
                <Languages className="w-4 h-4" aria-hidden="true" />
                {showJapanese ? "日本語ON" : "日本語OFF"}
              </button>
              <span className="text-sm text-gray-300">
                問題 {currentQuestionIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {isMockMode ? `${mockAnswers.size} 問回答済み` : `${session?.answers.filter(a => a.isCorrect).length || 0} 正解`}
                </span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div 
            className="mt-4 w-full bg-gray-700 rounded-full h-2" 
            role="progressbar" 
            aria-valuenow={Math.round(progress)} 
            aria-valuemin={0} 
            aria-valuemax={100} 
            aria-label="学習進捗"
          >
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl" role="main">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <section className="lg:col-span-3" aria-label="問題エリア">
            <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700" ref={mainContentRef} tabIndex={-1}>
              {/* Category Badge */}
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-sm border border-indigo-700">
                  {currentQuestion.category}
                  {session?.mockPart && ` - Part ${session.mockPart}`}
                  {/* Mock試験復習時の追加情報 */}
                  {mode === 'review' && (() => {
                    // UserProgressを取得
                    const userProgressKey = getUserKey('userProgress', user?.nickname);
                    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
                    const incorrectQuestion = userProgress?.incorrectQuestions?.find(
                      q => q.questionId === currentQuestion.questionId
                    );
                    if (incorrectQuestion?.source === 'mock' && incorrectQuestion?.mockNumber) {
                      // グローバルIDから問題番号を抽出（例: REG-M1-015 → 15）
                      const match = currentQuestion.questionId.match(/M(\d+)-(\d+)$/);
                      const questionNum = match ? parseInt(match[2]) : null;
                      return ` - Mock ${incorrectQuestion.mockNumber}${questionNum ? ` 問題${questionNum}` : ''}`;
                    }
                    return '';
                  })()}
                </span>
              </div>

              {/* Question */}
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2 text-gray-100" id="question-text" tabIndex={-1}>
                  {currentQuestion.question}
                </h2>
                {showJapanese && currentQuestion.questionJa && (
                  <p className="text-gray-400 mt-2">
                    {currentQuestion.questionJa || "（翻訳準備中）"}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-6" role="radiogroup" aria-labelledby="question-text" aria-required="true">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option.letter;
                  const isKeyboardSelected = keyboardSelectedOption === option.letter;
                  const isCorrect = option.letter === currentQuestion.correctAnswer;
                  const showCorrect = showResult && isCorrect;
                  const showIncorrect = showResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={option.letter}
                      data-cy={`option-${option.letter}`}
                      onClick={() => handleAnswerSelect(option.letter)}
                      disabled={showResult}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`選択肢 ${option.letter}: ${option.text}`}
                      tabIndex={showResult ? -1 : 0}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        showCorrect
                          ? 'border-green-500 bg-green-900/30'
                          : showIncorrect
                          ? 'border-red-500 bg-red-900/30'
                          : isSelected
                          ? 'border-indigo-500 bg-indigo-900/30'
                          : isKeyboardSelected
                          ? 'border-blue-500 bg-blue-900/30 ring-2 ring-blue-400 ring-opacity-50'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`font-bold ${
                          showCorrect ? 'text-green-400' : showIncorrect ? 'text-red-400' : 'text-gray-300'
                        }`}>
                          {option.letter}.
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-100">{option.text}</p>
                          {showJapanese && option.textJa && (
                            <p className="text-gray-400 text-sm mt-1">
                              {option.textJa || "（翻訳準備中）"}
                            </p>
                          )}
                        </div>
                        {showCorrect && <Check className="w-5 h-5 text-green-400 mt-0.5" aria-hidden="true" />}
                        {showIncorrect && <X className="w-5 h-5 text-red-400 mt-0.5" aria-hidden="true" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (shown after answer) */}
              {showResult && (
                <div className="mb-6">
                  <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700" role="region" aria-label="解説">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <h3 className="font-medium text-blue-300 mb-1">解説</h3>
                        <p className="text-blue-100">{currentQuestion.explanation}</p>
                        {showJapanese && currentQuestion.explanationJa && (
                          <p className="text-blue-200 text-sm mt-2">
                            {currentQuestion.explanationJa || "（翻訳準備中）"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 教材で確認ボタン */}
                  <button
                    onClick={handleCheckInMaterials}
                    disabled={extractingKeywords}
                    aria-label="教材で詳しく確認する"
                    className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      extractingKeywords
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" aria-hidden="true" />
                    {extractingKeywords ? 'キーワードを抽出中...' : '教材で詳しく確認'}
                  </button>
                  {/* RAG検索ステータス表示 */}
                  {ragStatus && (
                    <div className="mt-2 p-2 bg-gray-700 rounded text-sm text-center text-gray-300">
                      {ragStatus}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  aria-label="前の問題に戻る"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    currentQuestionIndex === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-gray-100 hover:bg-gray-600'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  前の問題
                </button>

                {!showResult ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedAnswer}
                    aria-label={isMockMode ? '回答を記録する' : '回答を送信する'}
                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      selectedAnswer
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isMockMode 
                      ? currentQuestionIndex === questions.length - 1 
                        ? '試験を終了' 
                        : '回答を記録'
                      : '回答する'
                    }
                    <kbd className="text-xs px-1.5 py-0.5 bg-black/20 rounded border border-white/20">Enter</kbd>
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    aria-label={currentQuestionIndex === questions.length - 1 ? '結果を表示する' : '次の問題へ進む'}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {currentQuestionIndex === questions.length - 1 ? '結果を見る' : '次の問題'}
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="lg:col-span-1" aria-label="学習情報">
            {/* Timer for Mock exams */}
            {isMockMode && session?.timeLimit && (
              <div className="mb-6 flex items-center justify-between">
                <StudyTimer
                  timeLimit={session.timeLimit}
                  onTimeUp={handleTimeUp}
                />
                <SaveStatusIndicator 
                  hasUnsavedChanges={hasUnsavedChanges}
                  lastSaveTime={lastSaveTime}
                />
              </div>
            )}

            {/* Mock試験の問題ナビゲーション */}
            {isMockMode && (
              <nav className="bg-gray-800 rounded-lg p-4 border border-gray-700" aria-label="問題一覧">
                <h3 className="text-sm font-medium text-gray-300 mb-3">問題一覧</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((question, index) => {
                    const isAnswered = mockAnswers.has(question.questionId);
                    const isCurrent = index === currentQuestionIndex;
                    
                    return (
                      <button
                        key={question.questionId}
                        onClick={() => setCurrentQuestionIndex(index)}
                        aria-label={`問題 ${index + 1}${isAnswered ? ' (回答済み)' : ''}${isCurrent ? ' (現在の問題)' : ''}`}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`
                          p-2 text-sm rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500
                          ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isAnswered
                              ? 'bg-green-900/50 text-green-400 border border-green-700'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }
                        `}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-green-900/50 border border-green-700 rounded"></div>
                    <span>回答済み</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 bg-indigo-600 rounded"></div>
                    <span>現在の問題</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                    <span>進捗</span>
                    <span className="font-medium text-gray-300">
                      {mockAnswers.size} / {questions.length} 問回答済み
                    </span>
                  </div>
                </div>
              </nav>
            )}

          </aside>
        </div>
      </main>
      
      {/* キーボードヘルプモーダル */}
      <KeyboardHelpModal 
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        isMockMode={isMockMode}
      />
      
      {/* キーボードショートカットヒント（画面右下） */}
      {!showKeyboardHelp && (
        <div className="fixed bottom-4 right-4 p-3 bg-gray-800 rounded-lg shadow-lg border border-gray-700 text-xs text-gray-400" role="complementary" aria-label="キーボードショートカット">
          <div className="flex items-center gap-2">
            <span>キーボードヘルプ:</span>
            <kbd className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-gray-200" aria-label="問題符キー">?</kbd>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudySessionPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">Loading...</div>}>
        <StudySessionContent />
      </Suspense>
    </ProtectedRoute>
  );
}