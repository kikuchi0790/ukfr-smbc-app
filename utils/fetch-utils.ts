export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const attemptFetch = async (attemptsLeft: number): Promise<Response> => {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        cache: 'no-cache', // キャッシュを無効化
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new FetchError(
          `HTTPエラー: ${response.status}`,
          response.status,
          response.statusText
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // 中断された場合
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FetchError('リクエストがタイムアウトしました');
      }

      // 再試行可能なエラーか判断
      const isRetryable = 
        error instanceof FetchError && 
        error.status && 
        (error.status >= 500 || error.status === 429);

      // ネットワークエラーまたは再試行可能なエラーの場合
      if (attemptsLeft > 0 && (!(error instanceof FetchError) || isRetryable)) {
        console.log(`Retrying... (${attemptsLeft} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptFetch(attemptsLeft - 1);
      }

      // オフラインの可能性
      if (!navigator.onLine) {
        throw new FetchError('インターネット接続がありません');
      }

      // その他のエラー
      if (error instanceof FetchError) {
        throw error;
      }

      throw new FetchError('ネットワークエラーが発生しました');
    }
  };

  return attemptFetch(retries);
}

export async function fetchJSON<T = any>(
  url: string,
  options?: FetchOptions
): Promise<T> {
  try {
    const response = await fetchWithRetry(url, options);
    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }
    throw new FetchError('データの解析に失敗しました');
  }
}