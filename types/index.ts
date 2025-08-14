export interface Question {
  id: number;
  globalId: number;
  categoryId: number;
  question: string;
  questionJa?: string; // 日本語翻訳
  options: Option[];
  correctAnswer: string;
  explanation: string;
  explanationJa?: string; // 日本語翻訳
  category: Category;
  questionId: string;
}

export interface Option {
  letter: string;
  text: string;
  textJa?: string; // 日本語翻訳
}

export type Category = 
  | "The Regulatory Environment"
  | "The Financial Services and Markets Act 2000 and Financial Services Act 2012"
  | "Associated Legislation and Regulation"
  | "The FCA Conduct of Business Sourcebook/Client Assets"
  | "Complaints and Redress"
  | "Regulations: Mock 1"
  | "Regulations: Mock 2"
  | "Regulations: Mock 3"
  | "Regulations: Mock 4"
  | "Regulations: Mock 5"
  | "Regulations: Final Study Questions";

export type StudyMode = 
  | "category"     // カテゴリ別学習（10問）
  | "mock25"       // Mock試験（25問）
  | "mock75"       // Mock試験（75問）
  | "review";      // 間違えた問題の復習

export type CategoryStudyMode = "random" | "sequential";

export interface StudySession {
  id: string;
  mode: StudyMode;
  category?: Category;
  mockPart?: 1 | 2 | 3; // Mock試験のパート番号
  startedAt: string;
  completedAt?: string;
  currentQuestionIndex: number;
  questions: Question[]; // 実行時のみ使用、保存時は除外
  questionIds?: string[]; // 保存用：問題IDのみ
  answers: Answer[];
  timeLimit?: number; // Mock試験用（分）
  showJapanese: boolean;
}

export interface Answer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
}

export interface IncorrectQuestion {
  questionId: string;
  category: Category;
  incorrectCount: number;
  lastIncorrectDate: string;
  reviewCount: number;
  source?: 'category' | 'mock';  // 問題の出所（新規追加）
  mockNumber?: number;  // Mock試験番号（Mock由来の場合）
}

// Mock試験の間違えた問題用の型
export interface MockIncorrectQuestion {
  questionId: string;
  category: Category;  // Mock 1, Mock 2など
  incorrectCount: number;
  lastIncorrectDate: string;
  reviewCount: number;
  mockNumber: number;  // Mock試験番号（1-5）
}

export interface UserProgress {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  categoryProgress: Record<Category, CategoryProgress>;
  mockCategoryProgress?: Record<Category, MockCategoryProgress>; // Mock試験専用進捗
  studySessions: StudySession[];
  incorrectQuestions: IncorrectQuestion[];  // カテゴリ別問題の間違い
  mockIncorrectQuestions?: MockIncorrectQuestion[];  // Mock試験の間違い（新規追加）
  overcomeQuestions: OvercomeQuestion[];
  mockOvercomeQuestions?: OvercomeQuestion[];  // Mock試験の克服問題（新規追加）
  currentStreak: number;
  bestStreak?: number; // 最長連続学習日数
  lastStudyDate: string;
  preferences: UserPreferences;
}

export interface OvercomeQuestion {
  questionId: string;
  category: Category;
  overcomeDate: string;
  previousIncorrectCount: number;
  reviewCount: number;
}

export interface CategoryProgress {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  lastStudyDate?: string;
}

export interface MockCategoryProgress {
  totalQuestions: number;
  attemptsCount: number;        // 受験回数
  bestScore: number;           // 最高得点
  latestScore: number;         // 最新得点
  averageScore: number;        // 平均得点
  passedCount: number;         // 合格回数 (≥70%)
  lastAttemptDate: string;     // 最終受験日
}

export interface UserPreferences {
  showJapaneseInStudy: boolean;
  showJapaneseInMock: boolean;
  autoReviewIncorrect: boolean;
  notificationEnabled: boolean;
  categoryStudyMode?: CategoryStudyMode;
}

// ハイライト関連の型定義
export interface Highlight {
  id: string;
  userId: string;
  materialId: string;
  createdAt: string;
  updatedAt: string;
  anchor: HighlightAnchor;
  text: string;
  color: HighlightColor;
  note?: {
    content: string;
    updatedAt: string;
  };
  relatedQuestionId?: string;
  versions: Record<string, number>; // { [deviceId]: version }
}

export type HighlightColor = 'yellow' | 'green' | 'red' | 'blue';

export interface HighlightAnchor {
  selector: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  beforeText: string;
  afterText: string;
  pageNumber: number;
  // Optional Web Annotation-like selectors for robust restoration
  textQuote?: {
    exact: string;
    prefix?: string;
    suffix?: string;
  };
  textPosition?: {
    start: number;
    end: number;
  };
}

export interface MaterialMetadata {
  id: string;
  title: string;
  version: string;
  tableOfContents: TocItem[];
}

export interface TocItem {
  title: string;
  pageNumber?: number;
  anchorSelector?: string;
  children?: TocItem[];
}

// キーワードキャッシュの型定義
export interface KeywordCache {
  questionId: string;
  keywords: string[];
  createdAt: string;
  expiresAt: string; // キャッシュの有効期限
}

// 教材連携のナビゲーション情報
export interface MaterialNavigationState {
  from: 'study' | 'mock' | 'review';
  sessionId: string;
  questionIndex: number;
  questionId: string;
  keywords?: string[];
  mode?: string;
  category?: string;
  part?: string;
  studyMode?: string;
  questionCount?: string;
}