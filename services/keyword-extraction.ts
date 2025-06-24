import { Question, KeywordCache } from '@/types';
import { safeLocalStorage } from '@/utils/storage-utils';

const KEYWORD_CACHE_KEY = 'keywordCache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7日間

// クライアント側のキーワード抽出（APIを呼び出す）
export async function extractKeywords(question: Question): Promise<string[]> {
  try {
    // まずローカルキャッシュを確認
    const cachedKeywords = getKeywordsFromCache(question.questionId);
    if (cachedKeywords) {
      console.log('Keywords found in local cache:', cachedKeywords);
      return cachedKeywords;
    }

    // クライアントIDを生成（レート制限用）
    const clientId = getClientId();

    // APIを呼び出してキーワードを抽出
    const response = await fetch('/api/extract-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId: question.questionId,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        clientId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API error:', error);
      
      // エラー時はフォールバック
      return extractFallbackKeywords(question);
    }

    const data = await response.json();
    const keywords = data.keywords;

    // ローカルキャッシュに保存
    if (!data.cached) {
      saveKeywordsToCache(question.questionId, keywords);
    }

    return keywords;
  } catch (error) {
    console.error('Failed to extract keywords:', error);
    // ネットワークエラーなどの場合はフォールバック
    return extractFallbackKeywords(question);
  }
}

// フォールバックキーワード抽出（クライアント側）
function extractFallbackKeywords(question: Question): string[] {
  const keywords: string[] = [];
  const text = `${question.question} ${question.explanation}`.toLowerCase();

  // 金融規制の重要用語
  const importantTerms = [
    { term: 'FCA', fullName: 'Financial Conduct Authority' },
    { term: 'PRA', fullName: 'Prudential Regulation Authority' },
    { term: 'FSMA', fullName: 'Financial Services and Markets Act' },
    { term: 'MiFID', fullName: 'Markets in Financial Instruments Directive' },
    { term: 'COBS', fullName: 'Conduct of Business Sourcebook' },
    { term: 'SYSC', fullName: 'Senior Management Arrangements' },
    { term: 'PRIN', fullName: 'Principles for Businesses' },
    { term: 'TCF', fullName: 'Treating Customers Fairly' },
    { term: 'SMCR', fullName: 'Senior Managers and Certification Regime' },
    { term: 'client money', fullName: null },
    { term: 'client assets', fullName: null },
    { term: 'conduct risk', fullName: null },
    { term: 'prudential regulation', fullName: null },
    { term: 'approved person', fullName: null },
    { term: 'senior manager', fullName: null },
    { term: 'certification regime', fullName: null },
    { term: 'regulatory capital', fullName: null },
    { term: 'threshold conditions', fullName: null },
    { term: 'Part 4A permission', fullName: null },
  ];

  // 重要用語を検索
  for (const { term, fullName } of importantTerms) {
    if (text.includes(term.toLowerCase())) {
      keywords.push(term);
      if (keywords.length >= 2) break;
    } else if (fullName && text.includes(fullName.toLowerCase())) {
      keywords.push(term); // 略語を使用
      if (keywords.length >= 2) break;
    }
  }

  // キーワードが見つからない場合は、問題文から重要そうな単語を抽出
  if (keywords.length === 0) {
    // 大文字の略語を探す
    const acronyms = question.question.match(/\b[A-Z]{2,}\b/g);
    if (acronyms) {
      keywords.push(...new Set(acronyms).values());
    }

    // 特定のパターンを探す
    const patterns = [
      /\b(?:regulation|directive|act|rule|requirement)\s+\w+/gi,
      /\b\w+\s+(?:regime|framework|system|standard)\b/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches.slice(0, 2 - keywords.length));
        if (keywords.length >= 2) break;
      }
    }
  }

  return keywords.slice(0, 2);
}

// ローカルキャッシュ管理
function getKeywordsFromCache(questionId: string): string[] | null {
  const cache = safeLocalStorage.getItem<Record<string, KeywordCache>>(KEYWORD_CACHE_KEY) || {};
  const cached = cache[questionId];
  
  if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
    return cached.keywords;
  }
  
  return null;
}

function saveKeywordsToCache(questionId: string, keywords: string[]): void {
  const cache = safeLocalStorage.getItem<Record<string, KeywordCache>>(KEYWORD_CACHE_KEY) || {};
  
  cache[questionId] = {
    questionId,
    keywords,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CACHE_DURATION).toISOString()
  };
  
  // 古いエントリをクリーンアップ
  const now = Date.now();
  Object.keys(cache).forEach(key => {
    if (new Date(cache[key].expiresAt).getTime() < now) {
      delete cache[key];
    }
  });
  
  safeLocalStorage.setItem(KEYWORD_CACHE_KEY, cache);
}

// クライアントID管理（レート制限用）
function getClientId(): string {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}

// キーワードの検証とフィルタリング
export function validateKeywords(keywords: string[]): string[] {
  return keywords
    .filter(keyword => {
      // 空文字や短すぎる文字を除外
      if (!keyword || keyword.length < 2) return false;
      
      // 一般的すぎる単語を除外
      const commonWords = ['the', 'and', 'or', 'is', 'are', 'was', 'were', 'been', 'have', 'has'];
      if (commonWords.includes(keyword.toLowerCase())) return false;
      
      return true;
    })
    .map(keyword => keyword.trim())
    .slice(0, 2); // 最大2個
}

// バッチ処理用（複数の問題のキーワードを一度に取得）
export async function extractKeywordsBatch(questions: Question[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  // 並列処理を制限（同時に3つまで）
  const batchSize = 3;
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const promises = batch.map(async (question) => {
      const keywords = await extractKeywords(question);
      results.set(question.questionId, keywords);
    });
    
    await Promise.all(promises);
    
    // レート制限を考慮して少し待機
    if (i + batchSize < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}