"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { Question, StudySession, Answer, UserProgress, StudyMode, Category, CategoryProgress } from "@/types";
import StudyTimer from "@/components/StudyTimer";
import ErrorAlert from "@/components/ErrorAlert";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { fetchJSON } from "@/utils/fetch-utils";
import { safeLocalStorage } from "@/utils/storage-utils";
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
import { getCategoryInfo } from "@/utils/category-utils";
import { AnsweredQuestionsTracker, validateAndFixProgress } from "@/utils/progress-validator";

function StudySessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") as StudyMode;
  const categoryParam = searchParams.get("category") ? decodeURIComponent(searchParams.get("category")!) : null;
  const partParam = searchParams.get("part");
  const studyModeParam = searchParams.get("studyMode") as "random" | "sequential" | null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJapanese, setShowJapanese] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showOvercomeMessage, setShowOvercomeMessage] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const { error, isError, clearError, handleError, withErrorHandling } = useErrorHandler();

  useEffect(() => {
    loadQuestions();
  }, [mode, categoryParam]);

  const loadQuestions = withErrorHandling(async () => {
    setLoading(true);
    
    try {
      let questionSet: Question[] = [];
      let timeLimit: number | undefined;
      
      // Load all questions first
      const allQuestions = await fetchJSON<Question[]>('/data/all-questions.json');

      const savedProgress = safeLocalStorage.getItem<UserProgress>('userProgress');
      const progress: UserProgress = savedProgress || {
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        categoryProgress: {} as Record<Category, CategoryProgress>,
        studySessions: [],
        incorrectQuestions: [],
        overcomeQuestions: [],
        currentStreak: 0,
        lastStudyDate: new Date().toISOString(),
        preferences: {
          showJapaneseInStudy: true,
          showJapaneseInMock: false,
          autoReviewIncorrect: true,
          notificationEnabled: false
        }
      };

      if (mode === "category" && categoryParam) {
        // カテゴリ別学習：10問
        const categoryQuestions = allQuestions.filter(q => q.category === categoryParam);
        
        if (categoryQuestions.length === 0) {
          // カテゴリが見つからない場合のエラーメッセージ
          handleError(new Error(`カテゴリ「${categoryParam}」の問題が見つかりませんでした。`));
          return;
        }
        
        // 順番に出題するか、ランダムに出題するか
        if (studyModeParam === "sequential") {
          const answeredIds = getAnsweredQuestionIds(categoryParam);
          questionSet = getSequentialQuestionsForCategory(
            categoryQuestions,
            answeredIds,
            10
          );
        } else {
          questionSet = getRandomQuestionsForCategory(
            categoryQuestions,
            progress?.incorrectQuestions || [],
            10
          );
        }
        
        setShowJapanese(progress?.preferences?.showJapaneseInStudy ?? true);
      } else if (mode === "review") {
        // 復習モード：間違えた問題から10問
        questionSet = getReviewQuestions(allQuestions, 10);
        if (questionSet.length === 0) {
          alert("復習する問題がありません。まずは学習を始めてください。");
          router.push('/study');
          return;
        }
        setShowJapanese(progress?.preferences?.showJapaneseInStudy ?? true);
      } else if (mode === "mock25" || mode === "mock75") {
        // Mock試験モード
        const categoryQuestions = allQuestions.filter(q => q.category === categoryParam);
        const part = partParam ? parseInt(partParam) as 1 | 2 | 3 : undefined;
        questionSet = getMockQuestions(categoryQuestions, mode, part);
        timeLimit = mode === "mock25" ? 30 : 90;
        setShowJapanese(progress?.preferences?.showJapaneseInMock ?? false);
      }

      setQuestions(questionSet);
      
      // Initialize session
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
    } catch (error) {
      console.error('Failed to load questions:', error);
      if (!categoryParam) {
        handleError(error, 'カテゴリが指定されていません');
      } else {
        handleError(error, '問題の読み込みに失敗しました');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, '問題データの読み込みに失敗しました。ネットワーク接続を確認してください。');

  const handleAnswerSelect = (answer: string) => {
    if (!showResult) {
      setSelectedAnswer(answer);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !session || !questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
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
    
    // Update user progress
    updateUserProgress(isCorrect, currentQuestion);
    
    // Save incorrect question if wrong
    if (!isCorrect) {
      saveIncorrectQuestion(currentQuestion.questionId, currentQuestion.category);
    }
    
    // Update review count if in review mode
    if (mode === "review") {
      updateReviewCount(currentQuestion.questionId);
      
      // 復習モードで正解した場合、克服フォルダに移動
      if (isCorrect) {
        const moved = moveToOvercomeQuestions(currentQuestion.questionId, mode);
        if (moved) {
          setShowOvercomeMessage(true);
          // 3秒後にメッセージを非表示
          setTimeout(() => setShowOvercomeMessage(false), 3000);
        }
      }
    }
    
    setShowResult(true);
  };

  const updateUserProgress = (isCorrect: boolean, question: Question) => {
    try {
      let progress: UserProgress | null = safeLocalStorage.getItem('userProgress');
      
      if (progress) {
        // 進捗データの検証と修正
        progress = validateAndFixProgress(progress);
        
        // Check if this question was already answered in this session
        if (answeredQuestionIds.has(question.questionId)) {
          console.log('Question already answered in this session, skipping progress update');
          return;
        }
        
        // Track answered questions globally
        AnsweredQuestionsTracker.addAnsweredQuestion(question.category, question.questionId);
        
        // Add to answered questions for this session
        setAnsweredQuestionIds(prev => new Set(prev).add(question.questionId));
        
        progress.totalQuestionsAnswered++;
        if (isCorrect) progress.correctAnswers++;
        
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
            // Get actual answered count from tracker
            const actualAnsweredCount = AnsweredQuestionsTracker.getAnsweredCount(question.category);
            
            // Use the minimum of actual count and total questions to prevent overflow
            const newAnsweredCount = Math.min(actualAnsweredCount, categoryProgress.totalQuestions);
            
            // Only update if it's increasing (to prevent decreasing due to data issues)
            if (newAnsweredCount > categoryProgress.answeredQuestions) {
              categoryProgress.answeredQuestions = newAnsweredCount;
              if (isCorrect) categoryProgress.correctAnswers++;
            } else if (categoryProgress.answeredQuestions >= categoryProgress.totalQuestions) {
              console.warn(`Category ${question.category} already at 100% (${categoryProgress.answeredQuestions}/${categoryProgress.totalQuestions})`);
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
        
        safeLocalStorage.setItem('userProgress', progress);
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
      // 進捗の更新に失敗しても学習は継続
    }
  };

  const handleNextQuestion = () => {
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const is10thQuestion = (currentQuestionIndex + 1) % 10 === 0;
    
    if (mode === "category" && (is10thQuestion || isLastQuestion)) {
      // カテゴリ学習：10問ごとに結果表示
      completeSession();
    } else if (isLastQuestion) {
      // 最後の問題
      completeSession();
    } else {
      // 次の問題へ
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const completeSession = () => {
    if (session) {
      const completedSession = {
        ...session,
        completedAt: new Date().toISOString()
      };
      
      // Save session to history
      try {
        const progress: UserProgress | null = safeLocalStorage.getItem('userProgress');
        if (progress) {
          if (!progress.studySessions) progress.studySessions = [];
          progress.studySessions.push(completedSession);
          safeLocalStorage.setItem('userProgress', progress);
        }
      } catch (error) {
        console.error('Failed to save session:', error);
        // セッション保存に失敗しても継続
      }
      
      setSessionEnded(true);
    }
  };

  const handleTimeUp = () => {
    alert("制限時間に達しました。試験を終了します。");
    completeSession();
  };

  const toggleJapanese = () => {
    setShowJapanese(!showJapanese);
    // Save preference
    try {
      const progress: UserProgress | null = safeLocalStorage.getItem('userProgress');
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
        safeLocalStorage.setItem('userProgress', progress);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
      // 設定の保存に失敗しても継続
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-400">問題を読み込んでいます...</p>
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
    router.push('/study/complete');
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isMockMode = mode === "mock25" || mode === "mock75";

  return (
    <div className="min-h-screen bg-gray-900">
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
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/study')}
              className="text-gray-400 hover:text-gray-100 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              学習モードに戻る
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleJapanese}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-100"
              >
                <Languages className="w-4 h-4" />
                {showJapanese ? "日本語ON" : "日本語OFF"}
              </button>
              <span className="text-sm text-gray-300">
                問題 {currentQuestionIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {session?.answers.filter(a => a.isCorrect).length || 0} 正解
                </span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700">
              {/* Category Badge */}
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-sm border border-indigo-700">
                  {currentQuestion.category}
                  {session?.mockPart && ` - Part ${session.mockPart}`}
                </span>
              </div>

              {/* Question */}
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2 text-gray-100">
                  {currentQuestion.question}
                </h2>
                {showJapanese && currentQuestion.questionJa && (
                  <p className="text-gray-400 mt-2">
                    {currentQuestion.questionJa || "（翻訳準備中）"}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option.letter;
                  const isCorrect = option.letter === currentQuestion.correctAnswer;
                  const showCorrect = showResult && isCorrect;
                  const showIncorrect = showResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={option.letter}
                      onClick={() => handleAnswerSelect(option.letter)}
                      disabled={showResult}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        showCorrect
                          ? 'border-green-500 bg-green-900/30'
                          : showIncorrect
                          ? 'border-red-500 bg-red-900/30'
                          : isSelected
                          ? 'border-indigo-500 bg-indigo-900/30'
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
                        {showCorrect && <Check className="w-5 h-5 text-green-400 mt-0.5" />}
                        {showIncorrect && <X className="w-5 h-5 text-red-400 mt-0.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (shown after answer) */}
              {showResult && (
                <div className="mb-6 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-300 mb-1">解説</p>
                      <p className="text-blue-100">{currentQuestion.explanation}</p>
                      {showJapanese && currentQuestion.explanationJa && (
                        <p className="text-blue-200 text-sm mt-2">
                          {currentQuestion.explanationJa || "（翻訳準備中）"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    currentQuestionIndex === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-gray-100 hover:bg-gray-600'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                  前の問題
                </button>

                {!showResult ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedAnswer}
                    className={`px-6 py-2 rounded-lg font-medium ${
                      selectedAnswer
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    回答する
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    {currentQuestionIndex === questions.length - 1 ? '結果を見る' : '次の問題'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Timer for Mock exams */}
            {isMockMode && session?.timeLimit && (
              <div className="mb-6">
                <StudyTimer
                  timeLimit={session.timeLimit}
                  onTimeUp={handleTimeUp}
                />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudySessionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">Loading...</div>}>
      <StudySessionContent />
    </Suspense>
  );
}