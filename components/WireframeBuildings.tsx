"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Category } from '@/types';

interface BuildingData {
  id: string;
  name: string;
  nameJa: string;
  icon: string;
  category: Category;
  description: string;
  svg: React.ReactNode;
}

interface WireframeBuildingsProps {
  progress: Record<Category, { answeredQuestions: number; totalQuestions: number; correctAnswers?: number }>;
}

export default function WireframeBuildings({ progress }: WireframeBuildingsProps) {
  const router = useRouter();
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const buildings: BuildingData[] = [
    {
      id: 'bigben',
      name: 'Big Ben',
      nameJa: 'ビッグ・ベン',
      icon: '🕰️',
      category: 'The Regulatory Environment',
      description: '時を刻む規制の基礎',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Clock tower base */}
            <rect x="35" y="60" width="30" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Clock face */}
            <circle cx="50" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Clock hands */}
            <line x1="50" y1="40" x2="50" y2="25" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="40" x2="60" y2="40" stroke="currentColor" strokeWidth="2" />
            {/* Tower top */}
            <polygon points="30,60 50,10 70,60" fill="none" stroke="currentColor" strokeWidth="2" />
          </g>
        </svg>
      )
    },
    {
      id: 'eiffel',
      name: 'Eiffel Tower',
      nameJa: 'エッフェル塔',
      icon: '🗼',
      category: 'The Financial Services and Markets Act 2000 and Financial Services Act 2012',
      description: '金融法の鉄骨構造',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Tower structure */}
            <polygon points="50,10 30,130 70,130" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Cross beams */}
            <line x1="35" y1="50" x2="65" y2="50" stroke="currentColor" strokeWidth="1.5" />
            <line x1="37" y1="70" x2="63" y2="70" stroke="currentColor" strokeWidth="1.5" />
            <line x1="40" y1="90" x2="60" y2="90" stroke="currentColor" strokeWidth="1.5" />
            <line x1="42" y1="110" x2="58" y2="110" stroke="currentColor" strokeWidth="1.5" />
          </g>
        </svg>
      )
    },
    {
      id: 'colosseum',
      name: 'Colosseum',
      nameJa: 'コロッセオ',
      icon: '🏛️',
      category: 'Associated Legislation and Regulation',
      description: '古代の知恵と現代規制の融合',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Outer ellipse */}
            <ellipse cx="50" cy="70" rx="40" ry="25" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Inner ellipse */}
            <ellipse cx="50" cy="70" rx="30" ry="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Arches */}
            <path d="M 20 70 A 5 10 0 0 1 30 70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 35 70 A 5 10 0 0 1 45 70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 55 70 A 5 10 0 0 1 65 70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 70 70 A 5 10 0 0 1 80 70" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </g>
        </svg>
      )
    },
    {
      id: 'sagrada',
      name: 'Sagrada Família',
      nameJa: 'サグラダ・ファミリア',
      icon: '⛪',
      category: 'The FCA Conduct of Business Sourcebook/Client Assets',
      description: '実務行動の緻密な詳細',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Main spires */}
            <polygon points="30,130 35,30 40,130" fill="none" stroke="currentColor" strokeWidth="2" />
            <polygon points="45,130 50,20 55,130" fill="none" stroke="currentColor" strokeWidth="2" />
            <polygon points="60,130 65,30 70,130" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Gothic details */}
            <circle cx="35" cy="40" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="35" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="65" cy="40" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          </g>
        </svg>
      )
    },
    {
      id: 'windmill',
      name: 'Dutch Windmill',
      nameJa: 'オランダ風車',
      icon: '🌬️',
      category: 'Complaints and Redress',
      description: '問題を解決へと導く風',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Windmill body */}
            <polygon points="40,130 35,60 65,60 60,130" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Windmill blades */}
            <line x1="50" y1="60" x2="50" y2="30" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="60" x2="75" y2="60" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="60" x2="50" y2="90" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="60" x2="25" y2="60" stroke="currentColor" strokeWidth="2" />
            {/* Center */}
            <circle cx="50" cy="60" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          </g>
        </svg>
      )
    },
    {
      id: 'brandenburg',
      name: 'Brandenburg Gate',
      nameJa: 'ブランデンブルク門',
      icon: '🚪',
      category: 'Regulations: Final Study Questions',
      description: '資格認定への門',
      svg: (
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <g className="building-wireframe">
            {/* Columns */}
            <rect x="20" y="50" width="8" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="35" y="50" width="8" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="57" y="50" width="8" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="72" y="50" width="8" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Top structure */}
            <rect x="15" y="40" width="70" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Chariot on top */}
            <polygon points="40,40 50,25 60,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </g>
        </svg>
      )
    }
  ];

  const getProgressPercentage = (category: Category): number => {
    const categoryProgress = progress[category];
    if (!categoryProgress || categoryProgress.totalQuestions === 0) return 0;
    
    // Progress based on correct answers - building progresses with correct answers
    return Math.round(((categoryProgress.correctAnswers || 0) / categoryProgress.totalQuestions) * 100);
  };

  const getAccuracy = (category: Category): number => {
    const categoryProgress = progress[category];
    if (!categoryProgress || categoryProgress.answeredQuestions === 0) return 0;
    return Math.round(((categoryProgress.correctAnswers || 0) / categoryProgress.answeredQuestions) * 100);
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage === 0) return 'text-gray-500';
    if (percentage < 30) return 'text-blue-400';
    if (percentage < 70) return 'text-blue-500';
    if (percentage < 100) return 'text-blue-600';
    return 'text-yellow-500'; // 完成時は金色
  };

  const getStrokeDasharray = (percentage: number): string => {
    if (percentage === 0) return '2 4'; // 点線
    if (percentage < 100) return 'none'; // 実線
    return 'none'; // 完成
  };

  const handleBuildingClick = (category: Category) => {
    router.push(`/study?mode=category&selected=${encodeURIComponent(category)}`);
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-100">
        <span className="text-2xl">🏗️</span>
        学習の旅 - Wire Art Progress
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        問題を解いて、欧州の名建築をワイヤーアートで完成させよう
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {buildings.map((building) => {
          const percentage = getProgressPercentage(building.category);
          const accuracy = getAccuracy(building.category);
          const color = getProgressColor(percentage);
          const strokeDasharray = getStrokeDasharray(percentage);
          const isHovered = hoveredBuilding === building.id;
          const categoryProgress = progress[building.category];
          
          return (
            <div 
              key={building.id}
              className="relative cursor-pointer"
              onMouseEnter={() => setHoveredBuilding(building.id)}
              onMouseLeave={() => setHoveredBuilding(null)}
              onClick={() => handleBuildingClick(building.category)}
            >
              {/* Hover Details Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10 w-48 animate-fade-in">
                  <div className="bg-gray-900 text-white rounded-lg p-3 shadow-xl">
                    <div className="text-sm font-bold mb-1">{building.nameJa}</div>
                    <div className="text-xs opacity-90 mb-2">{building.description}</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>正解数:</span>
                        <span>{categoryProgress?.correctAnswers || 0}/{categoryProgress?.totalQuestions || 0}問</span>
                      </div>
                      <div className="flex justify-between">
                        <span>挑戦済み:</span>
                        <span>{categoryProgress?.answeredQuestions || 0}問</span>
                      </div>
                      <div className="flex justify-between">
                        <span>正答率:</span>
                        <span>{accuracy}%</span>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                      <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className={`text-center group transition-all duration-300 ${isHovered ? 'scale-110' : 'hover:scale-105'}`}>
                <div className="relative">
                  <div 
                    className={`${color} transition-all duration-300 ${isHovered ? 'animate-pulse' : ''}`}
                    style={{
                      strokeDasharray,
                      filter: percentage === 100 ? 'drop-shadow(0 0 8px gold)' : isHovered ? 'drop-shadow(0 0 4px currentColor)' : 'none',
                      strokeDashoffset: percentage === 0 ? '0' : undefined,
                    }}
                  >
                    {building.svg}
                  </div>
                  {percentage === 100 && (
                    <div className="absolute top-0 right-0 animate-bounce">
                      <span className="text-2xl">✨</span>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-2xl mb-1 transition-transform duration-300 group-hover:scale-110">
                    {building.icon}
                  </div>
                  <h3 className="text-xs font-semibold text-gray-300">{building.name}</h3>
                  <div className="mt-1">
                    <div className="text-lg font-bold text-gray-100">{percentage}%</div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 relative ${
                          percentage === 100 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 0 && percentage < 100 && (
                          <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-400">
        全体の完成度: {Math.round(buildings.reduce((sum, building) => 
          sum + getProgressPercentage(building.category), 0) / buildings.length)}%
      </div>
    </div>
  );
}