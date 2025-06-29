'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { safeLocalStorage, getUserKey } from '@/utils/storage-utils';
import { Question, StudySession, Answer } from '@/types';
import { searchQuestions } from '@/utils/question-filters';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  BookOpen,
  Languages
} from 'lucide-react';
import Link from 'next/link';

interface MockExamData {
  session: StudySession;
  questions: Question[];
  score: number;
  categoryResults: any[];
  examRecord: any;
}

function MockReviewContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [examData, setExamData] = useState<MockExamData | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showJapanese, setShowJapanese] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 最新のMock試験データを読み込む
    const latestMockKey = getUserKey('latestMockExam');
    const data = safeLocalStorage.getItem<MockExamData>(latestMockKey);
    
    if (!data) {
      router.push('/study');
      return;
    }

    setExamData(data);
    setLoading(false);
  }, [router]);

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const getFilteredQuestions = () => {
    if (!examData) return [];
    
    const { questions, session } = examData;
    
    // 最初にフィルターモードで絞り込み
    let filteredQuestions = questions.filter((question, index) => {
      const answer = session.answers[index];
      if (!answer) return false;

      // フィルターモードによる絞り込み
      if (filterMode === 'correct' && !answer.isCorrect) return false;
      if (filterMode === 'incorrect' && answer.isCorrect) return false;

      return true;
    });

    // 検索クエリがある場合は、question-filtersのsearchQuestionsを使用
    if (searchQuery) {
      filteredQuestions = searchQuestions(
        filteredQuestions,
        [searchQuery],
        ['question', 'explanation', 'options']
      );
    }

    return filteredQuestions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!examData) {
    return null;
  }

  const { questions, session } = examData;
  const filteredQuestions = getFilteredQuestions();
  const correctCount = session.answers.filter(a => a.isCorrect).length;
  const incorrectCount = session.answers.length - correctCount;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/study/mock-result" className="text-gray-400 hover:text-gray-100">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Mock試験 詳細</h1>
                <p className="text-gray-400">
                  {session.category} - スコア: {examData.score}%
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowJapanese(!showJapanese)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showJapanese
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Languages className="w-5 h-5" />
              日本語 {showJapanese ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters and Stats */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                すべて ({questions.length})
              </button>
              <button
                onClick={() => setFilterMode('correct')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  filterMode === 'correct'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                正解 ({correctCount})
              </button>
              <button
                onClick={() => setFilterMode('incorrect')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  filterMode === 'incorrect'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <XCircle className="w-4 h-4" />
                不正解 ({incorrectCount})
              </button>
            </div>

            <div className="relative w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="問題を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-80 pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((question, index) => {
            const answer = session.answers[questions.indexOf(question)];
            const isExpanded = expandedQuestions.has(question.questionId);
            const originalIndex = questions.indexOf(question);

            return (
              <div
                key={question.questionId}
                className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() => toggleQuestion(question.questionId)}
                  className="w-full p-4 text-left hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          問題 {originalIndex + 1}
                        </span>
                        {answer.isCorrect ? (
                          <span className="flex items-center gap-1 text-green-400 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            正解
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-sm">
                            <XCircle className="w-4 h-4" />
                            不正解
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {question.category}
                        </span>
                      </div>
                      <p className="text-gray-100 font-medium">
                        {question.question}
                      </p>
                      {showJapanese && question.questionJa && (
                        <p className="text-gray-400 text-sm mt-1">
                          {question.questionJa}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    {/* Options */}
                    <div className="space-y-2">
                      {question.options.map((option) => {
                        const isCorrect = option.letter === question.correctAnswer;
                        const isSelected = option.letter === answer.selectedAnswer;

                        return (
                          <div
                            key={option.letter}
                            className={`p-3 rounded-lg border ${
                              isCorrect
                                ? 'border-green-500 bg-green-900/30'
                                : isSelected
                                ? 'border-red-500 bg-red-900/30'
                                : 'border-gray-600 bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`font-bold ${
                                isCorrect
                                  ? 'text-green-400'
                                  : isSelected
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                              }`}>
                                {option.letter}.
                              </span>
                              <div className="flex-1">
                                <p className="text-gray-100">{option.text}</p>
                                {showJapanese && option.textJa && (
                                  <p className="text-gray-400 text-sm mt-1">
                                    {option.textJa}
                                  </p>
                                )}
                              </div>
                              {isCorrect && (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              )}
                              {isSelected && !isCorrect && (
                                <XCircle className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Your Answer */}
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-sm text-gray-400 mb-1">あなたの回答</p>
                      <p className={`font-medium ${
                        answer.isCorrect ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {answer.selectedAnswer}. {
                          question.options.find(o => o.letter === answer.selectedAnswer)?.text
                        }
                      </p>
                    </div>

                    {/* Explanation */}
                    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                      <div className="flex items-start gap-2">
                        <BookOpen className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-300 mb-1">解説</p>
                          <p className="text-blue-100">{question.explanation}</p>
                          {showJapanese && question.explanationJa && (
                            <p className="text-blue-200 text-sm mt-2">
                              {question.explanationJa}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">該当する問題が見つかりません</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MockReviewPage() {
  return (
    <ProtectedRoute>
      <MockReviewContent />
    </ProtectedRoute>
  );
}