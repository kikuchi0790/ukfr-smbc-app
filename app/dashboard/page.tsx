"use client";

import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  TrendingUp, 
  Clock, 
  Target, 
  Award,
  BookOpen,
  BarChart3,
  Calendar,
  ChevronRight,
  AlertCircle,
  Check,
  List,
  ArrowLeft,
  FileText,
  Trophy,
  Cloud,
  CloudOff,
  Book,
  Highlighter
} from "lucide-react";
import { UserProgress, Category, MockCategoryProgress } from "@/types";
import { safeLocalStorage, getUserKey } from "@/utils/storage-utils";
import FirebaseStatusNotice from "@/components/FirebaseStatusNotice";
import ErrorAlert from "@/components/ErrorAlert";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import WireframeBuildings from "@/components/WireframeBuildings";
import dynamic from 'next/dynamic';
import { categories } from "@/utils/category-utils";
import { validateAndFixProgress, getDisplayCorrectCount, cleanupAllProgressData } from "@/utils/progress-tracker";
import { isMockCategory, getMockCategoryProgress } from "@/utils/study-utils";
import { formatPercentage } from "@/utils/formatters";
import { checkDataIntegrity } from "@/utils/data-backup";
import { AnsweredQuestionsTracker } from "@/utils/answered-questions-tracker";
import { ReviewDataRepairTool } from "@/utils/review-data-repair";

// Dynamic import for 3D components to avoid SSR issues
const WireframeBuildings3D = dynamic(
  () => import('@/components/WireframeBuildings3D'),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg p-6 h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-gray-400">3Dビューを読み込んでいます...</p>
        </div>
      </div>
    )
  }
);


const BackgroundBuildings = dynamic(
  () => import('@/components/BackgroundBuildings'),
  { ssr: false }
);

const BackgroundCityscape = () => (
  <div 
    className="fixed inset-0 w-full h-full z-0"
    style={{
      backgroundImage: 'url(/collective_architectural_vision.jpeg)',
      backgroundSize: 'contain', // アスペクト比を保持して全体を表示
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#0a0a0a' // 画像の外側の背景色
    }}
  >
    {/* オーバーレイで暗くして文字を読みやすくする */}
    <div className="absolute inset-0 bg-gray-900/50"></div>
  </div>
);

function DashboardContent() {
  const { user, isFirebaseAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [show3D, setShow3D] = useState(true);
  const [mockExamHistory, setMockExamHistory] = useState<any[]>([]);
  const [debugMode, setDebugMode] = useState(false);
  const [dataIntegrityReport, setDataIntegrityReport] = useState<any>(null);
  const { error, isError, clearError, handleError } = useErrorHandler();


  useEffect(() => {
    // Clean up progress data on first load
    cleanupAllProgressData();
    
    // 復習データの修復を実行
    if (user?.nickname) {
      const repairResult = ReviewDataRepairTool.repairUserReviewData(user.nickname);
      if (repairResult.success && repairResult.changes && repairResult.changes.length > 0) {
        console.log('復習データを修復しました:', repairResult.changes);
      }
    }
    
    loadUserProgress();
    loadMockExamHistory();
  }, [user]);
  
  useEffect(() => {
    // デバッグモードのチェック
    const debug = searchParams.get('debug') === 'true';
    setDebugMode(debug);
    
    // デバッグモードの場合、データ整合性チェックを実行
    if (debug && progress) {
      const answeredQuestionsKey = getUserKey('answeredQuestions', user?.nickname);
      const answeredQuestions = safeLocalStorage.getItem<Record<Category, string[]>>(answeredQuestionsKey) || {} as Record<Category, string[]>;
      const report = checkDataIntegrity(progress, answeredQuestions);
      setDataIntegrityReport(report);
      console.log('📊 Data Integrity Report:', report);
    }
  }, [searchParams, progress, user?.nickname]);

  const loadUserProgress = () => {
    try {
      setLoading(true);
      // Load user-specific progress from localStorage
      const userProgressKey = getUserKey('userProgress', user?.nickname);
      const parsedProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
      if (parsedProgress) {
        // 進捗データの検証と修正
        const validation = validateAndFixProgress(parsedProgress);
        setProgress(validation.fixed);
      } else {
      // Initialize new user progress
      console.log('Initializing new user progress for:', user?.nickname);
      const initialCategoryProgress: Partial<Record<Category, any>> = {};
      categories.forEach(category => {
        initialCategoryProgress[category.name] = {
          totalQuestions: category.totalQuestions,
          answeredQuestions: 0,
          correctAnswers: 0
        };
        console.log(`Initialized ${category.name}: 0 / ${category.totalQuestions}`);
      });

      const initialProgress: UserProgress = {
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        categoryProgress: initialCategoryProgress as Record<Category, any>,
        studySessions: [],
        incorrectQuestions: [],
        overcomeQuestions: [],
        currentStreak: 0,
        bestStreak: 0,
        lastStudyDate: "",
        preferences: {
          showJapaneseInStudy: true,
          showJapaneseInMock: false,
          autoReviewIncorrect: true,
          notificationEnabled: false
        }
      };
      
      // Ensure all categories start at 0
      console.log('Creating new user progress with all categories at 0%');
        setProgress(initialProgress);
        safeLocalStorage.setItem(userProgressKey, initialProgress);
      }
    } catch (error) {
      handleError(error, '学習進捗の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateAccuracy = () => {
    if (!progress || progress.totalQuestionsAnswered === 0) return 0;
    // 克服した問題を含めた正解数を使用
    const totalCorrect = getDisplayCorrectCount(progress);
    return parseFloat(formatPercentage(totalCorrect, progress.totalQuestionsAnswered));
  };

  const calculateOverallMockAccuracy = () => {
    if (!progress?.mockCategoryProgress) return 0;
    
    // Partial型なのでfilterでundefinedを除外
    const mockResults = Object.values(progress.mockCategoryProgress).filter(
      (result): result is MockCategoryProgress => result !== undefined && result !== null
    );
    if (mockResults.length === 0) return 0;
    
    // 受験済みのMock試験のみを対象にする
    const attemptedResults = mockResults.filter(result => result.attemptsCount > 0);
    if (attemptedResults.length === 0) return 0;
    
    const totalScore = attemptedResults.reduce((sum, result) => sum + result.latestScore, 0);
    return Math.round(totalScore / attemptedResults.length);
  };

  const calculatePassProbability = () => {
    const accuracy = calculateAccuracy();
    if (accuracy >= 70) return "高";
    if (accuracy >= 60) return "中";
    return "低";
  };

  const getStreakStatus = () => {
    if (!progress) return { message: "学習を始めましょう！", color: "text-gray-500" };
    if (progress.currentStreak === 0) return { message: "今日から始めましょう！", color: "text-gray-500" };
    if (progress.currentStreak < 3) return { message: `${progress.currentStreak}日連続！`, color: "text-orange-500" };
    if (progress.currentStreak < 7) return { message: `${progress.currentStreak}日連続！素晴らしい！`, color: "text-blue-500" };
    return { message: `${progress.currentStreak}日連続！すごい！`, color: "text-green-500" };
  };

  const getIncorrectQuestionsCount = () => {
    // 統合データ構造からすべての間違えた問題をカウント
    let count = progress?.incorrectQuestions?.length || 0;
    
    // 互換性のため、古いmockIncorrectQuestionsも確認
    if (progress?.mockIncorrectQuestions) {
      // 重複を避けるため、既存のincorrectQuestionsにないものだけカウント
      const existingIds = new Set(progress.incorrectQuestions?.map(q => q.questionId) || []);
      const uniqueMockCount = progress.mockIncorrectQuestions.filter(
        mq => !existingIds.has(mq.questionId)
      ).length;
      count += uniqueMockCount;
    }
    
    return count;
  };
  
  const getCategoryIncorrectCount = () => {
    // カテゴリ学習の間違いのみカウント
    return progress?.incorrectQuestions?.filter(q => q.source !== 'mock').length || 0;
  };
  
  const getMockIncorrectCount = () => {
    // Mock試験の間違いのみカウント
    const fromIncorrect = progress?.incorrectQuestions?.filter(q => q.source === 'mock').length || 0;
    
    // 互換性のため、古いmockIncorrectQuestionsも確認
    if (progress?.mockIncorrectQuestions && fromIncorrect === 0) {
      return progress.mockIncorrectQuestions.length;
    }
    
    return fromIncorrect;
  };

  const getOvercomeQuestionsCount = () => {
    return progress?.overcomeQuestions?.length || 0;
  };

  const loadMockExamHistory = () => {
    try {
      const historyKey = getUserKey('mockExamHistory', user?.nickname);
      const history = safeLocalStorage.getItem<any[]>(historyKey) || [];
      // 最新5件のみ表示
      setMockExamHistory(history.slice(-5).reverse());
    } catch (error) {
      console.error('Failed to load mock exam history:', error);
    }
  };

  const quickActions = [
    {
      title: "カテゴリ別学習",
      description: "各カテゴリから10問出題",
      icon: <Target className="w-6 h-6" />,
      href: "/study?mode=category",
      color: "bg-indigo-500"
    },
    {
      title: "Mock試験",
      description: "本番形式で実力チェック",
      icon: <Clock className="w-6 h-6" />,
      href: "/study?mode=mock",
      color: "bg-emerald-500"
    },
    {
      title: "間違えた問題を復習",
      description: (() => {
        const total = getIncorrectQuestionsCount();
        const category = getCategoryIncorrectCount();
        const mock = getMockIncorrectCount();
        
        if (total === 0) return "復習する問題がありません";
        if (category > 0 && mock > 0) {
          return `計${total}問（カテゴリ: ${category}問、Mock: ${mock}問）`;
        } else if (category > 0) {
          return `カテゴリ学習: ${category}問の復習が可能`;
        } else {
          return `Mock試験: ${mock}問の復習が可能`;
        }
      })(),
      icon: <AlertCircle className="w-6 h-6" />,
      href: "/study/session?mode=review&reviewType=all",
      color: "bg-orange-500",
      disabled: getIncorrectQuestionsCount() === 0
    },
    {
      title: "問題リスト",
      description: "カテゴリ別の問題一覧",
      icon: <List className="w-6 h-6" />,
      href: "/questions",
      color: "bg-purple-500"
    },
    {
      title: "教材ビュー",
      description: "PDFと和訳を並列表示",
      icon: <Book className="w-6 h-6" />,
      href: "/materials",
      color: "bg-blue-500"
    },
    {
      title: "ハイライト一覧",
      description: "保存したハイライトを確認",
      icon: <Highlighter className="w-6 h-6" />,
      href: "/highlights",
      color: "bg-pink-500"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-400">学習データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // 学習カテゴリとMockカテゴリを分離
  const studyCategories = categories.filter(c => !c.name.includes("Mock"));
  const mockCategories = categories.filter(c => c.name.includes("Mock"));

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Firebase状態通知 */}
      <FirebaseStatusNotice />
      
      {/* 都市景観背景 */}
      <BackgroundCityscape />
      
      {/* Content with relative positioning */}
      <div className="relative z-10">
        {/* Error Alert */}
        {isError && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <ErrorAlert 
              error={error!} 
              onClose={clearError}
              onRetry={() => {
                clearError();
                loadUserProgress();
              }}
            />
          </div>
        )}
        
        {/* Header with backdrop blur for better readability */}
        <header className="bg-gray-800/90 border-b border-gray-700 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-400 hover:text-gray-100">
                  <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-100">ダッシュボード</h1>
                  <p className="text-gray-400">こんにちは、{user?.nickname || "学習者"}さん！</p>
                </div>
                {/* クラウド同期ステータス */}
                <div className="ml-4 flex items-center gap-2">
                  {isFirebaseAuth ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <Cloud className="w-5 h-5" />
                      <span className="text-sm">クラウド同期中</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <CloudOff className="w-5 h-5" />
                      <span className="text-sm">ローカル保存</span>
                    </div>
                  )}
                </div>
              </div>
              <Link 
                href="/study" 
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                学習を始める <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          {/* Compact Stats Summary */}
          <div className="bg-gray-800/90 rounded-xl shadow-lg border border-gray-700 p-4 mb-6 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <BarChart3 className="w-5 h-5 text-indigo-600 mr-1" />
                <span className="text-xl font-bold text-gray-100">{progress.totalQuestionsAnswered}</span>
              </div>
              <p className="text-xs text-gray-400">回答済み</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <AlertCircle className="w-5 h-5 text-red-600 mr-1" />
                <span className="text-xl font-bold text-red-600">{getIncorrectQuestionsCount()}</span>
              </div>
              <p className="text-xs text-gray-400">要復習</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Check className="w-5 h-5 text-emerald-600 mr-1" />
                <span className="text-xl font-bold text-emerald-600">{getOvercomeQuestionsCount()}</span>
              </div>
              <p className="text-xs text-gray-400">克服済み</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <TrendingUp className="w-5 h-5 text-green-600 mr-1" />
                <span className="text-xl font-bold text-gray-100">{calculateAccuracy()}%</span>
              </div>
              <p className="text-xs text-gray-400">学習正答率</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Trophy className="w-5 h-5 text-yellow-600 mr-1" />
                <span className="text-xl font-bold text-yellow-400">{calculateOverallMockAccuracy()}%</span>
              </div>
              <p className="text-xs text-gray-400">Mock平均</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Award className="w-5 h-5 text-yellow-600 mr-1" />
                <span className="text-xl font-bold text-gray-100">{calculatePassProbability()}</span>
              </div>
              <p className="text-xs text-gray-400">合格可能性</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Calendar className="w-5 h-5 text-purple-600 mr-1" />
                <span className={`text-xl font-bold ${getStreakStatus().color}`}>
                  {progress.currentStreak}
                </span>
              </div>
              <p className="text-xs text-gray-400">連続学習</p>
            </div>
          </div>
        </div>

        {/* Wire Art Progress */}
        {progress && progress.categoryProgress && (
          <div className="mb-8">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShow3D(!show3D)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/90 backdrop-blur-sm hover:bg-gray-600 rounded-lg transition-colors text-gray-100"
              >
                <span className="text-lg">{show3D ? '🎨' : '🏗️'}</span>
                <span className="text-sm font-medium">{show3D ? '2D表示に切替' : '3D表示に切替'}</span>
              </button>
            </div>
            {show3D ? (
              <WireframeBuildings3D progress={progress.categoryProgress} />
            ) : (
              <WireframeBuildings progress={progress.categoryProgress} />
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-100">クイックアクション</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Link 
                key={index}
                href={action.disabled ? "#" : action.href}
                className={`bg-gray-800/90 backdrop-blur-sm border border-gray-700 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow ${
                  action.disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={(e) => action.disabled && e.preventDefault()}
              >
                <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mb-4`}>
                  {action.icon}
                </div>
                <h3 className="font-bold mb-2 text-gray-100">{action.title}</h3>
                <p className="text-gray-400 text-sm">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Category Progress */}
        <div className="space-y-6">
          {/* Study Categories */}
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-100">学習カテゴリー別進捗</h2>
            <div className="space-y-4">
              {studyCategories.map((category) => {
                const data = progress.categoryProgress[category.name];
                // 克服した問題を含めた正解数を取得
                const displayCorrectAnswers = getDisplayCorrectCount(progress, category.name);
                // 進捗率を正答数ベースに変更（克服問題を含む）
                const percentage = data.totalQuestions > 0 
                  ? Math.round((displayCorrectAnswers / data.totalQuestions) * 100)
                  : 0;
                const accuracy = data.answeredQuestions > 0
                  ? Math.round((displayCorrectAnswers / data.answeredQuestions) * 100)
                  : 0;

                return (
                  <div key={category.name} className="border-b pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm text-gray-200">{category.name}</h3>
                        {category.nameJa && (
                          <p className="text-xs text-gray-500">{category.nameJa}</p>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-400">
                          正解数: {displayCorrectAnswers}/{data.totalQuestions}問
                        </span>
                        <span className="text-gray-400">
                          回答済: {data.answeredQuestions}/{data.totalQuestions}問
                        </span>
                        <span className="text-gray-400">
                          正答率: {accuracy}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mock Categories */}
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-100">Mock試験進捗</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockCategories.map((category) => {
                const mockProgress = getMockCategoryProgress(category.name);
                
                return (
                  <div key={category.name} className="border border-gray-700 bg-gray-700/90 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="font-medium mb-3 text-gray-200">{category.name}</h3>
                    
                    {mockProgress ? (
                      <div className="space-y-3 text-sm">
                        {/* 受験回数 */}
                        <div className="flex justify-between">
                          <span className="text-gray-400">受験回数:</span>
                          <span className="text-gray-200 font-medium">{mockProgress.attemptsCount}回</span>
                        </div>
                        
                        {/* 最高得点 */}
                        <div className="flex justify-between">
                          <span className="text-gray-400">最高得点:</span>
                          <span className={`font-bold ${mockProgress.bestScore >= 70 ? 'text-green-400' : 'text-orange-400'}`}>
                            {mockProgress.bestScore}%
                            {mockProgress.bestScore >= 70 && <span className="ml-1 text-xs">合格</span>}
                          </span>
                        </div>
                        
                        {/* 最新得点 */}
                        <div className="flex justify-between">
                          <span className="text-gray-400">最新得点:</span>
                          <span className={`font-medium ${mockProgress.latestScore >= 70 ? 'text-green-400' : 'text-orange-400'}`}>
                            {mockProgress.latestScore}%
                          </span>
                        </div>
                        
                        {/* 合格率 */}
                        <div className="flex justify-between">
                          <span className="text-gray-400">合格率:</span>
                          <span className="text-gray-200">
                            {mockProgress.passedCount}/{mockProgress.attemptsCount}回
                            <span className="ml-1 text-xs text-gray-400">
                              ({Math.round((mockProgress.passedCount / mockProgress.attemptsCount) * 100)}%)
                            </span>
                          </span>
                        </div>
                        
                        {/* 平均得点 */}
                        <div className="flex justify-between">
                          <span className="text-gray-400">平均得点:</span>
                          <span className="text-gray-300">{mockProgress.averageScore}%</span>
                        </div>
                        
                        {/* Part別進捗（25問モードの場合） */}
                        {mockProgress.partProgress && Object.keys(mockProgress.partProgress).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <span className="text-xs text-gray-400 block mb-1">Part別進捗:</span>
                            <div className="flex gap-2">
                              {[1, 2, 3].map(part => {
                                const partData = mockProgress.partProgress?.[part];
                                return (
                                  <div 
                                    key={part} 
                                    className={`flex-1 text-center py-1 rounded text-xs ${
                                      partData 
                                        ? partData.score >= 70 
                                          ? 'bg-green-900/50 text-green-400' 
                                          : 'bg-orange-900/50 text-orange-400'
                                        : 'bg-gray-700 text-gray-500'
                                    }`}
                                  >
                                    <div className="font-bold">P{part}</div>
                                    {partData ? (
                                      <div>{partData.score}%</div>
                                    ) : (
                                      <div>-</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* 進捗インジケーター */}
                        <div className="mt-3 pt-2 border-t border-gray-600">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">習熟度</span>
                            <span className={`font-bold ${
                              mockProgress.bestScore >= 80 ? 'text-green-400' : 
                              mockProgress.bestScore >= 70 ? 'text-yellow-400' : 'text-orange-400'
                            }`}>
                              {mockProgress.bestScore >= 80 ? '優秀' : 
                               mockProgress.bestScore >= 70 ? '合格レベル' : '要学習'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-gray-400 text-sm mb-2">未受験</div>
                        <Link 
                          href={`/study?mode=mock&category=${encodeURIComponent(category.name)}`}
                          className="inline-block px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                        >
                          受験する
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mock試験履歴 */}
          {mockExamHistory.length > 0 && (
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-100 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                最近のMock試験結果
              </h2>
              <div className="space-y-3">
                {mockExamHistory.map((exam) => {
                  const date = new Date(exam.completedAt);
                  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                  
                  return (
                    <div key={exam.id} className="border border-gray-700 bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-200">
                            {exam.session.category}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {dateStr} • {exam.questionsCount}問
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            exam.passed ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {exam.score}%
                          </p>
                          <p className={`text-sm ${
                            exam.passed ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {exam.passed ? '合格' : '不合格'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link 
                href="/study?mode=mock"
                className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                <FileText className="w-5 h-5" />
                新しいMock試験を受ける
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* デバッグセクション */}
      {debugMode && (
        <div className="mt-8 bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            デバッグ情報
          </h3>
          
          {dataIntegrityReport && (
            <div className="mb-6">
              <h4 className="text-lg font-medium mb-2">データ整合性レポート</h4>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">
                  チェック日時: {new Date(dataIntegrityReport.timestamp).toLocaleString('ja-JP')}
                </p>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{dataIntegrityReport.summary.totalIssues}</p>
                    <p className="text-sm text-gray-400">総問題数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{dataIntegrityReport.summary.highSeverity}</p>
                    <p className="text-sm text-gray-400">高重要度</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">{dataIntegrityReport.summary.mediumSeverity}</p>
                    <p className="text-sm text-gray-400">中重要度</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">{dataIntegrityReport.summary.lowSeverity}</p>
                    <p className="text-sm text-gray-400">低重要度</p>
                  </div>
                </div>
                
                {dataIntegrityReport.issues.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium mb-2">詳細:</h5>
                    {dataIntegrityReport.issues.map((issue: any, index: number) => (
                      <div key={index} className={`p-2 rounded ${
                        issue.severity === 'high' ? 'bg-red-900/20' :
                        issue.severity === 'medium' ? 'bg-yellow-900/20' :
                        'bg-blue-900/20'
                      }`}>
                        <p className="text-sm">
                          <span className="font-medium">{issue.type}</span>
                          {issue.category && ` (${issue.category})`}: {issue.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).progressSync) {
                  (window as any).progressSync.sync(user?.nickname, 'use_higher').then((result: any) => {
                    alert(`同期完了: ${result.changes.filter((c: any) => c.action !== 'none').length}カテゴリが更新されました`);
                    loadUserProgress();
                  });
                } else {
                  console.error('progressSync is not available');
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              データ同期実行
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).progressSync) {
                  (window as any).progressSync.autoRepair(user?.nickname).then((success: boolean) => {
                    alert(success ? '自動修復が完了しました' : '自動修復に失敗しました');
                    loadUserProgress();
                  });
                } else {
                  console.error('progressSync is not available');
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              自動修復実行
            </button>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            <p>コンソールで以下のコマンドが使用可能:</p>
            <code className="block mt-1 bg-gray-800 p-2 rounded">dataBackup.debug()</code>
            <code className="block mt-1 bg-gray-800 p-2 rounded">dataMigration.check()</code>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}