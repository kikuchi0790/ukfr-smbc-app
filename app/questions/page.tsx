"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertCircle,
  BookOpen
} from "lucide-react";
import { Question, Category, UserProgress } from "@/types";
import { fetchJSON } from "@/utils/fetch-utils";
import { safeLocalStorage, getUserKey } from "@/utils/storage-utils";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { filterByCategory, searchQuestions, filterByQuery } from "@/utils/question-filters";
import { getAccurateQuestionStatus, debugProgress } from "@/utils/progress-tracker";

function QuestionsListContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "unanswered" | "correct" | "incorrect" | "overcome">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  const categories: { value: Category | "all"; label: string }[] = [
    { value: "all", label: "すべてのカテゴリ" },
    { value: "The Regulatory Environment", label: "The Regulatory Environment" },
    { value: "The Financial Services and Markets Act 2000 and Financial Services Act 2012", label: "Financial Services Acts" },
    { value: "Associated Legislation and Regulation", label: "Associated Legislation" },
    { value: "The FCA Conduct of Business Sourcebook/Client Assets", label: "FCA Conduct/Client Assets" },
    { value: "Complaints and Redress", label: "Complaints and Redress" },
    { value: "Regulations: Final Study Questions", label: "Final Study Questions" }
  ];

  // カテゴリごとの問題数を計算
  const getCategoryCount = (categoryValue: Category | "all") => {
    if (categoryValue === "all") return questions.length;
    return questions.filter(q => q.category === categoryValue).length;
  };

  // ステータスごとの問題数を計算
  const getStatusCount = (status: "all" | "unanswered" | "correct" | "incorrect" | "overcome") => {
    if (!progress || status === "all") return questions.length;
    
    return questions.filter(q => {
      const questionStatus = getQuestionStatus(q.questionId);
      
      if (status === "unanswered") {
        return !questionStatus;
      } else if (status === "overcome") {
        return questionStatus?.overcome;
      } else if (status === "correct") {
        return questionStatus?.correct && !questionStatus?.overcome;
      } else if (status === "incorrect") {
        return questionStatus?.answered && !questionStatus?.correct;
      }
      return true;
    }).length;
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    loadProgress();
    // デバッグ用: コンソールで debugProgress() を実行可能
    if (user) {
      console.log('💡 Tip: Run debugProgress() in console to check progress data');
    }
  }, [user]);

  useEffect(() => {
    filterQuestions();
  }, [selectedCategory, selectedStatus, searchTerm, questions, progress]);

  const loadQuestions = async () => {
    // Add a loading timeout
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      alert('問題の読み込みがタイムアウトしました。ページを更新してください。');
    }, 30000); // 30 seconds timeout
    
    try {
      console.log('Loading questions list...');
      const allQuestions = await fetchJSON<Question[]>('/data/all-questions.json');
      // Mock試験を除外
      const studyQuestions = allQuestions.filter(q => !q.category.includes("Mock"));
      setQuestions(studyQuestions);
      setFilteredQuestions(studyQuestions);
      clearTimeout(loadingTimeout);
    } catch (error) {
      clearTimeout(loadingTimeout);
      console.error('Failed to load questions:', error);
      
      // Show specific error messages
      if (!navigator.onLine) {
        alert('インターネット接続がありません。接続を確認してください。');
      } else {
        alert('問題の読み込みに失敗しました。ページを更新してください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = () => {
    if (!user) return;
    const userProgressKey = getUserKey('userProgress', user.nickname);
    const userProgress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    setProgress(userProgress);
  };

  const filterQuestions = () => {
    let filtered = questions;

    // カテゴリフィルター
    if (selectedCategory !== "all") {
      filtered = filterByCategory(filtered, selectedCategory as Category);
    }

    // ステータスフィルター
    if (selectedStatus !== "all" && progress) {
      filtered = filtered.filter(q => {
        const status = getQuestionStatus(q.questionId);
        
        if (selectedStatus === "unanswered") {
          return !status;
        } else if (selectedStatus === "overcome") {
          return status?.overcome;
        } else if (selectedStatus === "correct") {
          return status?.correct && !status?.overcome;
        } else if (selectedStatus === "incorrect") {
          return status?.answered && !status?.correct;
        }
        return true;
      });
    }

    // 検索フィルター
    if (searchTerm) {
      filtered = searchQuestions(
        filtered,
        [searchTerm],
        ['question', 'explanation']
      );
    }

    setFilteredQuestions(filtered);
  };

  const getQuestionStatus = (questionId: string) => {
    if (!progress) return null;
    
    // 新しい正確なステータス取得関数を使用
    const status = getAccurateQuestionStatus(questionId, progress);
    
    // 旧形式との互換性のため、null または オブジェクトを返す
    if (!status.answered) return null;
    
    return {
      answered: status.answered,
      correct: status.correct,
      overcome: status.overcome
    };
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-400">問題を読み込んでいます...</p>
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              問題リストを準備中です...
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-100">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-100">問題リスト</h1>
              <p className="text-gray-400">カテゴリ別の問題一覧</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                カテゴリ
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as Category | "all")}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ colorScheme: 'dark' }}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({getCategoryCount(cat.value)}問)
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ステータス
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as "all" | "unanswered" | "correct" | "incorrect" | "overcome")}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all">すべて ({getStatusCount("all")}問)</option>
                <option value="unanswered">未学習 ({getStatusCount("unanswered")}問)</option>
                <option value="correct">正解済み ({getStatusCount("correct")}問)</option>
                <option value="incorrect">不正解 ({getStatusCount("incorrect")}問)</option>
                <option value="overcome">克服済み ({getStatusCount("overcome")}問)</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                検索
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="問題文や解説を検索..."
                  style={{ colorScheme: 'dark' }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-gray-400">
            {filteredQuestions.length}問が見つかりました
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((question) => {
            const status = getQuestionStatus(question.questionId);
            const isExpanded = expandedQuestion === question.questionId;

            return (
              <div key={question.questionId} className="bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-700">
                <button
                  onClick={() => toggleQuestion(question.questionId)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-indigo-900/30 text-indigo-400 rounded">
                          {question.category}
                        </span>
                        {status ? (
                          <div className="flex items-center gap-2">
                            {status.overcome ? (
                              <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                克服済み
                              </span>
                            ) : status.correct ? (
                              <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                正解済み
                              </span>
                            ) : status.answered ? (
                              <span className="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded flex items-center gap-1">
                                <X className="w-3 h-3" />
                                不正解
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded">
                            未学習
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-100">
                        Q{question.id}. {question.question}
                      </h3>
                      {question.questionJa && (
                        <p className="text-sm text-gray-400 mt-1">
                          {question.questionJa}
                        </p>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-gray-700">
                    {/* Options */}
                    <div className="mt-4 space-y-2">
                      {question.options.map((option) => {
                        const isCorrect = option.letter === question.correctAnswer;
                        return (
                          <div
                            key={option.letter}
                            className={`p-3 rounded-lg ${
                              isCorrect ? 'bg-green-900/20 border border-green-800' : 'bg-gray-700'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`font-medium ${isCorrect ? 'text-green-400' : 'text-gray-300'}`}>
                                {option.letter}.
                              </span>
                              <div className="flex-1">
                                <p className={isCorrect ? 'text-green-400' : 'text-gray-300'}>
                                  {option.text}
                                </p>
                                {option.textJa && (
                                  <p className={`text-sm mt-1 ${isCorrect ? 'text-green-400' : 'text-gray-400'}`}>
                                    {option.textJa}
                                  </p>
                                )}
                              </div>
                              {isCorrect && <Check className="w-5 h-5 text-green-400 flex-shrink-0" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <div className="mt-4 p-4 bg-blue-900/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-300 mb-1">解説</p>
                          <p className="text-blue-200">{question.explanation}</p>
                          {question.explanationJa && (
                            <p className="text-blue-300 text-sm mt-2">
                              {question.explanationJa}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Study Button */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => router.push(`/study/session?mode=category&category=${encodeURIComponent(question.category)}&questionId=${question.questionId}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        この問題を学習
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No results */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">該当する問題が見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuestionsListPage() {
  return (
    <ProtectedRoute>
      <QuestionsListContent />
    </ProtectedRoute>
  );
}