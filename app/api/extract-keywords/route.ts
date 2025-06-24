import { NextRequest, NextResponse } from 'next/server';
import { extractKeywordsFromQuestion } from '@/lib/gemini';
import { KeywordCache } from '@/types';

// メモリ内キャッシュ（サーバーサイド）
const keywordCache = new Map<string, KeywordCache>();

// キャッシュの有効期限（24時間）
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// レート制限用の設定
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 1分あたりの最大リクエスト数
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの取得
    const body = await request.json();
    const { questionId, question, options, correctAnswer, explanation, clientId } = body;

    // 必須パラメータのチェック
    if (!questionId || !question || !options || !correctAnswer) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // レート制限のチェック
    const now = Date.now();
    const rateLimit = rateLimitMap.get(clientId || 'anonymous');
    
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= RATE_LIMIT) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        }
        rateLimit.count++;
      } else {
        // リセット時間を過ぎたらカウントをリセット
        rateLimit.count = 1;
        rateLimit.resetTime = now + RATE_LIMIT_WINDOW;
      }
    } else {
      // 初回リクエスト
      rateLimitMap.set(clientId || 'anonymous', {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
    }

    // キャッシュの確認
    const cached = keywordCache.get(questionId);
    if (cached && new Date(cached.expiresAt).getTime() > now) {
      console.log(`Cache hit for question ${questionId}`);
      return NextResponse.json({
        keywords: cached.keywords,
        cached: true
      });
    }

    // Gemini APIを使用してキーワードを抽出
    console.log(`Extracting keywords for question ${questionId}`);
    const keywords = await extractKeywordsFromQuestion(
      question,
      options.map((opt: any) => `${opt.letter}. ${opt.text}`),
      correctAnswer,
      explanation || ''
    );

    // キャッシュに保存
    const cacheEntry: KeywordCache = {
      questionId,
      keywords,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + CACHE_DURATION).toISOString()
    };
    keywordCache.set(questionId, cacheEntry);

    // 古いキャッシュエントリをクリーンアップ（100件を超えたら古いものから削除）
    if (keywordCache.size > 100) {
      const entries = Array.from(keywordCache.entries());
      entries.sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());
      
      // 最も古い20件を削除
      for (let i = 0; i < 20; i++) {
        keywordCache.delete(entries[i][0]);
      }
    }

    return NextResponse.json({
      keywords,
      cached: false
    });

  } catch (error) {
    console.error('Error in extract-keywords API:', error);
    
    // エラーの種類に応じて適切なステータスコードを返す
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'API configuration error' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'External API rate limit exceeded' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to extract keywords' },
      { status: 500 }
    );
  }
}

// OPTIONS リクエストのハンドリング（CORS対応）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}