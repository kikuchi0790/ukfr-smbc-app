"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Trophy,
  TrendingUp,
  Target,
  Clock,
  Award,
  ChevronRight,
  Home,
  RefreshCw
} from "lucide-react";
import { UserProgress } from "@/types";
import { safeLocalStorage, getUserKey } from "@/utils/storage-utils";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { formatElapsedTime, formatPercentage } from "@/utils/formatters";

function StudyCompletePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessionStats, setSessionStats] = useState<{
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    timeSpent: string;
    mode?: string;
    category?: string;
    mockPart?: number;
  } | null>(null);

  useEffect(() => {
    // Get the latest session stats
    const userProgressKey = getUserKey('userProgress', user?.nickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (progress) {
      const latestSession = progress.studySessions[progress.studySessions.length - 1];
      
      if (latestSession) {
        const correctAnswers = latestSession.answers.filter(a => a.isCorrect).length;
        const totalQuestions = latestSession.answers.length;
        const accuracy = totalQuestions > 0 ? parseFloat(formatPercentage(correctAnswers, totalQuestions)) : 0;
        
        // Calculate time spent
        const startTime = new Date(latestSession.startedAt);
        const endTime = new Date(latestSession.completedAt || new Date());
        const diffSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const timeSpent = formatElapsedTime(diffSeconds);
        
        setSessionStats({
          totalQuestions,
          correctAnswers,
          accuracy,
          timeSpent,
          mode: latestSession.mode,
          category: latestSession.category,
          mockPart: latestSession.mockPart
        });
      }
    }
  }, [user]);

  const getPerformanceMessage = (accuracy: number) => {
    if (accuracy >= 90) return { message: "素晴らしい！", color: "text-green-400" };
    if (accuracy >= 80) return { message: "とても良い！", color: "text-blue-400" };
    if (accuracy >= 70) return { message: "合格ライン達成！", color: "text-indigo-400" };
    if (accuracy >= 60) return { message: "もう少しで合格！", color: "text-yellow-400" };
    return { message: "復習が必要です", color: "text-orange-400" };
  };

  if (!sessionStats) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">Loading...</div>;
  }

  const performance = getPerformanceMessage(sessionStats.accuracy);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-2xl w-full border border-gray-700">
        {/* Trophy Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-900/30 p-6 rounded-full border border-yellow-700">
            <Trophy className="w-16 h-16 text-yellow-400" />
          </div>
        </div>

        {/* Completion Message */}
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-100">学習セッション完了！</h1>
        {sessionStats.mode === "mock25" && sessionStats.mockPart && (
          <p className="text-lg text-center text-gray-400 mb-2">
            {sessionStats.category} - Part {sessionStats.mockPart}
          </p>
        )}
        <p className={`text-xl text-center mb-8 ${performance.color}`}>
          {performance.message}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600">
            <div className="flex justify-center mb-2">
              <Target className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-gray-400 text-sm">回答数</p>
            <p className="text-2xl font-bold text-gray-100">{sessionStats.totalQuestions}問</p>
          </div>

          <div className="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600">
            <div className="flex justify-center mb-2">
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-400 text-sm">正解数</p>
            <p className="text-2xl font-bold text-gray-100">{sessionStats.correctAnswers}問</p>
          </div>

          <div className="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600">
            <div className="flex justify-center mb-2">
              <Award className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-gray-400 text-sm">正答率</p>
            <p className="text-2xl font-bold text-gray-100">{sessionStats.accuracy}%</p>
          </div>

          <div className="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600">
            <div className="flex justify-center mb-2">
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-gray-400 text-sm">学習時間</p>
            <p className="text-2xl font-bold text-gray-100">{sessionStats.timeSpent}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">合格ライン</span>
            <span className="text-sm font-medium text-gray-300">70%</span>
          </div>
          <div className="relative w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${sessionStats.accuracy}%` }}
            />
            <div className="absolute top-0 left-[70%] w-0.5 h-3 bg-gray-500" />
          </div>
        </div>

        {/* Feedback Message */}
        <div className="bg-blue-900/30 p-4 rounded-lg mb-8 border border-blue-700">
          <p className="text-blue-300">
            {sessionStats.accuracy >= 70 
              ? "合格ラインを達成しました！この調子で学習を続けましょう。"
              : "もう少しで合格ラインです。間違えた問題を復習して、再挑戦しましょう。"
            }
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link 
            href="/dashboard"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            ダッシュボードに戻る
          </Link>

          <Link 
            href="/study"
            className="w-full bg-gray-700 text-gray-100 py-3 rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 border border-gray-600"
          >
            <RefreshCw className="w-5 h-5" />
            別のモードで学習
          </Link>

          <button
            onClick={() => router.back()}
            className="w-full border-2 border-gray-600 text-gray-100 py-3 rounded-lg hover:border-gray-500 flex items-center justify-center gap-2"
          >
            同じモードで再挑戦
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudyCompletePage() {
  return (
    <ProtectedRoute>
      <StudyCompletePageContent />
    </ProtectedRoute>
  );
}