"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { 
  GraduationCap,
  Target,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");

  const getGoalText = (goal: string) => {
    const goals: Record<string, string> = {
      pass: "合格ライン達成",
      high: "高得点合格",
      perfect: "満点合格",
      explore: "内容把握"
    };
    return goals[goal] || "";
  };

  const getTimeText = (time: string) => {
    const times: Record<string, string> = {
      "30min": "1日30分以下",
      "1hour": "1日1時間",
      "2hours": "1日2時間",
      "flexible": "フレキシブル"
    };
    return times[time] || "";
  };

  const getLevelText = (level: string) => {
    const levels: Record<string, string> = {
      beginner: "初心者",
      intermediate: "中級者",
      advanced: "上級者",
      refresher: "復習"
    };
    return levels[level] || "";
  };

  const getRecommendedCourse = () => {
    if (selectedTime === "30min") return "超特急コース";
    if (selectedGoal === "perfect") return "完全マスターコース";
    if (selectedLevel === "advanced") return "標準コース";
    return "エッセンシャルコース";
  };

  const steps = [
    {
      title: "ようこそ！",
      description: "UK Financial Regulation学習アプリへ",
      content: (
        <div className="text-center">
          <GraduationCap className="w-24 h-24 text-indigo-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">
            {user?.firstName || ""}さん、ようこそ！
          </h2>
          <p className="text-gray-600 mb-6">
            CISI UK Financial Regulation (ED31) 試験の
            <br />
            合格に向けて、一緒に頑張りましょう！
          </p>
          <p className="text-sm text-gray-500">
            まずは、あなたに最適な学習プランを作成するため、
            <br />
            いくつか質問にお答えください。
          </p>
        </div>
      )
    },
    {
      title: "学習目標",
      description: "試験の目標を教えてください",
      content: (
        <div>
          <h3 className="text-xl font-bold mb-6 text-center">
            試験での目標は何ですか？
          </h3>
          <div className="space-y-3">
            {[
              { value: "pass", label: "合格ラインの70%を確実に取りたい", icon: "🎯" },
              { value: "high", label: "80%以上の高得点を目指したい", icon: "🚀" },
              { value: "perfect", label: "90%以上の満点に近い成績を狙いたい", icon: "💯" },
              { value: "explore", label: "まずは試験内容を把握したい", icon: "🔍" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedGoal(option.value)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                  selectedGoal === option.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{option.icon}</span>
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "学習時間",
      description: "1日にどれくらい学習できますか？",
      content: (
        <div>
          <h3 className="text-xl font-bold mb-6 text-center">
            1日の学習時間を教えてください
          </h3>
          <div className="space-y-3">
            {[
              { value: "30min", label: "30分以下", description: "超効率重視の学習", icon: "⚡" },
              { value: "1hour", label: "1時間程度", description: "バランス型の学習", icon: "⏰" },
              { value: "2hours", label: "2時間程度", description: "しっかり型の学習", icon: "📚" },
              { value: "flexible", label: "日によって異なる", description: "フレキシブルな学習", icon: "🔄" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTime(option.value)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedTime === option.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "現在のレベル",
      description: "金融規制の知識レベルは？",
      content: (
        <div>
          <h3 className="text-xl font-bold mb-6 text-center">
            UK金融規制についての現在の知識レベルは？
          </h3>
          <div className="space-y-3">
            {[
              { value: "beginner", label: "初心者", description: "金融規制について初めて学習する", icon: "🌱" },
              { value: "intermediate", label: "中級者", description: "基礎知識はあるが、UK規制は初めて", icon: "🌿" },
              { value: "advanced", label: "上級者", description: "UK金融規制の実務経験がある", icon: "🌳" },
              { value: "refresher", label: "復習", description: "以前学習したことがある", icon: "🔄" }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedLevel(option.value)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedLevel === option.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "準備完了！",
      description: "学習を始めましょう",
      content: (
        <div className="text-center">
          <div className="bg-green-100 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4">
            設定が完了しました！
          </h2>
          <p className="text-gray-600 mb-6">
            あなたに最適な学習プランを作成しました。
            <br />
            今すぐ学習を始めましょう！
          </p>
          <div className="bg-indigo-50 p-4 rounded-lg text-left max-w-md mx-auto">
            <h3 className="font-bold mb-2">あなたの学習プラン</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• 目標: {getGoalText(selectedGoal)}</li>
              <li>• 学習時間: {getTimeText(selectedTime)}</li>
              <li>• レベル: {getLevelText(selectedLevel)}</li>
              <li>• 推奨コース: {getRecommendedCourse()}</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save preferences and redirect to dashboard
      const preferences = {
        goal: selectedGoal,
        dailyTime: selectedTime,
        level: selectedLevel,
        recommendedCourse: getRecommendedCourse()
      };
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return selectedGoal !== "";
    if (currentStep === 2) return selectedTime !== "";
    if (currentStep === 3) return selectedLevel !== "";
    return true;
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-2 mx-1 rounded-full transition-all ${
                  index <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center">
            ステップ {currentStep + 1} / {steps.length}
          </p>
        </div>

        {/* Content */}
        <div className="mb-8">
          {currentStepData.content}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg ${
              currentStep === 0
                ? 'invisible'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              canProceed()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {currentStep === steps.length - 1 ? '学習を開始' : '次へ'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}