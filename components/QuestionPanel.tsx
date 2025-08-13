'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Languages, BookOpen, Info } from 'lucide-react';

interface Option {
  letter: string;
  text: string;
  textJa?: string;
}

interface QuestionData {
  question: string;
  questionJa?: string;
  options: Option[];
  correctAnswer: string;
  explanation: string;
  explanationJa?: string;
  category: string;
}

interface QuestionPanelProps {
  questionData: QuestionData;
  selectedAnswer?: string | null;
  showResult?: boolean;
  showJapanese?: boolean;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
}

export default function QuestionPanel({
  questionData,
  selectedAnswer,
  showResult,
  showJapanese: initialShowJapanese = false,
  isCollapsible = true,
  defaultCollapsed = false
}: QuestionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showJapanese, setShowJapanese] = useState(initialShowJapanese);

  if (!questionData) return null;

  const { question, questionJa, options, correctAnswer, explanation, explanationJa, category } = questionData;

  return (
    <div className="h-full flex flex-col bg-gray-800 border-r border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">問題内容</h3>
          <span className="text-xs text-gray-400">({category})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJapanese(!showJapanese)}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title={showJapanese ? "英語表示" : "日本語表示"}
          >
            <Languages className="w-4 h-4 text-gray-400" />
          </button>
          {isCollapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-gray-800 rounded transition-colors"
              title={isCollapsed ? "展開" : "折りたたむ"}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Question */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              質問
            </h4>
            <p className="text-gray-200 text-sm leading-relaxed">
              {showJapanese && questionJa ? questionJa : question}
            </p>
            {showJapanese && questionJa && (
              <p className="text-gray-400 text-xs mt-2 italic">
                {question}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              選択肢
            </h4>
            <div className="space-y-2">
              {options.map((option) => {
                const isSelected = selectedAnswer === option.letter;
                const isCorrect = option.letter === correctAnswer;
                const showFeedback = showResult && (isSelected || isCorrect);

                return (
                  <div
                    key={option.letter}
                    className={`p-3 rounded-lg text-sm transition-all ${
                      showFeedback
                        ? isCorrect
                          ? 'bg-green-900/30 border border-green-700'
                          : isSelected
                          ? 'bg-red-900/30 border border-red-700'
                          : 'bg-gray-700/50'
                        : isSelected
                        ? 'bg-blue-900/30 border border-blue-700'
                        : 'bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-gray-300">
                        {option.letter}.
                      </span>
                      <div className="flex-1">
                        <span className="text-gray-200">
                          {showJapanese && option.textJa ? option.textJa : option.text}
                        </span>
                        {showJapanese && option.textJa && (
                          <span className="text-gray-400 text-xs block mt-1 italic">
                            {option.text}
                          </span>
                        )}
                      </div>
                      {showFeedback && (
                        <div className="ml-2">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : isSelected ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation (if answered) */}
          {showResult && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3 h-3" />
                解説
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                {showJapanese && explanationJa ? explanationJa : explanation}
              </p>
              {showJapanese && explanationJa && (
                <p className="text-gray-400 text-xs mt-2 italic">
                  {explanation}
                </p>
              )}
            </div>
          )}

          {/* Result Badge */}
          {showResult && (
            <div className="mt-4 flex justify-center">
              {selectedAnswer === correctAnswer ? (
                <div className="px-4 py-2 bg-green-900/50 text-green-300 rounded-full text-sm font-medium">
                  ✓ 正解
                </div>
              ) : (
                <div className="px-4 py-2 bg-red-900/50 text-red-300 rounded-full text-sm font-medium">
                  ✗ 不正解
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="px-4 py-3 text-center">
          <p className="text-gray-400 text-sm">
            クリックして問題を表示
          </p>
        </div>
      )}
    </div>
  );
}