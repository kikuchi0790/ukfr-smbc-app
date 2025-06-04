"use client";

import Link from "next/link";
import { GraduationCap, BookOpen, Target, Clock, ArrowRight, Languages, Timer, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamic import for 3D components
const BigBenShowcase = dynamic(
  () => import('@/components/BigBenShowcase'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-4 text-gray-400">3Dモデルを読み込み中...</p>
        </div>
      </div>
    )
  }
);

// ワイヤーアート版（将来的な切り替え用）
// const BackgroundBuildings = dynamic(
//   () => import('@/components/BackgroundBuildings'),
//   { ssr: false }
// );

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

export default function Home() {
  const { isAuthenticated, user, logout } = useAuth();
  const [bigBenProgress, setBigBenProgress] = useState(100);
  const bigBenStartProgress = 25; // 固定値なのでstateではなく定数として定義

  useEffect(() => {
    // Start animation after component mounts with a small delay
    const timer = setTimeout(() => {
      setBigBenProgress(100);
    }, 500);

    return () => clearTimeout(timer);
  }, []);
  const features = [
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "カテゴリ別学習",
      description: "5カテゴリから10問ずつランダム出題"
    },
    {
      icon: <Timer className="w-8 h-8" />,
      title: "Mock試験モード",
      description: "25問(30分)または75問(90分)の実践形式"
    },
    {
      icon: <RotateCcw className="w-8 h-8" />,
      title: "スマート復習",
      description: "間違えた問題を自動管理・優先出題"
    },
    {
      icon: <Languages className="w-8 h-8" />,
      title: "日英対訳",
      description: "すべての問題に日本語翻訳付き"
    }
  ];

  const learningModes = [
    { 
      name: "カテゴリ別学習", 
      description: "各カテゴリから10問", 
      time: "15-20分/セット", 
      color: "bg-indigo-500",
      icon: <Target className="w-6 h-6" />
    },
    { 
      name: "Mock試験（25問）", 
      description: "実践形式・30分制限", 
      time: "30分", 
      color: "bg-emerald-500",
      icon: <Clock className="w-6 h-6" />
    },
    { 
      name: "Mock試験（75問）", 
      description: "本番形式・90分制限", 
      time: "90分", 
      color: "bg-emerald-700",
      icon: <Timer className="w-6 h-6" />
    },
    { 
      name: "復習モード", 
      description: "間違えた問題を集中学習", 
      time: "10問ずつ", 
      color: "bg-orange-500",
      icon: <RotateCcw className="w-6 h-6" />
    }
  ];

  const categories = [
    { name: "The Regulatory Environment", count: 42 },
    { name: "Financial Services Acts", count: 99 },
    { name: "Associated Legislation", count: 100 },
    { name: "FCA Conduct of Business", count: 125 },
    { name: "Complaints and Redress", count: 32 },
    { name: "Mock Tests 1-5", count: 375 },
    { name: "Final Study Questions", count: 62 }
  ];

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* 都市景観背景 */}
      <BackgroundCityscape />
      
      {/* Content wrapper with higher z-index */}
      <div className="relative z-10">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-indigo-500" />
            <h1 className="text-xl font-bold text-gray-100">UKFR Learning for SMBC</h1>
          </div>
          <nav className="flex items-center gap-6">
            {!isAuthenticated ? (
              <>
                <Link href="/login" className="text-gray-400 hover:text-gray-100">
                  ログイン
                </Link>
                <Link href="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  始める
                </Link>
              </>
            ) : (
              <>
                <span className="text-gray-400">こんにちは、{user?.nickname}さん</span>
                <Link href="/dashboard" className="text-gray-400 hover:text-gray-100">
                  マイページ
                </Link>
                <Link href="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  学習を始める
                </Link>
                <button 
                  onClick={logout}
                  className="text-gray-400 hover:text-gray-100 flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-100 mb-6">
            UKFR Learning for SMBC
            <span className="block text-3xl text-indigo-500 mt-2">高精度AIがサポート</span>
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            SMBC欧州チームのためのCISI試験対策アプリ。
            <br />
            10問ずつの効率学習と日本語学習により確実な合格をサポート。
          </p>
          <div className="flex gap-4 justify-center">
            {!isAuthenticated ? (
              <Link href="/login" className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-indigo-700 flex items-center gap-2">
                はじめる <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link href="/dashboard" className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-indigo-700 flex items-center gap-2">
                学習を開始 <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link href="#features" className="border-2 border-gray-600 text-gray-300 px-8 py-4 rounded-lg text-lg hover:border-gray-500">
              機能を見る
            </Link>
          </div>
        </div>
      </section>

      {/* Learning Modes */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">4つの学習モード</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {learningModes.map((mode) => (
            <div key={mode.name} className="bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border border-gray-700">
              <div className={`${mode.color} w-16 h-16 rounded-full flex items-center justify-center text-white mb-4`}>
                {mode.icon}
              </div>
              <h4 className="text-xl font-bold mb-2 text-gray-100">{mode.name}</h4>
              <p className="text-gray-400 mb-2">{mode.description}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{mode.time}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Content Overview */}
      <section className="bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">836問の充実コンテンツ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {categories.map((category, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-600">
                <h4 className="font-bold text-sm mb-1 text-gray-200">{category.name}</h4>
                <p className="text-2xl font-bold text-indigo-500">{category.count}問</p>
              </div>
            ))}
            <div className="bg-indigo-600 text-white rounded-lg p-4 shadow-sm">
              <h4 className="font-bold text-sm mb-1">合計</h4>
              <p className="text-2xl font-bold">836問</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">スマートな学習機能</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-700">
              <div className="text-indigo-500 mb-4">{feature.icon}</div>
              <h4 className="text-xl font-bold mb-2 text-gray-100">{feature.title}</h4>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Flow */}
      <section className="bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">効果的な学習フロー</h3>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-100">カテゴリ別学習で基礎固め</h4>
                  <p className="text-gray-400">各カテゴリから10問ずつ、日本語翻訳を見ながらじっくり学習</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-100">間違えた問題を自動記録</h4>
                  <p className="text-gray-400">システムが自動的に弱点を把握し、次回の学習に反映</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-100">Mock試験で実力チェック</h4>
                  <p className="text-gray-400">タイマー付き試験でMock試験に挑戦</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-100">復習モードで弱点克服</h4>
                  <p className="text-gray-400">間違えた問題を集中的に学習して確実な合格へ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wire Art Feature */}
      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-6 text-white">
                🏗️ 学習の旅をビジュアルに体験
              </h3>
              <p className="text-lg text-gray-300 mb-4">
                問題を解いて、欧州の名建築を3Dワイヤーアートで完成させよう
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* 25% Progress Example */}
              <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                <div className="p-4 bg-gradient-to-r from-gray-600 to-gray-500 text-white">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <span className="text-2xl">🏗️</span>
                    学習開始時 - 25%
                  </h4>
                  <p className="text-sm opacity-90">カテゴリ学習開始直後</p>
                </div>
                <div className="h-[300px]">
                  <BigBenShowcase targetProgress={bigBenStartProgress} animationDuration={0} />
                </div>
              </div>

              {/* 100% Progress Example */}
              <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                <div className="p-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <span className="text-2xl">🕰️</span>
                    完成形 - 100%
                  </h4>
                  <p className="text-sm opacity-90">カテゴリ完全制覇！</p>
                </div>
                <div className="h-[300px]">
                  <BigBenShowcase targetProgress={bigBenProgress} animationDuration={3000} />
                </div>
              </div>
              
              {/* Growth Arrow and Description */}
              <div className="flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4 animate-pulse">→</div>
                  <h4 className="text-xl font-bold text-white mb-2">成長の証</h4>
                  <p className="text-gray-300 text-sm">
                    学習を進めるごとに<br/>
                    建物が徐々に完成していきます
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">0% - 25%</span>
                    <span className="text-gray-300">基礎構造</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">25% - 50%</span>
                    <span className="text-gray-300">主要構造</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">50% - 75%</span>
                    <span className="text-gray-300">詳細追加</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">75% - 100%</span>
                    <span className="text-yellow-400 font-bold">完成！✨</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Building Icons Grid */}
            <div className="mt-12">
              <h4 className="text-xl font-bold mb-6 text-white text-center">6つのカテゴリ、6つの建築物</h4>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">🕰️</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Big Ben</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">Regulatory Environment</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">🗼</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Eiffel Tower</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">Financial Services Acts</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">🏛️</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Colosseum</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">Associated Legislation</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">⛪</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Sagrada Família</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">FCA Conduct of Business</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">🌬️</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Windmill</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">Complaints & Redress</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center group cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-gray-800 rounded-lg p-4 group-hover:bg-gray-700 h-full flex flex-col justify-between">
                      <div className="text-4xl mb-2 group-hover:animate-bounce">🚪</div>
                      <div>
                        <p className="text-sm text-gray-300 font-medium">Brandenburg</p>
                        <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem] flex items-center justify-center">Final Study Questions</p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-12 text-center text-white shadow-2xl">
          <h3 className="text-3xl font-bold mb-4">短期間でスコアUP!!</h3>
          <p className="text-xl mb-8">10問ずつの効率学習で、無理なく確実に合格へ</p>
          {!isAuthenticated ? (
            <Link href="/login" className="bg-white text-indigo-700 px-8 py-4 rounded-lg text-lg hover:bg-gray-100 inline-flex items-center gap-2 font-semibold transition-all hover:scale-105">
              はじめる <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <Link href="/dashboard" className="bg-white text-indigo-700 px-8 py-4 rounded-lg text-lg hover:bg-gray-100 inline-flex items-center gap-2 font-semibold transition-all hover:scale-105">
              はじめる <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-8 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 Mitsunori Kikuchi. All rights reserved.</p>
        </div>
      </footer>
      </div>
    </div>
  );
}