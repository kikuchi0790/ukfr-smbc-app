'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, Languages, AlertCircle } from 'lucide-react';

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
  showJapanese: initialShowJapanese = true,
  isCollapsible = false,
  defaultCollapsed = false
}: QuestionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showJapanese, setShowJapanese] = useState(initialShowJapanese);

  if (!questionData) return null;

  const { question, questionJa, options, correctAnswer, explanation, explanationJa, category } = questionData;

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowJapanese(!showJapanese)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
            title={showJapanese ? "英語表示" : "日本語表示"}
          >
            <Languages className="w-4 h-4" />
            <span className="text-gray-200">{showJapanese ? "日本語ON" : "English"}</span>
          </button>
        </div>
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

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Category Badge */}
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-sm border border-indigo-700">
              {category}
            </span>
          </div>

          {/* Question */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2 text-gray-100">
              {question}
            </h2>
            {showJapanese && questionJa && (
              <p className="text-gray-400 mt-2">
                {questionJa}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {options.map((option) => {
              const isSelected = selectedAnswer === option.letter;
              const isCorrect = option.letter === correctAnswer;
              const showCorrect = showResult && isCorrect;
              const showIncorrect = showResult && isSelected && !isCorrect;

              return (
                <div
                  key={option.letter}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    showCorrect
                      ? 'border-green-500 bg-green-900/30'
                      : showIncorrect
                      ? 'border-red-500 bg-red-900/30'
                      : isSelected
                      ? 'border-indigo-500 bg-indigo-900/30'
                      : 'border-gray-600 bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`font-bold ${
                      showCorrect ? 'text-green-400' : showIncorrect ? 'text-red-400' : 'text-gray-300'
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
                    {showCorrect && <Check className="w-5 h-5 text-green-400 mt-0.5" />}
                    {showIncorrect && <X className="w-5 h-5 text-red-400 mt-0.5" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanation (if answered) */}
          {showResult && (
            <div className="mb-6">
              <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-300 mb-1">解説</p>
                    <p className="text-blue-100">{explanation}</p>
                    {showJapanese && explanationJa && (
                      <p className="text-blue-200 text-sm mt-2">
                        {explanationJa}
                      </p>
                    )}
                  </div>
                </div>
              </div>
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