# コード重複リファクタリング計画

## 概要
similarity-tsによる分析の結果、92個の重複ペアが検出されました。特に以下の領域で顕著な重複が見られます：

1. **3Dビルディング作成関数** (最大79.50%の類似度)
2. **エラーハンドリングとバリデーション処理**
3. **Firebase同期関連の処理**
4. **進捗管理とデータマージ処理**

## 優先度1: 高影響度リファクタリング

### 1. 3Dビルディング作成の抽象化
**対象ファイル:**
- `utils/background.tsx`
- `components/BigBenShowcase.tsx`
- `components/WireframeBuildings3D.tsx`

**問題点:**
- createBigBen_three と createEiffelTower_three が79.50%の類似度（172.5ポイント）
- 各ビルディング作成関数で同じパターンが繰り返されている

**リファクタリング案:**
```typescript
// utils/3d-building-factory.ts
interface BuildingConfig {
  type: 'tower' | 'monument' | 'gate';
  levels: LevelConfig[];
  colors: { building: string; accent: string; };
}

interface LevelConfig {
  visibility: number; // 0-100%での表示閾値
  elements: BuildingElement[];
}

class Building3DFactory {
  static create(config: BuildingConfig): THREE.Group {
    const group = new THREE.Group();
    // 共通のビルディング作成ロジック
    return group;
  }
}
```

### 2. 進捗データマージ処理の統一化
**対象ファイル:**
- `utils/data-migration.ts`
- `services/firebase-sync.ts`
- `app/study/mock-result/page.tsx`

**問題点:**
- mergeProgressData, mergeIncorrectQuestions, mergeOvercomeQuestions で類似したマージロジック
- 配列の日付ベースマージが複数箇所に散在

**リファクタリング案:**
```typescript
// utils/data-merge-utils.ts
export class DataMerger {
  static mergeByDate<T extends { date: string }>(
    local: T[],
    remote: T[],
    uniqueKey: keyof T
  ): T[] {
    // 統一されたマージロジック
  }

  static mergeProgress(local: UserProgress, remote: UserProgress): UserProgress {
    // 進捗データ専用のマージロジック
  }
}
```

## 優先度2: 中影響度リファクタリング

### 3. バリデーション処理の共通化
**対象ファイル:**
- `utils/progress-validator.ts`
- `services/keyword-extraction.ts`
- `scripts/add-page-markers.js`

**問題点:**
- バリデーションパターンが複数箇所で重複
- エラーハンドリングの一貫性がない

**リファクタリング案:**
```typescript
// utils/validators.ts
export class Validators {
  static validateProgress(data: unknown): UserProgress | null {
    // 共通バリデーションロジック
  }

  static validateWithSchema<T>(data: unknown, schema: Schema): T | null {
    // スキーマベースの汎用バリデーション
  }
}
```

### 4. ローカルストレージ操作の統一化
**対象ファイル:**
- `utils/storage-utils.ts`
- `app/study/session/page.tsx`
- `app/study/mock-result/page.tsx`

**問題点:**
- localStorage操作が各所に散在
- エラーハンドリングが不統一

**リファクタリング案:**
```typescript
// services/storage-service.ts
export class StorageService {
  private static instance: StorageService;
  
  static getInstance(): StorageService {
    if (!this.instance) {
      this.instance = new StorageService();
    }
    return this.instance;
  }

  async save<T>(key: string, data: T): Promise<void> {
    // 統一された保存処理
  }

  async load<T>(key: string): Promise<T | null> {
    // 統一された読み込み処理
  }
}
```

## 優先度3: 低影響度リファクタリング

### 5. 質問フィルタリング処理の共通化
**対象:**
- `app/study/mock-review/page.tsx:getFilteredQuestions`
- `utils/study-utils.ts`

**リファクタリング案:**
```typescript
// utils/question-filters.ts
export class QuestionFilter {
  static byCategory(questions: Question[], category: Category): Question[] {}
  static byIncorrect(questions: Question[], incorrectIds: string[]): Question[] {}
  static random(questions: Question[], count: number): Question[] {}
}
```

### 6. 時間フォーマット処理の統一化
**対象:**
- `app/study/mock-result/page.tsx:formatTime`
- その他時間表示箇所

**リファクタリング案:**
```typescript
// utils/formatters.ts
export class Formatters {
  static time(seconds: number): string {}
  static date(date: Date | string): string {}
  static percentage(value: number): string {}
}
```

## 実装スケジュール

### Phase 1 (即座に実施)
1. 3Dビルディング作成の抽象化
2. 進捗データマージ処理の統一化

### Phase 2 (次のスプリント)
3. バリデーション処理の共通化
4. ローカルストレージ操作の統一化

### Phase 3 (余裕があれば)
5. 質問フィルタリング処理の共通化
6. 時間フォーマット処理の統一化

## 期待される効果

1. **コード量の削減**: 約30%のコード削減が見込まれる
2. **保守性の向上**: 変更箇所が1箇所に集約される
3. **バグの削減**: 重複コードによる不整合がなくなる
4. **テストカバレッジの向上**: 共通化により単体テストが書きやすくなる

## 注意事項

- リファクタリング時は必ず既存のテストを通すこと
- 段階的に実施し、各段階でデプロイ可能な状態を保つこと
- パフォーマンスへの影響を測定すること