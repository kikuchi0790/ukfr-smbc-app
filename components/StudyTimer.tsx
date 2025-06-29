"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { formatTime } from "@/utils/formatters";

interface StudyTimerProps {
  timeLimit: number; // 分
  onTimeUp: () => void;
  isPaused?: boolean;
}

export default function StudyTimer({ timeLimit, onTimeUp, isPaused = false }: StudyTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimit * 60);
  const [isRunning, setIsRunning] = useState(!isPaused);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds, onTimeUp]);

  const percentage = ((timeLimit * 60 - remainingSeconds) / (timeLimit * 60)) * 100;
  const formattedTime = formatTime(remainingSeconds);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-600">残り時間</span>
        </div>
        <button
          onClick={toggleTimer}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title={isRunning ? "一時停止" : "再開"}
        >
          {isRunning ? (
            <Pause className="w-4 h-4 text-gray-600" />
          ) : (
            <Play className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
      
      <div className="text-2xl font-bold text-gray-900 mb-2">
        {formattedTime}
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${
            percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {percentage > 80 && (
        <p className="text-xs text-red-600 mt-2">時間が残り少なくなっています</p>
      )}
    </div>
  );
}