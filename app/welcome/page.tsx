'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { GraduationCap, ArrowRight, Sparkles, Building, Trophy, Target } from 'lucide-react';

function WelcomeContent() {
  const router = useRouter();
  const { user } = useAuth();

  const handleStart = () => {
    // 既存のユーザーか確認
    const userProgressKey = `userProgress_${user?.nickname}`;
    const existingProgress = localStorage.getItem(userProgressKey);
    
    if (existingProgress) {
      // 既存ユーザーは直接ダッシュボードへ
      router.push('/dashboard');
    } else {
      // 新規ユーザーは初期データを作成してダッシュボードへ
      localStorage.setItem(userProgressKey, JSON.stringify({ 
        onboardingComplete: true,
        createdAt: new Date().toISOString()
      }));
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-2xl w-full text-center">
        <GraduationCap className="w-24 h-24 text-indigo-600 mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold mb-4 text-gray-100">
          ようこそ、{user?.nickname}さん！
        </h1>
        
        <p className="text-gray-400 mb-8">
          UK Financial Regulation試験の
          <br />
          合格に向けて、一緒に頑張りましょう！
        </p>

        {/* コンセプト紹介 */}
        <div className="bg-gray-700/50 rounded-lg p-6 mb-8 text-left space-y-4">
          <h2 className="text-xl font-bold text-gray-100 text-center mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            学習の旅を楽しく可視化
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-200">建物が完成していく達成感</h3>
                <p className="text-sm text-gray-400">
                  カテゴリごとに欧州の名建築がワイヤーアートで描かれ、<br />
                  問題を解くたびに少しずつ完成していきます</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-200">効率的な10問学習</h3>
                <p className="text-sm text-gray-400">1セット10問の短時間学習で、無理なく継続できます</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-200">6つの建築物を完成させよう</h3>
                <p className="text-sm text-gray-400">
                  🕰️ Big Ben → 🗼 Eiffel Tower → 🏛️ Colosseum →<br />
                  ⛪ Sagrada Família → 🌬️ Windmill → 🚪 Brandenburg Gate
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-indigo-700 flex items-center gap-2 mx-auto font-medium transition-all hover:scale-105"
        >
          学習を開始する
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <ProtectedRoute>
      <WelcomeContent />
    </ProtectedRoute>
  );
}