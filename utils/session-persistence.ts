import { StudySession, Question, UserProgress } from '@/types';
import { safeLocalStorage, getUserKey } from './storage-utils';

export interface SessionState {
  mode: string;
  category?: string;
  part?: string;
  studyMode?: string;
  questionCount?: string;
  session: StudySession;
  questionIds?: string[]; // 後方互換性のため残す
  questions?: Question[]; // v2: 完全な質問オブジェクトを保存
  currentQuestionId?: string; // v2: 現在の質問IDを保存して検証用
  mockAnswers?: Array<[string, string]>;
  showJapanese: boolean;
  currentQuestionIndex: number;
  selectedAnswer?: string;
  showResult?: boolean;
  savedAt: string;
  version: number; // データ形式のバージョン管理
}

const CURRENT_VERSION = 2;
const SESSION_KEY = 'activeStudySession';
const AUTOSAVE_INTERVAL = 30000; // 30秒
const ANSWER_THRESHOLD = 5; // 5問ごとに自動保存

export class SessionPersistence {
  private static instance: SessionPersistence;
  private autosaveTimer: NodeJS.Timeout | null = null;
  private answerCount: number = 0;
  private isSaving: boolean = false;
  private saveQueue: (() => void)[] = [];
  public hasPerformedDataSync: boolean = false;

  private constructor() {
    // ブラウザイベントのリスナー設定
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  static getInstance(): SessionPersistence {
    if (!SessionPersistence.instance) {
      SessionPersistence.instance = new SessionPersistence();
    }
    return SessionPersistence.instance;
  }

  // セッション状態を保存
  async saveSession(
    session: StudySession,
    questions: Question[],
    currentQuestionIndex: number,
    mockAnswers?: Map<string, string>,
    showJapanese: boolean = true,
    selectedAnswer?: string,
    showResult?: boolean,
    mode?: string,
    category?: string,
    part?: string,
    studyMode?: string,
    questionCount?: string,
    userId?: string
  ): Promise<boolean> {
    if (this.isSaving) {
      // 保存中の場合はキューに追加
      return new Promise((resolve) => {
        this.saveQueue.push(() => {
          this.saveSession(
            session, questions, currentQuestionIndex, mockAnswers,
            showJapanese, selectedAnswer, showResult, mode, category,
            part, studyMode, questionCount, userId
          ).then(resolve);
        });
      });
    }

    this.isSaving = true;

    try {
      const sessionState: SessionState = {
        mode: mode || session.mode,
        category,
        part,
        studyMode,
        questionCount,
        session: {
          ...session,
          questions: [] // questionsは除外
        },
        questions: questions, // v2: 完全な質問オブジェクトを保存
        currentQuestionId: questions[currentQuestionIndex]?.questionId, // v2: 現在の質問IDを保存
        mockAnswers: mockAnswers ? Array.from(mockAnswers.entries()) : undefined,
        showJapanese,
        currentQuestionIndex,
        selectedAnswer,
        showResult,
        savedAt: new Date().toISOString(),
        version: CURRENT_VERSION
      };

      // ストレージ容量をチェック
      const storageInfo = safeLocalStorage.getStorageInfo();
      if (storageInfo.percentage > 90) {
        // 古いセッションを削除
        this.cleanupOldSessions();
      }

      // セッション状態を保存
      safeLocalStorage.setItem(
        getUserKey(SESSION_KEY, userId || 'guest'),
        sessionState
      );
      console.log('[SessionPersistence] Session saved successfully');
      return true;
    } catch (error) {
      console.error('[SessionPersistence] Failed to save session:', error);
      return false;
    } finally {
      this.isSaving = false;
      // キューに入っている保存を実行
      if (this.saveQueue.length > 0) {
        const nextSave = this.saveQueue.shift();
        nextSave?.();
      }
    }
  }

  // セッション状態を復元
  loadSession(userId?: string): SessionState | null {
    try {
      const sessionState = safeLocalStorage.getItem<SessionState>(
        getUserKey(SESSION_KEY, userId || 'guest')
      );

      if (!sessionState) {
        return null;
      }

      // バージョンチェック - v1もサポート（後方互換性）
      if (sessionState.version !== CURRENT_VERSION && sessionState.version !== 1) {
        console.warn('[SessionPersistence] Unsupported session version');
        return null;
      }

      // セッションの有効期限をチェック（24時間）
      const savedTime = new Date(sessionState.savedAt).getTime();
      const currentTime = new Date().getTime();
      const hoursSince = (currentTime - savedTime) / (1000 * 60 * 60);

      if (hoursSince > 24) {
        console.log('[SessionPersistence] Session expired');
        this.clearSession(userId);
        return null;
      }

      return sessionState;
    } catch (error) {
      console.error('[SessionPersistence] Failed to load session:', error);
      return null;
    }
  }

  // セッションをクリア
  clearSession(userId?: string): void {
    safeLocalStorage.removeItem(getUserKey(SESSION_KEY, userId || 'guest'));
    this.stopAutosave();
    this.answerCount = 0;
  }

  // 自動保存を開始
  startAutosave(
    saveCallback: () => void,
    interval: number = AUTOSAVE_INTERVAL
  ): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => {
      console.log('[SessionPersistence] Autosaving...');
      saveCallback();
    }, interval);
  }

  // 自動保存を停止
  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  // 回答カウントをインクリメント
  incrementAnswerCount(saveCallback: () => void): void {
    this.answerCount++;
    if (this.answerCount >= ANSWER_THRESHOLD) {
      console.log('[SessionPersistence] Answer threshold reached, autosaving...');
      saveCallback();
      this.answerCount = 0;
    }
  }

  // ブラウザを閉じる前の処理
  private handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    const hasUnsavedChanges = this.checkUnsavedChanges();
    if (hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '学習中のデータが保存されていません。本当にページを離れますか？';
    }
  };

  // タブの表示状態が変わった時の処理
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // タブが非表示になった時、自動保存をトリガー
      console.log('[SessionPersistence] Tab hidden, triggering save...');
      // セッションコンポーネントから保存コールバックを呼び出す
      window.dispatchEvent(new CustomEvent('session-autosave'));
    }
  };

  // 未保存の変更があるかチェック
  private checkUnsavedChanges(): boolean {
    // セッションコンポーネントから状態を取得
    const event = new CustomEvent('check-unsaved-changes', { detail: { hasChanges: false } });
    window.dispatchEvent(event);
    return event.detail.hasChanges;
  }

  // 古いセッションをクリーンアップ
  private cleanupOldSessions(): void {
    try {
      const keys = Object.keys(localStorage);
      const sessionKeys = keys.filter(key => key.includes('activeStudySession'));
      
      // 日付でソートして古いものから削除
      const sessions = sessionKeys
        .map(key => ({
          key,
          data: safeLocalStorage.getItem<SessionState>(key)
        }))
        .filter(item => item.data)
        .sort((a, b) => {
          const dateA = new Date(a.data!.savedAt).getTime();
          const dateB = new Date(b.data!.savedAt).getTime();
          return dateA - dateB;
        });

      // 最も古いセッションを削除（現在のセッション以外）
      if (sessions.length > 1) {
        safeLocalStorage.removeItem(sessions[0].key);
        console.log('[SessionPersistence] Cleaned up old session');
      }
    } catch (error) {
      console.error('[SessionPersistence] Cleanup failed:', error);
    }
  }

  // インスタンスの破棄
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.stopAutosave();
  }
}
