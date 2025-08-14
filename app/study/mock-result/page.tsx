'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { safeLocalStorage, getUserKey } from '@/utils/storage-utils';
import { Question, StudySession, Answer, UserProgress } from '@/types';
import { saveIncorrectQuestion, updateMockExamProgress, isMockCategory } from '@/utils/study-utils';
import { formatElapsedTime, formatPercentage, formatTime } from '@/utils/formatters';
import { 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  ArrowLeft,
  FileText,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface MockResult {
  session: StudySession;
  questions: Question[];
  userId?: string;
  userNickname?: string;
}

interface CategoryResult {
  name: string;
  correct: number;
  total: number;
  percentage: number;
}

function MockResultContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [mockResult, setMockResult] = useState<MockResult | null>(null);
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証がまだ読み込み中の場合は何もしない
    if (authLoading) {
      console.log('Auth is still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.error('No user found after auth loaded');
      // 少し待ってから再度確認（認証情報の復元が遅れている可能性）
      const retryTimeout = setTimeout(() => {
        const storedAuth = localStorage.getItem('authUser');
        if (!storedAuth) {
          console.error('No auth data in localStorage');
          router.push('/login');
        } else {
          console.log('Auth data found but user not loaded, waiting...');
        }
      }, 500);
      return () => clearTimeout(retryTimeout);
    }
    
    // LocalStorageから一時保存されたMock試験結果を読み込む（ユーザー固有のキーを使用）
    const tempKey = `tempMockResult_${user.nickname}`;
    const questionsKey = `tempMockQuestions_${user.nickname}`;
    console.log('User:', user.nickname);
    console.log('Looking for key:', tempKey);
    const tempResult = safeLocalStorage.getItem<any>(tempKey);
    const tempQuestionsData = safeLocalStorage.getItem<any>(questionsKey);
    
    // 新形式（オブジェクト）と旧形式（配列）の両方に対応
    let tempQuestions: Question[] | null = null;
    if (tempQuestionsData) {
      if (Array.isArray(tempQuestionsData)) {
        // 旧形式：配列
        tempQuestions = tempQuestionsData;
      } else if (tempQuestionsData.questions) {
        // 新形式：オブジェクト with questions field
        tempQuestions = tempQuestionsData.questions;
      }
    }
    
    console.log('Found result:', tempResult);
    console.log('Found questions:', tempQuestions?.length);
    
    if (!tempResult) {
      console.error('No mock result found in localStorage with key:', tempKey);
      // デバッグ：すべてのキーを確認
      const allKeys = Object.keys(localStorage);
      console.log('All localStorage keys:', allKeys);
      console.log('Mock-related keys:', allKeys.filter(k => k.includes('Mock') || k.includes('mock')));
      
      // フォールバック1：userIdを使ったキーも試す
      const fallbackKey = `tempMockResult_${user.id}`;
      const fallbackQuestionsKey = `tempMockQuestions_${user.id}`;
      const fallbackResult = safeLocalStorage.getItem<any>(fallbackKey);
      const fallbackQuestionsData = safeLocalStorage.getItem<any>(fallbackQuestionsKey);
      
      // 新形式と旧形式の両方に対応
      let fallbackQuestions: Question[] | null = null;
      if (fallbackQuestionsData) {
        if (Array.isArray(fallbackQuestionsData)) {
          fallbackQuestions = fallbackQuestionsData;
        } else if (fallbackQuestionsData.questions) {
          fallbackQuestions = fallbackQuestionsData.questions;
        }
      }
      if (fallbackResult && (fallbackQuestions || fallbackResult.questions)) {
        console.log('Found result with fallback key:', fallbackKey);
        // Part情報をログ出力
        console.log('Mock Part:', fallbackResult.session?.mockPart);
        processResults({
          ...fallbackResult,
          questions: fallbackQuestions || fallbackResult.questions
        });
        safeLocalStorage.removeItem(fallbackKey);
        safeLocalStorage.removeItem(fallbackQuestionsKey);
        return;
      }
      
      // フォールバック2：グローバルキーも試す
      const globalKey = 'tempMockResult_latest';
      const globalQuestionsKey = 'tempMockQuestions_latest';
      const globalResult = safeLocalStorage.getItem<any>(globalKey);
      const globalQuestionsData = safeLocalStorage.getItem<any>(globalQuestionsKey);
      
      // 新形式と旧形式の両方に対応
      let globalQuestions: Question[] | null = null;
      if (globalQuestionsData) {
        if (Array.isArray(globalQuestionsData)) {
          globalQuestions = globalQuestionsData;
        } else if (globalQuestionsData.questions) {
          globalQuestions = globalQuestionsData.questions;
        }
      }
      if (globalResult) {
        console.log('Found result with global key:', globalKey);
        // ユーザー情報が一致するか確認
        if (globalResult.userNickname === user.nickname || globalResult.userId === user.id) {
          processResults({
            ...globalResult,
            questions: globalQuestions || globalResult.questions
          });
          safeLocalStorage.removeItem(globalKey);
          safeLocalStorage.removeItem(globalQuestionsKey);
          return;
        } else {
          console.warn('Global result found but user mismatch:', {
            expected: { nickname: user.nickname, id: user.id },
            found: { nickname: globalResult.userNickname, id: globalResult.userId }
          });
        }
      }
      
      // 最終手段：最新のMock試験詳細から結果を復元してみる
      console.log('Attempting to restore from latestMockExam data...');
      const latestMockKey = getUserKey('latestMockExam');
      const latestMock = safeLocalStorage.getItem<any>(latestMockKey);
      
      if (latestMock && latestMock.examRecord && latestMock.examRecord.completedAt) {
        // 5分以内の最新データなら使用
        const completedTime = new Date(latestMock.examRecord.completedAt).getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        if (completedTime > fiveMinutesAgo) {
          console.log('Found recent mock exam data, using it as fallback');
          processResults({
            session: latestMock.session,
            questions: latestMock.questions || [],
            userId: user.id,
            userNickname: user.nickname
          });
          return;
        }
      }
      
      console.error('No recent mock exam data found for recovery');
      // より詳細なエラーメッセージ
      const debugInfo = `
Mock試験の結果が見つかりませんでした。

【デバッグ情報】
- ユーザー: ${user.nickname} (ID: ${user.id})
- 検索したキー: 
  1. tempMockResult_${user.nickname}
  2. tempMockResult_${user.id}
  3. tempMockResult_latest
- Mock関連キー: ${allKeys.filter(k => k.includes('Mock') || k.includes('mock')).join(', ') || 'なし'}

【対処法】
1. ブラウザの戻るボタンで試験画面に戻る
2. StorageCleanupでデータを整理
3. Mock試験を再度受験

この問題が続く場合は、管理者にお問い合わせください。`;
      alert(debugInfo);
      router.push('/study');
      return;
    }
    
    // 結果と問題データを結合
    const mockResultWithQuestions: MockResult = {
      ...tempResult,
      questions: tempQuestions || tempResult.questions || [],
      session: tempResult.session
    };

    // データの検証
    if (!mockResultWithQuestions.session || !mockResultWithQuestions.questions || mockResultWithQuestions.questions.length === 0) {
      console.error('Invalid mock result data', mockResultWithQuestions);
      alert('Mock試験の問題データが見つかりませんでした。');
      router.push('/study');
      return;
    }

    // answersが存在しない場合は空配列を設定
    if (!mockResultWithQuestions.session.answers) {
      console.warn('No answers found in session, setting empty array');
      mockResultWithQuestions.session.answers = [];
    }

    // 採点を実行
    processResults(mockResultWithQuestions);
    
    // 一時データを削除（すべての可能なキーをクリーンアップ）
    safeLocalStorage.removeItem(tempKey);
    safeLocalStorage.removeItem(questionsKey);
    safeLocalStorage.removeItem(`tempMockResult_${user.id}`);
    safeLocalStorage.removeItem(`tempMockQuestions_${user.id}`);
    safeLocalStorage.removeItem('tempMockResult_latest');
    safeLocalStorage.removeItem('tempMockQuestions_latest');
  }, [router, user, authLoading]);

  const processResults = (result: MockResult) => {
    try {
      const { session, questions } = result;
      
      // answersが配列でない場合のエラーハンドリング
      if (!Array.isArray(session.answers)) {
        console.error('session.answers is not an array', session.answers);
        session.answers = [];
      }
      
      // カテゴリ別の結果を集計
      const categoryMap = new Map<string, { correct: number; total: number }>();
      
      session.answers.forEach((answer, index) => {
        const question = questions[index];
        if (!question) return;
        
        const categoryData = categoryMap.get(question.category) || { correct: 0, total: 0 };
        categoryData.total++;
        if (answer.isCorrect) {
          categoryData.correct++;
        }
        categoryMap.set(question.category, categoryData);
      });

      // カテゴリ結果を配列に変換
      const results: CategoryResult[] = Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        correct: data.correct,
        total: data.total,
        percentage: data.total > 0 ? parseFloat(formatPercentage(data.correct, data.total)) : 0
      }));

      setCategoryResults(results);

      // 総合スコアを計算
      const totalCorrect = session.answers.filter(a => a.isCorrect).length;
      const score = session.answers.length > 0 ? parseFloat(formatPercentage(totalCorrect, session.answers.length)) : 0;
      setTotalScore(score);
      setPassed(score >= 70);

      // Mock試験の場合は専用の進捗更新を使用（Part情報も渡す）
      if (session.category && isMockCategory(session.category)) {
        const part = session.mockPart; // Part情報（1-3 または undefined）
        updateMockExamProgress(
          session.category, 
          score, 
          questions.length,
          result.userNickname || user?.nickname, // ユーザーのニックネームを明示的に渡す
          part,
          totalCorrect // 正解数も渡す
        );
      }
      
      // Mock試験も通常学習も同じようにuserProgressを更新（studySessionsに追加）
      // これによりMock試験結果もFirestoreに同期される
      updateUserProgress(session, questions, result.userNickname || user?.nickname);
      
      // Mock試験履歴を保存
      saveMockExamHistory(result, score, result.userNickname || user?.nickname);

      setMockResult(result);
      setLoading(false);
    } catch (error) {
      console.error('Error processing results:', error);
      alert('結果の処理中にエラーが発生しました');
      router.push('/study');
    }
  };

  const updateUserProgress = (session: StudySession, questions: Question[], userNickname?: string) => {
    const userProgressKey = getUserKey('userProgress', userNickname);
    const progress = safeLocalStorage.getItem<UserProgress>(userProgressKey);
    if (!progress) return;

    // Mock試験かどうか判定
    const isMock = session.category && isMockCategory(session.category);
    let mockNumber: number | undefined;
    if (isMock && session.category) {
      // カテゴリ名からMock番号を抽出（例: "Regulations: Mock 1" → 1）
      const match = session.category.match(/Mock (\d+)/);
      mockNumber = match ? parseInt(match[1]) : undefined;
    }

    // 正解・不正解の更新
    session.answers.forEach((answer, index) => {
      const question = questions[index];
      if (!question) return;

      // カテゴリ別の進捗を更新
      const categoryProgress = progress.categoryProgress[question.category];
      if (categoryProgress) {
        categoryProgress.answeredQuestions = Math.min(
          categoryProgress.answeredQuestions + 1,
          categoryProgress.totalQuestions
        );
        if (answer.isCorrect) {
          categoryProgress.correctAnswers = Math.min(
            categoryProgress.correctAnswers + 1,
            categoryProgress.totalQuestions
          );
        }
      }

      // 総合統計を更新
      progress.totalQuestionsAnswered++;
      if (answer.isCorrect) {
        progress.correctAnswers++;
      } else {
        // 間違えた問題を記録（Mock試験の場合はsourceとmockNumberも渡す）
        saveIncorrectQuestion(
          question.questionId, 
          question.category,
          userNickname,
          isMock ? 'mock' : 'category',
          mockNumber
        );
      }
    });

    // セッションを履歴に追加（questionsを除外）
    if (!progress.studySessions) progress.studySessions = [];
    const { questions: _, ...sessionWithoutQuestions } = session;
    const sessionToSave: any = {
      ...sessionWithoutQuestions,
      questionIds: questions.map(q => q.questionId)
    };
    
    progress.studySessions.push(sessionToSave);
    
    // 最新50セッションのみ保持
    if (progress.studySessions.length > 50) {
      progress.studySessions = progress.studySessions.slice(-50);
    }

    safeLocalStorage.setItem(userProgressKey, progress);
  };

  const saveMockExamHistory = (result: MockResult, score: number, userNickname?: string) => {
    const historyKey = getUserKey('mockExamHistory', userNickname);
    const history = safeLocalStorage.getItem<any[]>(historyKey) || [];
    
    // セッションデータを軽量化
    const { questions: _, ...sessionWithoutQuestions } = result.session;
    const lightSession: any = {
      ...sessionWithoutQuestions,
      questionIds: result.questions.map(q => q.questionId)
    };
    
    const examRecord = {
      id: `mock_${Date.now()}`,
      session: lightSession,
      score,
      passed: score >= 70,
      completedAt: new Date().toISOString(),
      questionsCount: result.questions.length,
      category: result.session.category
    };

    history.push(examRecord);
    
    // 最新20件のみ保持
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    safeLocalStorage.setItem(historyKey, history);
    
    // 最新のMock試験の詳細を復習用に保存（問題データは含めない）
    const latestMockKey = getUserKey('latestMockExam', userNickname);
    safeLocalStorage.setItem(latestMockKey, {
      session: lightSession,
      questions: result.questions, // 復習画面用に一時的に保存
      score,
      categoryResults,
      examRecord
    });
  };

  const formatTimeDifference = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    return formatElapsedTime(diffSeconds);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">{authLoading ? '認証情報を確認中...' : '採点中...'}</p>
        </div>
      </div>
    );
  }

  if (!mockResult) {
    return null;
  }

  const { session, questions } = mockResult;
  const timeTaken = formatTimeDifference(session.startedAt, session.completedAt || new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/study" className="text-gray-400 hover:text-gray-100">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Mock試験結果</h1>
                <p className="text-gray-400">{session.category} - {session.mode === 'mock25' ? '25問' : '75問'}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Score Card */}
        <div className="bg-gray-800 rounded-xl shadow-lg p-8 mb-8 text-center">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-6 ${
            passed ? 'bg-green-900/30 border-4 border-green-500' : 'bg-red-900/30 border-4 border-red-500'
          }`}>
            {passed ? (
              <Trophy className="w-16 h-16 text-green-400" />
            ) : (
              <AlertCircle className="w-16 h-16 text-red-400" />
            )}
          </div>
          
          <h2 className="text-5xl font-bold mb-2 text-gray-100">{totalScore}%</h2>
          <p className={`text-2xl font-medium mb-4 ${passed ? 'text-green-400' : 'text-red-400'}`}>
            {passed ? '合格' : '不合格'}
          </p>
          <p className="text-gray-400">
            {session.answers.filter(a => a.isCorrect).length} / {session.answers.length} 問中正解
          </p>
          <p className="text-gray-500 text-sm mt-1">
            （{session.answers.filter(a => a.selectedAnswer !== '').length} 問回答済み）
          </p>
        </div>

        {/* Answer Summary */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-400">回答済み</p>
              <p className="text-xl font-bold text-gray-100">
                {session.answers.filter(a => a.selectedAnswer !== '').length}問
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">未回答</p>
              <p className="text-xl font-bold text-yellow-400">
                {session.answers.filter(a => a.selectedAnswer === '').length}問
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">全問題数</p>
              <p className="text-xl font-bold text-gray-100">{session.answers.length}問</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-gray-300">所要時間</h3>
            </div>
            <p className="text-2xl font-bold text-gray-100">{timeTaken}</p>
            <p className="text-sm text-gray-500">
              制限時間: {session.timeLimit ? formatElapsedTime(session.timeLimit / 1000) : '無制限'}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-indigo-400" />
              <h3 className="font-medium text-gray-300">正答率</h3>
            </div>
            <p className="text-2xl font-bold text-gray-100">{totalScore}%</p>
            <p className="text-sm text-gray-500">合格ライン: 70%</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="font-medium text-gray-300">平均解答時間</h3>
            </div>
            <p className="text-2xl font-bold text-gray-100">
              {session.answers.filter(a => a.selectedAnswer !== '').length > 0 
                ? Math.floor((new Date(session.completedAt || '').getTime() - new Date(session.startedAt).getTime()) / 1000 / session.answers.filter(a => a.selectedAnswer !== '').length)
                : 0}秒
            </p>
            <p className="text-sm text-gray-500">1問あたり（回答済みのみ）</p>
          </div>
        </div>

        {/* Category Results */}
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            カテゴリ別結果
          </h3>
          <div className="space-y-3">
            {categoryResults.map((category) => (
              <div key={category.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-300">{category.name}</span>
                  <span className="text-sm font-medium text-gray-100">
                    {category.correct}/{category.total} ({category.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      category.percentage >= 70 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => {
              // 最新のMock試験の詳細を保存してから遷移
              saveMockExamHistory(mockResult, totalScore, user?.nickname);
              router.push('/study/mock-review');
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            <FileText className="w-5 h-5" />
            詳細を確認
          </button>
          <Link
            href="/study"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 font-medium"
          >
            学習に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MockResultPage() {
  return (
    <ProtectedRoute>
      <MockResultContent />
    </ProtectedRoute>
  );
}