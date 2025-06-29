/**
 * 共通バリデーションユーティリティ
 * アプリケーション全体で使用される汎用的なバリデーション処理を提供
 */

/**
 * null/undefined安全チェック
 * @param value チェック対象の値
 * @returns 値がnullまたはundefinedでない場合true
 */
export function isNotEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * オブジェクトのプロパティを安全に初期化
 * @param obj 対象オブジェクト
 * @param key プロパティキー
 * @param defaultValue デフォルト値
 */
export function ensureProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: T[K]
): void {
  if (!obj[key]) {
    obj[key] = defaultValue;
  }
}

/**
 * 数値を指定範囲内に制限
 * @param value 制限する値
 * @param min 最小値
 * @param max 最大値
 * @returns 範囲内に制限された値
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 配列の安全な初期化
 * @param value 配列またはnull/undefined
 * @returns 配列（null/undefinedの場合は空配列）
 */
export function ensureArray<T>(value: T[] | undefined | null): T[] {
  return value || [];
}

/**
 * JSON文字列の安全なパース
 * @param text パースするJSON文字列
 * @param defaultValue パース失敗時のデフォルト値
 * @returns パースされたオブジェクトまたはデフォルト値
 */
export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return defaultValue;
  }
}

/**
 * オブジェクトの安全なプロパティアクセス
 * @param obj アクセス対象のオブジェクト
 * @param path プロパティパス（ドット区切り）
 * @param defaultValue デフォルト値
 * @returns プロパティ値またはデフォルト値
 */
export function safeGet<T>(
  obj: any,
  path: string,
  defaultValue: T
): T {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (!isNotEmpty(result) || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return isNotEmpty(result) ? result : defaultValue;
}

/**
 * 文字列の空白チェック
 * @param value チェック対象の文字列
 * @returns 空白でない場合true
 */
export function isNotBlank(value: string | null | undefined): value is string {
  return isNotEmpty(value) && value.trim().length > 0;
}

/**
 * 配列の空チェック
 * @param array チェック対象の配列
 * @returns 空でない場合true
 */
export function isNotEmptyArray<T>(array: T[] | null | undefined): array is T[] {
  return isNotEmpty(array) && array.length > 0;
}

/**
 * 数値の有効性チェック
 * @param value チェック対象の値
 * @returns 有効な数値の場合true
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 日付の有効性チェック
 * @param date チェック対象の日付
 * @returns 有効な日付の場合true
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * URLの有効性チェック
 * @param url チェック対象のURL文字列
 * @returns 有効なURLの場合true
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * メールアドレスの簡易バリデーション
 * @param email チェック対象のメールアドレス
 * @returns 有効な形式の場合true
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 範囲内の数値チェック
 * @param value チェック対象の値
 * @param min 最小値
 * @param max 最大値
 * @returns 範囲内の場合true
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * 配列のユニーク化
 * @param array ユニーク化する配列
 * @param keyFn キー生成関数（オプション）
 * @returns ユニークな要素の配列
 */
export function uniqueArray<T>(
  array: T[],
  keyFn?: (item: T) => string | number
): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set<string | number>();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * オブジェクトの深いマージ
 * @param target マージ先オブジェクト
 * @param source マージ元オブジェクト
 * @returns マージされたオブジェクト
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        isNotEmpty(sourceValue) &&
        isNotEmpty(targetValue) &&
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
        sourceValue !== null &&
        targetValue !== null &&
        !Array.isArray(sourceValue) &&
        !Array.isArray(targetValue) &&
        !((sourceValue as any) instanceof Date) &&
        !((targetValue as any) instanceof Date)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (isNotEmpty(sourceValue)) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * バリデーションルール定義
 */
export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * 複数のバリデーションルールを適用
 * @param value バリデーション対象の値
 * @param rules バリデーションルール配列
 * @returns バリデーション結果
 */
export function validate<T>(
  value: T,
  rules: ValidationRule<T>[]
): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    if (!rule.validate(value)) {
      errors.push(rule.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * よく使用されるバリデーションルール
 */
export const CommonRules = {
  required: <T>(message = 'This field is required'): ValidationRule<T> => ({
    validate: (value) => isNotEmpty(value),
    message
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => isNotEmpty(value) && value.length >= min,
    message: message || `Must be at least ${min} characters`
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length <= max,
    message: message || `Must be no more than ${max} characters`
  }),

  pattern: (regex: RegExp, message = 'Invalid format'): ValidationRule<string> => ({
    validate: (value) => !value || regex.test(value),
    message
  }),

  min: (min: number, message?: string): ValidationRule<number> => ({
    validate: (value) => isValidNumber(value) && value >= min,
    message: message || `Must be at least ${min}`
  }),

  max: (max: number, message?: string): ValidationRule<number> => ({
    validate: (value) => isValidNumber(value) && value <= max,
    message: message || `Must be no more than ${max}`
  }),

  email: (message = 'Invalid email address'): ValidationRule<string> => ({
    validate: (value) => !value || isValidEmail(value),
    message
  }),

  url: (message = 'Invalid URL'): ValidationRule<string> => ({
    validate: (value) => !value || isValidUrl(value),
    message
  })
};