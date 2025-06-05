"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  GraduationCap,
  Clock,
  Target,
  BookOpen,
  Zap,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  FileText,
  Timer,
  RefreshCw
} from "lucide-react";
import { Category, UserProgress, CategoryStudyMode } from "@/types";
import { safeLocalStorage, getUserKey } from "@/utils/storage-utils";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { progressSync } from "@/services/progress-sync";

function StudyModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const categoryRef = useRef<HTMLDivElement>(null);
  const mockRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedMockMode, setSelectedMockMode] = useState<"mock25" | "mock75" | null>(null);
  const [selectedMockCategory, setSelectedMockCategory] = useState<Category | null>(null);
  const [selectedPart, setSelectedPart] = useState<1 | 2 | 3 | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [categoryStudyMode, setCategoryStudyMode] = useState<CategoryStudyMode>("random");
  const [hasSavedMockProgress, setHasSavedMockProgress] = useState(false);
  const [savedMockCategory, setSavedMockCategory] = useState<string | null>(null);
  const [savedMockMode, setSavedMockMode] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInput, setResetInput] = useState("");

  // Function to refresh progress data
  const refreshProgress = () => {
    if (!user) return;
    
    const userProgressKey = getUserKey('userProgress', user.nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    console.log('Refreshing progress:', userProgress);
    setProgress(userProgress);
  };

  useEffect(() => {
    // Only load progress when user is available
    if (!user) {
      console.log('User not available yet, skipping progress load');
      return;
    }

    // Load user progress
    const userProgressKey = getUserKey('userProgress', user.nickname);
    console.log('Loading progress with key:', userProgressKey);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    console.log('Loaded user progress:', userProgress);
    setProgress(userProgress);
    if (userProgress?.preferences?.categoryStudyMode) {
      setCategoryStudyMode(userProgress.preferences.categoryStudyMode);
    }

    // Check for saved Mock exam progress
    const progressKey = `mockExamProgress_${user.nickname}`;
    const savedMockProgress = safeLocalStorage.getItem<any>(progressKey);
    if (savedMockProgress) {
      setHasSavedMockProgress(true);
      setSavedMockCategory(savedMockProgress.session.category);
      setSavedMockMode(savedMockProgress.session.mode);
    }

    // Handle query parameters
    const mode = searchParams.get('mode');
    const selected = searchParams.get('selected');
    
    if (mode === 'category') {
      if (categoryRef.current) {
        // Scroll to category section
        categoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Auto-select category if provided
      if (selected) {
        setSelectedCategory(decodeURIComponent(selected) as Category);
      }
    } else if (mode === 'mock' && mockRef.current) {
      // Scroll to mock section
      mockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, user]);

  // Refresh progress when page gains focus (user returns from study session)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Page gained focus, refreshing progress');
      refreshProgress();
    };

    window.addEventListener('focus', handleFocus);
    
    // Also refresh on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing progress');
        refreshProgress();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = progressSync.addListener(() => {
      console.log('Progress updated, refreshing');
      refreshProgress();
    });

    return unsubscribe;
  }, [user]);

  const categories: { name: Category; questions: number; isMock: boolean; nameJa?: string }[] = [
    { name: "The Regulatory Environment", questions: 42, isMock: false, nameJa: "規制環境" },
    { name: "The Financial Services and Markets Act 2000 and Financial Services Act 2012", questions: 99, isMock: false, nameJa: "金融サービス市場法" },
    { name: "Associated Legislation and Regulation", questions: 100, isMock: false, nameJa: "関連法規制" },
    { name: "The FCA Conduct of Business Sourcebook/Client Assets", questions: 125, isMock: false, nameJa: "FCA行動規範・顧客資産" },
    { name: "Complaints and Redress", questions: 32, isMock: false, nameJa: "苦情と救済" },
    { name: "Regulations: Mock 1", questions: 75, isMock: true },
    { name: "Regulations: Mock 2", questions: 75, isMock: true },
    { name: "Regulations: Mock 3", questions: 75, isMock: true },
    { name: "Regulations: Mock 4", questions: 75, isMock: true },
    { name: "Regulations: Mock 5", questions: 75, isMock: true },
    { name: "Regulations: Final Study Questions", questions: 62, isMock: false, nameJa: "最終学習問題" }
  ];

  const studyCategories = categories.filter(c => !c.isMock);
  const mockCategories = categories.filter(c => c.isMock);

  // カテゴリごとの色設定（ダークテーマ用のグラデーション）
  const categoryColors: Record<string, { gradient: string; border: string; selected: string; shadow: string }> = {
    "The Regulatory Environment": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-blue-500 bg-gradient-to-br from-blue-900/50 to-blue-800/50",
      shadow: "hover:shadow-lg hover:shadow-blue-900/20"
    },
    "The Financial Services and Markets Act 2000 and Financial Services Act 2012": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-purple-500 bg-gradient-to-br from-purple-900/50 to-purple-800/50",
      shadow: "hover:shadow-lg hover:shadow-purple-900/20"
    },
    "Associated Legislation and Regulation": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-emerald-500 bg-gradient-to-br from-emerald-900/50 to-emerald-800/50",
      shadow: "hover:shadow-lg hover:shadow-emerald-900/20"
    },
    "The FCA Conduct of Business Sourcebook/Client Assets": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-amber-500 bg-gradient-to-br from-amber-900/50 to-amber-800/50",
      shadow: "hover:shadow-lg hover:shadow-amber-900/20"
    },
    "Complaints and Redress": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-rose-500 bg-gradient-to-br from-rose-900/50 to-rose-800/50",
      shadow: "hover:shadow-lg hover:shadow-rose-900/20"
    },
    "Regulations: Final Study Questions": { 
      gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
      border: "border-gray-700", 
      selected: "border-indigo-500 bg-gradient-to-br from-indigo-900/50 to-indigo-800/50",
      shadow: "hover:shadow-lg hover:shadow-indigo-900/20"
    }
  };

  const getCategoryProgress = (categoryName: Category) => {
    if (!progress || !progress.categoryProgress) return { correct: 0, answered: 0, total: 0, percentage: 0 };
    
    const categoryProgress = progress.categoryProgress[categoryName];
    if (!categoryProgress) return { correct: 0, answered: 0, total: 0, percentage: 0 };
    
    const correct = categoryProgress.correctAnswers || 0;
    const answered = categoryProgress.answeredQuestions || 0;
    const total = categoryProgress.totalQuestions || 0;
    // Calculate percentage based on correct answers for buildings progress
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    return { correct, answered, total, percentage };
  };

  const handleStartCategoryStudy = () => {
    if (selectedCategory && user) {
      // 設定を保存
      const userProgressKey = getUserKey('userProgress', user.nickname);
      const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      if (userProgress) {
        if (!userProgress.preferences) {
          userProgress.preferences = {
            showJapaneseInStudy: true,
            showJapaneseInMock: false,
            autoReviewIncorrect: true,
            notificationEnabled: false
          };
        }
        userProgress.preferences.categoryStudyMode = categoryStudyMode;
        safeLocalStorage.setItem(userProgressKey, userProgress);
      }
      
      router.push(`/study/session?mode=category&category=${encodeURIComponent(selectedCategory)}&studyMode=${categoryStudyMode}`);
    }
  };

  const handleStartMock = () => {
    if (selectedMockMode && selectedMockCategory) {
      let url = `/study/session?mode=${selectedMockMode}&category=${encodeURIComponent(selectedMockCategory)}`;
      if (selectedMockMode === "mock25" && selectedPart) {
        url += `&part=${selectedPart}`;
      }
      router.push(url);
    }
  };

  const handleReviewIncorrect = () => {
    router.push('/study/session?mode=review');
  };

  const handleMockCategorySelect = (category: Category) => {
    setSelectedMockCategory(category);
    // 75問モードの場合はパート選択不要
    if (selectedMockMode === "mock75") {
      setSelectedPart(null);
    }
  };

  const handleReset = () => {
    if (resetInput === "reset history") {
      if (!user) return;
      
      // Reset all category progress
      const userProgressKey = getUserKey('userProgress', user.nickname);
      const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      
      if (userProgress) {
        // Reset all category progress to 0
        Object.keys(userProgress.categoryProgress).forEach(category => {
          userProgress.categoryProgress[category as Category].answeredQuestions = 0;
          userProgress.categoryProgress[category as Category].correctAnswers = 0;
        });
        
        // Reset overall stats
        userProgress.totalQuestionsAnswered = 0;
        userProgress.correctAnswers = 0;
        userProgress.studySessions = [];
        userProgress.incorrectQuestions = [];
        userProgress.overcomeQuestions = [];
        userProgress.currentStreak = 0;
        userProgress.bestStreak = 0;
        userProgress.lastStudyDate = "";
        
        // Save the reset progress
        safeLocalStorage.setItem(userProgressKey, userProgress);
        
        // Also reset answered questions tracker
        const answeredQuestionsKey = `answeredQuestions_${user.nickname}`;
        safeLocalStorage.removeItem(answeredQuestionsKey);
        
        // Reload progress
        setProgress(userProgress);
        
        // Close modal and reset input
        setShowResetModal(false);
        setResetInput("");
        
        alert("学習履歴がリセットされました。");
      }
    } else {
      alert("「reset history」と入力してください。");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-100 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">
                学習モードを選択
              </h1>
              <p className="text-gray-400">効率的な学習で確実な合格を目指しましょう</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Saved Mock Progress Alert */}
        {hasSavedMockProgress && (
          <div className="mb-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-blue-200 font-medium">前回のMock試験を続けますか？</p>
                <p className="text-blue-300 text-sm">{savedMockCategory} - {savedMockMode === 'mock25' ? '25問' : '75問'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  router.push(`/study/session?mode=${savedMockMode}&category=${encodeURIComponent(savedMockCategory!)}`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                続ける
              </button>
              <button
                onClick={() => {
                  if (user) {
                    const progressKey = `mockExamProgress_${user.nickname}`;
                    safeLocalStorage.removeItem(progressKey);
                    setHasSavedMockProgress(false);
                  }
                }}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600"
              >
                破棄
              </button>
            </div>
          </div>
        )}

        {/* Category Study Section */}
        <div ref={categoryRef} className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center justify-between text-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-gray-100">
                カテゴリ別学習
              </span>
              <span className="text-sm font-normal text-gray-500">10問ランダム出題</span>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 flex items-center gap-2 text-sm font-normal transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              リセット
            </button>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studyCategories.map((category) => {
              const categoryProgress = getCategoryProgress(category.name);
              const colors = categoryColors[category.name] || { 
                gradient: "bg-gradient-to-br from-gray-800 to-gray-900", 
                border: "border-gray-700", 
                selected: "border-gray-500 bg-gradient-to-br from-gray-800 to-gray-700",
                shadow: "hover:shadow-lg hover:shadow-gray-900/20"
              };
              
              return (
                <div
                  key={category.name}
                  className={`p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border text-left relative overflow-hidden group ${
                    selectedCategory === category.name
                      ? colors.selected
                      : `${colors.gradient} ${colors.border} ${colors.shadow}`
                  }`}
                >
                  <button
                    onClick={() => setSelectedCategory(category.name)}
                    className="w-full text-left"
                  >
                    <h3 className="font-bold mb-1 text-gray-100 group-hover:text-white transition-colors">
                      {category.name}
                    </h3>
                    {category.nameJa && (
                      <p className="text-sm text-gray-400 mb-2">{category.nameJa}</p>
                    )}
                    <p className="text-gray-400 text-sm mb-3">全{category.questions}問から10問出題</p>
                    
                    {/* Progress bar */}
                    <div className="rounded-lg p-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-400 font-medium">進捗</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-gray-300 font-bold">
                            正解数: {categoryProgress.correct} / {categoryProgress.total} 問
                          </span>
                          <span className="text-xs text-gray-400">
                            回答済: {categoryProgress.answered} / {categoryProgress.total} 問
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 relative ${
                            categoryProgress.percentage === 100 
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' 
                              : categoryProgress.percentage >= 70 
                              ? 'bg-gradient-to-r from-blue-400 to-blue-500' 
                              : categoryProgress.percentage >= 30 
                              ? 'bg-gradient-to-r from-indigo-400 to-indigo-500' 
                              : 'bg-gradient-to-r from-gray-500 to-gray-600'
                          }`}
                          style={{ width: `${categoryProgress.percentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="text-right mt-1">
                        <span className="text-xs font-bold text-gray-300">{categoryProgress.percentage}%</span>
                      </div>
                    </div>
                  </button>
                  
                  {/* Study mode toggle and start button - shown when selected */}
                  {selectedCategory === category.name && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      {/* Study mode toggle */}
                      <div className="flex gap-2 p-1 bg-gray-800 rounded-lg shadow-sm">
                        <button
                          onClick={() => setCategoryStudyMode("random")}
                          className={`flex-1 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium transform ${
                            categoryStudyMode === "random"
                              ? "bg-gray-700 text-gray-100 shadow-sm scale-[1.02]"
                              : "text-gray-400 hover:text-gray-100 hover:bg-gray-700"
                          }`}
                        >
                          ランダム出題
                        </button>
                        <button
                          onClick={() => setCategoryStudyMode("sequential")}
                          className={`flex-1 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium transform ${
                            categoryStudyMode === "sequential"
                              ? "bg-gray-700 text-gray-100 shadow-sm scale-[1.02]"
                              : "text-gray-400 hover:text-gray-100 hover:bg-gray-700"
                          }`}
                        >
                          順番に出題
                        </button>
                      </div>
                      
                      {/* Start button */}
                      <button
                        onClick={handleStartCategoryStudy}
                        className="group w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 font-medium text-sm transform hover:scale-[1.02]"
                      >
                        学習を開始する 
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mock Exam Section */}
        <div ref={mockRef} className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-100">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-sm">
              <Timer className="w-6 h-6 text-white" />
            </div>
            <span className="text-gray-100">
              Mock試験
            </span>
            <span className="text-sm font-normal text-gray-500">実践形式</span>
          </h2>
          
          {/* Mock Mode Selection */}
          <div className="mb-6 flex gap-4 justify-center">
            <button
              onClick={() => {
                setSelectedMockMode("mock25");
                setSelectedPart(null);
              }}
              className={`px-6 py-3 rounded-lg border-2 transition-all ${
                selectedMockMode === "mock25"
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-medium">25問モード（30分）</span>
              </div>
            </button>
            <button
              onClick={() => {
                setSelectedMockMode("mock75");
                setSelectedPart(null);
              }}
              className={`px-6 py-3 rounded-lg border-2 transition-all ${
                selectedMockMode === "mock75"
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-medium">75問モード（90分）</span>
              </div>
            </button>
          </div>

          {selectedMockMode && (
            <>
              {/* Mock Category Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {mockCategories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => handleMockCategorySelect(category.name)}
                    className={`bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-all border-2 ${
                      selectedMockCategory === category.name
                        ? 'border-emerald-500 bg-emerald-900/30'
                        : 'border-gray-700 hover:border-emerald-700'
                    }`}
                  >
                    <h3 className="font-bold mb-2 text-gray-100">{category.name}</h3>
                    <p className="text-gray-400 text-sm mb-3">
                      {selectedMockMode === "mock25" ? "3パート各25問" : "75問一括"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <FileText className="w-4 h-4" />
                      <span>試験形式で実施</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Part Selection for 25-question mode */}
              {selectedMockMode === "mock25" && selectedMockCategory && (
                <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                  <h3 className="font-bold mb-4 text-gray-100">パートを選択してください</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((part) => (
                      <button
                        key={part}
                        onClick={() => setSelectedPart(part as 1 | 2 | 3)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedPart === part
                            ? 'border-emerald-500 bg-emerald-900/30 text-gray-100'
                            : 'border-gray-700 hover:border-gray-600 text-gray-300'
                        }`}
                      >
                        <h4 className="font-bold mb-1">Part {part}</h4>
                        <p className="text-sm text-gray-400">
                          問題 {(part - 1) * 25 + 1}〜{part * 25}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Button */}
              {selectedMockCategory && (selectedMockMode === "mock75" || selectedPart) && (
                <div className="flex justify-center">
                  <button
                    onClick={handleStartMock}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    Mock試験を開始する <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Review Incorrect Questions */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-100">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-sm">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
            <span className="text-gray-100">
              復習モード
            </span>
          </h2>
          <button
            onClick={handleReviewIncorrect}
            className="w-full max-w-md mx-auto block bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-700 hover:border-orange-700 group"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="font-bold mb-2 text-gray-100 group-hover:text-white">間違えた問題を復習</h3>
                <p className="text-gray-400 text-sm">過去に間違えた問題から10問出題</p>
              </div>
              <div className="bg-gradient-to-br from-orange-400 to-orange-500 p-3 rounded-full shadow-sm group-hover:shadow-md transition-all">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </button>
        </div>

      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-gray-100">学習履歴をリセット</h3>
            <p className="text-gray-400 mb-4">
              すべてのカテゴリの学習履歴がリセットされます。この操作は取り消せません。
            </p>
            <p className="text-gray-300 mb-4">
              続行するには「<span className="font-mono text-red-400">reset history</span>」と入力してください：
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              placeholder="ここに入力"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetInput("");
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyModePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">Loading...</div>}>
        <StudyModeContent />
      </Suspense>
    </ProtectedRoute>
  );
}