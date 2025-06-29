/**
 * フォーマッターユーティリティ
 * 時間、日付、数値などの表示形式を統一化
 */

import { isValidDate, isValidNumber, isNotEmpty } from './validation-utils';

/**
 * 秒数を時間形式（MM:SS または HH:MM:SS）に変換
 * @param seconds 秒数
 * @param forceHours 常に時間を表示するか
 * @returns フォーマットされた時間文字列
 */
export function formatTime(seconds: number, forceHours: boolean = false): string {
  if (!isValidNumber(seconds) || seconds < 0) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0 || forceHours) {
    return `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(secs)}`;
  }

  return `${padNumber(minutes)}:${padNumber(secs)}`;
}

/**
 * ミリ秒を時間形式に変換
 * @param milliseconds ミリ秒
 * @param forceHours 常に時間を表示するか
 * @returns フォーマットされた時間文字列
 */
export function formatMilliseconds(milliseconds: number, forceHours: boolean = false): string {
  return formatTime(Math.floor(milliseconds / 1000), forceHours);
}

/**
 * 残り時間を表示用にフォーマット
 * @param remainingSeconds 残り秒数
 * @returns フォーマットされた残り時間文字列
 */
export function formatRemainingTime(remainingSeconds: number): string {
  if (!isValidNumber(remainingSeconds) || remainingSeconds < 0) {
    return '終了';
  }

  if (remainingSeconds < 60) {
    return `残り ${Math.floor(remainingSeconds)} 秒`;
  }

  const formatted = formatTime(remainingSeconds);
  return `残り ${formatted}`;
}

/**
 * 経過時間を表示用にフォーマット
 * @param elapsedSeconds 経過秒数
 * @returns フォーマットされた経過時間文字列
 */
export function formatElapsedTime(elapsedSeconds: number): string {
  if (!isValidNumber(elapsedSeconds) || elapsedSeconds < 0) {
    return '0秒';
  }

  if (elapsedSeconds < 60) {
    return `${Math.floor(elapsedSeconds)}秒`;
  }

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = Math.floor(elapsedSeconds % 60);

  let parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}時間`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}分`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}秒`);
  }

  return parts.join('');
}

/**
 * 日付をフォーマット
 * @param date 日付（Date、string、number）
 * @param format フォーマット形式
 * @returns フォーマットされた日付文字列
 */
export function formatDate(
  date: Date | string | number,
  format: 'full' | 'date' | 'time' | 'relative' = 'full'
): string {
  let dateObj: Date;

  if (typeof date === 'string' || typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (!isValidDate(dateObj)) {
    return '無効な日付';
  }

  const options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case 'date':
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    case 'relative':
      return formatRelativeDate(dateObj);
    case 'full':
    default:
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
  }

  return dateObj.toLocaleString('ja-JP', options);
}

/**
 * 相対的な日付表示（今日、昨日、○日前など）
 * @param date 日付
 * @returns 相対的な日付文字列
 */
export function formatRelativeDate(date: Date | string | number): string {
  let dateObj: Date;

  if (typeof date === 'string' || typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (!isValidDate(dateObj)) {
    return '無効な日付';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return '今日';
  } else if (diffDays === 1) {
    return '昨日';
  } else if (diffDays === -1) {
    return '明日';
  } else if (diffDays > 0 && diffDays <= 7) {
    return `${diffDays}日前`;
  } else if (diffDays < 0 && diffDays >= -7) {
    return `${Math.abs(diffDays)}日後`;
  } else {
    return formatDate(dateObj, 'date');
  }
}

/**
 * パーセンテージをフォーマット
 * @param value 値
 * @param total 合計
 * @param decimals 小数点以下の桁数
 * @returns フォーマットされたパーセンテージ文字列
 */
export function formatPercentage(value: number, total: number, decimals: number = 0): string {
  if (!isValidNumber(value) || !isValidNumber(total) || total === 0) {
    return '0%';
  }

  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * 数値をカンマ区切りでフォーマット
 * @param value 数値
 * @returns フォーマットされた数値文字列
 */
export function formatNumber(value: number): string {
  if (!isValidNumber(value)) {
    return '0';
  }

  return value.toLocaleString('ja-JP');
}

/**
 * ファイルサイズをフォーマット
 * @param bytes バイト数
 * @param decimals 小数点以下の桁数
 * @returns フォーマットされたサイズ文字列
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (!isValidNumber(bytes) || bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 数値を2桁にパディング
 * @param num 数値
 * @returns パディングされた文字列
 */
function padNumber(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * 連続日数をフォーマット
 * @param days 日数
 * @returns フォーマットされた連続日数文字列
 */
export function formatStreak(days: number): string {
  if (!isValidNumber(days) || days <= 0) {
    return '0日';
  }

  if (days === 1) {
    return '1日';
  }

  return `${days}日連続`;
}

/**
 * 学習時間の統計をフォーマット
 * @param totalSeconds 合計秒数
 * @returns フォーマットされた学習時間統計
 */
export function formatStudyStats(totalSeconds: number): {
  hours: number;
  minutes: number;
  formatted: string;
} {
  if (!isValidNumber(totalSeconds) || totalSeconds < 0) {
    return {
      hours: 0,
      minutes: 0,
      formatted: '0時間0分'
    };
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let formatted = '';
  if (hours > 0) {
    formatted += `${hours}時間`;
  }
  if (minutes > 0 || hours === 0) {
    formatted += `${minutes}分`;
  }

  return {
    hours,
    minutes,
    formatted
  };
}

/**
 * スコアを星評価でフォーマット
 * @param score スコア（0-100）
 * @param maxStars 最大星数
 * @returns 星評価文字列
 */
export function formatStarRating(score: number, maxStars: number = 5): string {
  if (!isValidNumber(score) || score < 0) {
    return '☆'.repeat(maxStars);
  }

  const percentage = Math.min(100, Math.max(0, score));
  const filledStars = Math.round((percentage / 100) * maxStars);
  const emptyStars = maxStars - filledStars;

  return '★'.repeat(filledStars) + '☆'.repeat(emptyStars);
}

/**
 * 順位をフォーマット
 * @param rank 順位
 * @returns フォーマットされた順位文字列
 */
export function formatRank(rank: number): string {
  if (!isValidNumber(rank) || rank <= 0) {
    return '-';
  }

  return `${rank}位`;
}

/**
 * 正答率を色付きでフォーマット
 * @param correct 正解数
 * @param total 合計数
 * @returns フォーマットされた正答率とカラークラス
 */
export function formatAccuracyWithColor(
  correct: number,
  total: number
): {
  text: string;
  colorClass: string;
  percentage: number;
} {
  if (!isValidNumber(correct) || !isValidNumber(total) || total === 0) {
    return {
      text: '0%',
      colorClass: 'text-gray-500',
      percentage: 0
    };
  }

  const percentage = (correct / total) * 100;
  let colorClass = '';

  if (percentage >= 80) {
    colorClass = 'text-green-600';
  } else if (percentage >= 60) {
    colorClass = 'text-yellow-600';
  } else {
    colorClass = 'text-red-600';
  }

  return {
    text: `${percentage.toFixed(0)}%`,
    colorClass,
    percentage
  };
}

/**
 * カテゴリ名を短縮形でフォーマット
 * @param categoryName カテゴリ名
 * @param maxLength 最大文字数
 * @returns 短縮されたカテゴリ名
 */
export function formatCategoryName(categoryName: string, maxLength: number = 20): string {
  if (!isNotEmpty(categoryName)) {
    return '';
  }

  if (categoryName.length <= maxLength) {
    return categoryName;
  }

  // 既知の略語マッピング
  const abbreviations: Record<string, string> = {
    'The Regulatory Environment': 'Regulatory Env.',
    'The Financial Services and Markets Act 2000 and Financial Services Act 2012': 'FSMA 2000/2012',
    'Associated Legislation and Regulation': 'Associated Leg.',
    'The FCA Conduct of Business Sourcebook/Client Assets': 'FCA COBS/Client',
    'Complaints and Redress': 'Complaints',
    'Regulations: Mock': 'Mock',
    'Regulations: Final Study Questions': 'Final Study'
  };

  // 略語が存在する場合はそれを使用
  for (const [full, abbr] of Object.entries(abbreviations)) {
    if (categoryName.startsWith(full)) {
      return categoryName.replace(full, abbr);
    }
  }

  // それ以外は省略記号を付けて切り詰め
  return categoryName.substring(0, maxLength - 3) + '...';
}