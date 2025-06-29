/**
 * 質問フィルタリングユーティリティ
 * 問題の選択・フィルタリング処理を統一化
 */

import { Question, Category, IncorrectQuestion } from '@/types';
import { ensureArray, uniqueArray, isNotEmpty } from './validation-utils';
import { isValidQuestion, isValidCategory } from './type-guards';

/**
 * フィルタリングオプション
 */
export interface FilterOptions {
  includeAnswered?: boolean;
  excludeQuestionIds?: string[];
  seed?: number;
}

/**
 * カテゴリによる質問のフィルタリング
 * @param questions 全質問配列
 * @param category フィルタリングするカテゴリ
 * @param options フィルタリングオプション
 * @returns フィルタリングされた質問配列
 */
export function filterByCategory(
  questions: Question[],
  category: Category,
  options: FilterOptions = {}
): Question[] {
  if (!isValidCategory(category)) {
    console.warn('Invalid category provided:', category);
    return [];
  }

  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  
  let filtered = validQuestions.filter(q => q.category === category);

  // 除外する質問IDがある場合
  if (options.excludeQuestionIds && options.excludeQuestionIds.length > 0) {
    const excludeSet = new Set(options.excludeQuestionIds);
    filtered = filtered.filter(q => !excludeSet.has(q.questionId));
  }

  return filtered;
}

/**
 * 間違えた質問によるフィルタリング
 * @param questions 全質問配列
 * @param incorrectQuestions 間違えた質問の配列
 * @returns 間違えた質問のみの配列
 */
export function filterByIncorrect(
  questions: Question[],
  incorrectQuestions: IncorrectQuestion[]
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  const incorrectIds = new Set(
    ensureArray(incorrectQuestions).map(iq => iq.questionId)
  );

  if (incorrectIds.size === 0) {
    return [];
  }

  return validQuestions.filter(q => incorrectIds.has(q.questionId));
}

/**
 * 複数のカテゴリによるフィルタリング
 * @param questions 全質問配列
 * @param categories フィルタリングするカテゴリの配列
 * @param options フィルタリングオプション
 * @returns フィルタリングされた質問配列
 */
export function filterByCategories(
  questions: Question[],
  categories: Category[],
  options: FilterOptions = {}
): Question[] {
  const validCategories = ensureArray(categories).filter(isValidCategory);
  
  if (validCategories.length === 0) {
    return [];
  }

  const categorySet = new Set(validCategories);
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  
  let filtered = validQuestions.filter(q => categorySet.has(q.category));

  // 除外する質問IDがある場合
  if (options.excludeQuestionIds && options.excludeQuestionIds.length > 0) {
    const excludeSet = new Set(options.excludeQuestionIds);
    filtered = filtered.filter(q => !excludeSet.has(q.questionId));
  }

  return filtered;
}

/**
 * ランダムに質問を選択
 * @param questions 質問配列
 * @param count 選択する数
 * @param seed ランダムシード（オプション）
 * @returns ランダムに選択された質問配列
 */
export function selectRandom(
  questions: Question[],
  count: number,
  seed?: number
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  
  if (validQuestions.length === 0 || count <= 0) {
    return [];
  }

  // 要求された数が配列の長さより大きい場合は全てを返す
  if (count >= validQuestions.length) {
    return shuffleArray([...validQuestions], seed);
  }

  // Fisher-Yatesアルゴリズムでランダム選択
  const shuffled = shuffleArray([...validQuestions], seed);
  return shuffled.slice(0, count);
}

/**
 * 配列をシャッフル（Fisher-Yatesアルゴリズム）
 * @param array シャッフルする配列
 * @param seed ランダムシード（オプション）
 * @returns シャッフルされた配列
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  let random = seed ? seededRandom(seed) : Math.random;

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * シード付きランダム関数生成
 * @param seed シード値
 * @returns ランダム関数
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2147483647;
    return state / 2147483647;
  };
}

/**
 * 難易度による質問のフィルタリング（カテゴリIDベース）
 * @param questions 全質問配列
 * @param minCategoryId 最小カテゴリID
 * @param maxCategoryId 最大カテゴリID
 * @returns フィルタリングされた質問配列
 */
export function filterByDifficulty(
  questions: Question[],
  minCategoryId?: number,
  maxCategoryId?: number
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);

  return validQuestions.filter(q => {
    if (minCategoryId !== undefined && q.categoryId < minCategoryId) {
      return false;
    }
    if (maxCategoryId !== undefined && q.categoryId > maxCategoryId) {
      return false;
    }
    return true;
  });
}

/**
 * キーワードによる質問の検索
 * @param questions 全質問配列
 * @param keywords 検索キーワード
 * @param searchIn 検索対象フィールド
 * @returns 検索結果の質問配列
 */
export function searchQuestions(
  questions: Question[],
  keywords: string[],
  searchIn: ('question' | 'explanation' | 'options')[] = ['question', 'explanation']
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  const validKeywords = ensureArray(keywords).filter(k => isNotEmpty(k) && k.trim().length > 0);

  if (validKeywords.length === 0) {
    return validQuestions;
  }

  // キーワードを小文字に変換
  const lowerKeywords = validKeywords.map(k => k.toLowerCase());

  return validQuestions.filter(q => {
    const searchText: string[] = [];

    if (searchIn.includes('question')) {
      searchText.push(q.question.toLowerCase());
      if (q.questionJa) searchText.push(q.questionJa.toLowerCase());
    }

    if (searchIn.includes('explanation')) {
      searchText.push(q.explanation.toLowerCase());
      if (q.explanationJa) searchText.push(q.explanationJa.toLowerCase());
    }

    if (searchIn.includes('options')) {
      q.options.forEach(opt => {
        searchText.push(opt.text.toLowerCase());
        if (opt.textJa) searchText.push(opt.textJa.toLowerCase());
      });
    }

    const combinedText = searchText.join(' ');

    // すべてのキーワードが含まれているかチェック（AND検索）
    return lowerKeywords.every(keyword => combinedText.includes(keyword));
  });
}

/**
 * 重複を除去した質問配列を返す
 * @param questions 質問配列
 * @returns 重複を除去した質問配列
 */
export function removeDuplicates(questions: Question[]): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  return uniqueArray(validQuestions, q => q.questionId);
}

/**
 * 質問を日付でソート
 * @param questions 質問配列
 * @param order ソート順（'asc' | 'desc'）
 * @returns ソートされた質問配列
 */
export function sortByGlobalId(
  questions: Question[],
  order: 'asc' | 'desc' = 'asc'
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  
  return [...validQuestions].sort((a, b) => {
    const diff = a.globalId - b.globalId;
    return order === 'asc' ? diff : -diff;
  });
}

/**
 * 解答済みの質問を除外
 * @param questions 全質問配列
 * @param answeredQuestionIds 解答済み質問IDのセット
 * @returns 未解答の質問配列
 */
export function excludeAnswered(
  questions: Question[],
  answeredQuestionIds: Set<string> | string[]
): Question[] {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  const answeredSet = answeredQuestionIds instanceof Set 
    ? answeredQuestionIds 
    : new Set(ensureArray(answeredQuestionIds));

  if (answeredSet.size === 0) {
    return validQuestions;
  }

  return validQuestions.filter(q => !answeredSet.has(q.questionId));
}

/**
 * 質問のページネーション
 * @param questions 質問配列
 * @param page ページ番号（1から開始）
 * @param pageSize ページサイズ
 * @returns ページネーションされた質問配列と情報
 */
export function paginate(
  questions: Question[],
  page: number,
  pageSize: number
): {
  questions: Question[];
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
} {
  const validQuestions = ensureArray(questions).filter(isValidQuestion);
  const totalPages = Math.ceil(validQuestions.length / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    questions: validQuestions.slice(startIndex, endIndex),
    totalPages,
    currentPage,
    hasNext: currentPage < totalPages,
    hasPrevious: currentPage > 1
  };
}

/**
 * クエリベースの高度なフィルタリング
 */
export interface QueryFilter {
  categories?: Category[];
  excludeCategories?: Category[];
  minCategoryId?: number;
  maxCategoryId?: number;
  keywords?: string[];
  excludeAnswered?: boolean;
  answeredQuestionIds?: Set<string> | string[];
  excludeQuestionIds?: string[];
  limit?: number;
  offset?: number;
  randomize?: boolean;
  seed?: number;
}

/**
 * クエリベースの高度な質問フィルタリング
 * @param questions 全質問配列
 * @param query クエリフィルター
 * @returns フィルタリングされた質問配列
 */
export function filterByQuery(
  questions: Question[],
  query: QueryFilter
): Question[] {
  let result = ensureArray(questions).filter(isValidQuestion);

  // カテゴリフィルター
  if (query.categories && query.categories.length > 0) {
    result = filterByCategories(result, query.categories);
  }

  // カテゴリ除外フィルター
  if (query.excludeCategories && query.excludeCategories.length > 0) {
    const excludeSet = new Set(query.excludeCategories);
    result = result.filter(q => !excludeSet.has(q.category));
  }

  // 難易度フィルター
  if (query.minCategoryId !== undefined || query.maxCategoryId !== undefined) {
    result = filterByDifficulty(result, query.minCategoryId, query.maxCategoryId);
  }

  // キーワード検索
  if (query.keywords && query.keywords.length > 0) {
    result = searchQuestions(result, query.keywords);
  }

  // 解答済み除外
  if (query.excludeAnswered && query.answeredQuestionIds) {
    result = excludeAnswered(result, query.answeredQuestionIds);
  }

  // 特定の質問ID除外
  if (query.excludeQuestionIds && query.excludeQuestionIds.length > 0) {
    const excludeSet = new Set(query.excludeQuestionIds);
    result = result.filter(q => !excludeSet.has(q.questionId));
  }

  // ランダマイズ
  if (query.randomize) {
    result = shuffleArray(result, query.seed);
  }

  // オフセットとリミット
  if (query.offset !== undefined && query.offset > 0) {
    result = result.slice(query.offset);
  }

  if (query.limit !== undefined && query.limit > 0) {
    result = result.slice(0, query.limit);
  }

  return result;
}