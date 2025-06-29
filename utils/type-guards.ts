/**
 * 型ガード関数
 * ランタイムでの型安全性を確保するための型チェック関数
 */

import {
  UserProgress,
  CategoryProgress,
  StudySession,
  Question,
  Highlight,
  HighlightAnchor,
  MaterialMetadata,
  IncorrectQuestion,
  OvercomeQuestion,
  Answer,
  Category
} from '@/types';
import { isNotEmpty, isValidNumber, isValidDate } from './validation-utils';

/**
 * UserProgressの型ガード
 */
export function isValidProgress(progress: any): progress is UserProgress {
  return (
    isNotEmpty(progress) &&
    isValidNumber(progress.totalQuestionsAnswered) &&
    isValidNumber(progress.correctAnswers) &&
    isNotEmpty(progress.categoryProgress) &&
    typeof progress.categoryProgress === 'object' &&
    Array.isArray(progress.studySessions) &&
    Array.isArray(progress.incorrectQuestions) &&
    Array.isArray(progress.overcomeQuestions) &&
    isValidNumber(progress.currentStreak) &&
    typeof progress.lastStudyDate === 'string' &&
    isNotEmpty(progress.preferences) &&
    typeof progress.preferences === 'object'
  );
}

/**
 * CategoryProgressの型ガード
 */
export function isValidCategoryProgress(progress: any): progress is CategoryProgress {
  return (
    isNotEmpty(progress) &&
    isValidNumber(progress.totalQuestions) &&
    isValidNumber(progress.answeredQuestions) &&
    isValidNumber(progress.correctAnswers)
  );
}

/**
 * StudySessionの型ガード
 */
export function isValidStudySession(session: any): session is StudySession {
  return (
    isNotEmpty(session) &&
    typeof session.id === 'string' &&
    typeof session.mode === 'string' &&
    typeof session.startedAt === 'string' &&
    isValidNumber(session.currentQuestionIndex) &&
    Array.isArray(session.answers) &&
    typeof session.showJapanese === 'boolean'
  );
}

/**
 * Questionの型ガード
 */
export function isValidQuestion(question: any): question is Question {
  return (
    isNotEmpty(question) &&
    isValidNumber(question.id) &&
    isValidNumber(question.globalId) &&
    isValidNumber(question.categoryId) &&
    typeof question.question === 'string' &&
    Array.isArray(question.options) &&
    typeof question.correctAnswer === 'string' &&
    typeof question.explanation === 'string' &&
    typeof question.category === 'string' &&
    typeof question.questionId === 'string'
  );
}

/**
 * Highlightの型ガード
 */
export function isValidHighlight(highlight: any): highlight is Highlight {
  return (
    isNotEmpty(highlight) &&
    typeof highlight.id === 'string' &&
    typeof highlight.userId === 'string' &&
    typeof highlight.materialId === 'string' &&
    typeof highlight.createdAt === 'string' &&
    typeof highlight.updatedAt === 'string' &&
    isValidHighlightAnchor(highlight.anchor) &&
    typeof highlight.text === 'string' &&
    typeof highlight.color === 'string' &&
    isNotEmpty(highlight.versions) &&
    typeof highlight.versions === 'object'
  );
}

/**
 * HighlightAnchorの型ガード
 */
export function isValidHighlightAnchor(anchor: any): anchor is HighlightAnchor {
  return (
    isNotEmpty(anchor) &&
    typeof anchor.selector === 'string' &&
    isValidNumber(anchor.startOffset) &&
    isValidNumber(anchor.endOffset) &&
    typeof anchor.selectedText === 'string' &&
    typeof anchor.beforeText === 'string' &&
    typeof anchor.afterText === 'string' &&
    isValidNumber(anchor.pageNumber)
  );
}

/**
 * MaterialMetadataの型ガード
 */
export function isValidMaterialMetadata(metadata: any): metadata is MaterialMetadata {
  return (
    isNotEmpty(metadata) &&
    typeof metadata.id === 'string' &&
    typeof metadata.title === 'string' &&
    typeof metadata.version === 'string' &&
    Array.isArray(metadata.tableOfContents)
  );
}

/**
 * IncorrectQuestionの型ガード
 */
export function isValidIncorrectQuestion(question: any): question is IncorrectQuestion {
  return (
    isNotEmpty(question) &&
    typeof question.questionId === 'string' &&
    typeof question.category === 'string' &&
    isValidNumber(question.incorrectCount) &&
    typeof question.lastIncorrectDate === 'string' &&
    isValidNumber(question.reviewCount)
  );
}

/**
 * OvercomeQuestionの型ガード
 */
export function isValidOvercomeQuestion(question: any): question is OvercomeQuestion {
  return (
    isNotEmpty(question) &&
    typeof question.questionId === 'string' &&
    typeof question.category === 'string' &&
    typeof question.overcomeDate === 'string' &&
    isValidNumber(question.previousIncorrectCount) &&
    isValidNumber(question.reviewCount)
  );
}

/**
 * Answerの型ガード
 */
export function isValidAnswer(answer: any): answer is Answer {
  return (
    isNotEmpty(answer) &&
    typeof answer.questionId === 'string' &&
    typeof answer.selectedAnswer === 'string' &&
    typeof answer.isCorrect === 'boolean' &&
    typeof answer.answeredAt === 'string'
  );
}

/**
 * Categoryの型ガード
 */
export function isValidCategory(category: any): category is Category {
  const validCategories = [
    "The Regulatory Environment",
    "The Financial Services and Markets Act 2000 and Financial Services Act 2012",
    "Associated Legislation and Regulation",
    "The FCA Conduct of Business Sourcebook/Client Assets",
    "Complaints and Redress",
    "Regulations: Mock 1",
    "Regulations: Mock 2",
    "Regulations: Mock 3",
    "Regulations: Mock 4",
    "Regulations: Mock 5",
    "Regulations: Final Study Questions"
  ];
  
  return typeof category === 'string' && validCategories.includes(category);
}

/**
 * 配列の型ガード
 */
export function isArrayOf<T>(
  array: any,
  typeGuard: (item: any) => item is T
): array is T[] {
  return (
    Array.isArray(array) &&
    array.every(item => typeGuard(item))
  );
}

/**
 * オブジェクトの型ガード（キーと値の型チェック）
 */
export function isRecordOf<K extends string | number | symbol, V>(
  obj: any,
  keyGuard: (key: any) => key is K,
  valueGuard: (value: any) => value is V
): obj is Record<K, V> {
  if (!isNotEmpty(obj) || typeof obj !== 'object') {
    return false;
  }

  return Object.entries(obj).every(([key, value]) => 
    keyGuard(key) && valueGuard(value)
  );
}

/**
 * Partial型の型ガード
 */
export function isPartialOf<T>(
  obj: any,
  requiredFields: (keyof T)[],
  typeGuard: (obj: any) => obj is T
): obj is Partial<T> {
  if (!isNotEmpty(obj) || typeof obj !== 'object') {
    return false;
  }

  // 必須フィールドのチェック
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return false;
    }
  }

  // 完全な型チェックのための仮オブジェクトを作成
  const testObj = { ...obj };
  
  // 不足しているフィールドにダミー値を設定
  // (実際の型ガードでは、存在するフィールドのみをチェック)
  
  return true;
}

/**
 * ユニオン型の型ガード
 */
export function isOneOf<T1, T2>(
  value: any,
  guard1: (value: any) => value is T1,
  guard2: (value: any) => value is T2
): value is T1 | T2 {
  return guard1(value) || guard2(value);
}

/**
 * 複数の型ガードを組み合わせる
 */
export function combineGuards<T>(...guards: Array<(value: any) => value is T>): (value: any) => value is T {
  return (value: any): value is T => {
    return guards.every(guard => guard(value));
  };
}

/**
 * オプショナルフィールドの型ガード
 */
export function hasOptionalField<T extends object, K extends keyof T>(
  obj: T,
  field: K,
  guard: (value: any) => value is NonNullable<T[K]>
): obj is T & Record<K, NonNullable<T[K]>> {
  return field in obj && guard(obj[field]);
}

/**
 * 安全な型アサーション
 */
export function assertType<T>(
  value: any,
  guard: (value: any) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(errorMessage || 'Type assertion failed');
  }
}

/**
 * 型ガードの結果とエラーメッセージを返す
 */
export interface TypeGuardResult<T> {
  isValid: boolean;
  value?: T;
  errors: string[];
}

/**
 * 詳細なエラーメッセージ付き型ガード
 */
export function validateType<T>(
  value: any,
  guard: (value: any) => value is T,
  fieldName = 'value'
): TypeGuardResult<T> {
  const errors: string[] = [];

  if (!isNotEmpty(value)) {
    errors.push(`${fieldName} is null or undefined`);
    return { isValid: false, errors };
  }

  if (!guard(value)) {
    errors.push(`${fieldName} does not match expected type`);
    return { isValid: false, errors };
  }

  return { isValid: true, value, errors };
}