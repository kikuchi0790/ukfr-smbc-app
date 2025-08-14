import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string | string[];
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
  enabled?: boolean;
}

interface UseKeyboardNavigationOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * キーボードナビゲーションのカスタムフック
 * 学習セッションでのキーボード操作を管理
 */
export function useKeyboardNavigation({
  shortcuts,
  enabled = true,
  preventDefault = true
}: UseKeyboardNavigationOptions) {
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);

  // ショートカットを更新
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // 入力フィールドにフォーカスがある場合はスキップ
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true') {
      return;
    }

    // ショートカットをチェック
    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;

      // 修飾キーをチェック
      if (shortcut.ctrl && !e.ctrlKey) continue;
      if (shortcut.alt && !e.altKey) continue;
      if (shortcut.shift && !e.shiftKey) continue;
      if (shortcut.meta && !e.metaKey) continue;

      // キーをチェック
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      const keyMatches = keys.some(key => {
        // 数字キーとテンキーの両方をサポート
        if (key >= '1' && key <= '9') {
          return e.key === key || e.code === `Digit${key}` || e.code === `Numpad${key}`;
        }
        // アルファベットキー（大文字小文字を無視）
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
          return e.key.toLowerCase() === key.toLowerCase();
        }
        // その他のキー
        return e.key === key || e.code === key;
      });

      if (keyMatches) {
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        shortcut.handler(e);
        break;
      }
    }
  }, [enabled, preventDefault]);

  useEffect(() => {
    if (!enabled) return;

    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);

    // クリーンアップ
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // ショートカットヘルプ用のデータを返す
  const getShortcutHelp = useCallback(() => {
    return shortcutsRef.current
      .filter(s => s.description && s.enabled !== false)
      .map(s => ({
        key: Array.isArray(s.key) ? s.key.join(' / ') : s.key,
        description: s.description!,
        modifiers: [
          s.ctrl && 'Ctrl',
          s.alt && 'Alt',
          s.shift && 'Shift',
          s.meta && (navigator.platform.includes('Mac') ? 'Cmd' : 'Win')
        ].filter(Boolean).join(' + ')
      }));
  }, []);

  return {
    getShortcutHelp
  };
}

/**
 * 学習セッション用のデフォルトショートカット
 */
export const DEFAULT_STUDY_SHORTCUTS = {
  // 選択肢選択
  SELECT_OPTION_1: ['1', 'a', 'A'],
  SELECT_OPTION_2: ['2', 'b', 'B'],
  SELECT_OPTION_3: ['3', 'c', 'C'],
  SELECT_OPTION_4: ['4', 'd', 'D'],
  
  // アクション
  SUBMIT_ANSWER: ['Enter', ' '], // Enter または Space
  NEXT_QUESTION: ['ArrowRight', 'n', 'N'],
  PREV_QUESTION: ['ArrowLeft', 'p', 'P'],
  
  // 機能
  TOGGLE_JAPANESE: ['j', 'J'],
  CHECK_MATERIALS: ['m', 'M'],
  EXIT_SESSION: ['Escape'],
  SHOW_HELP: ['?', '/'], // Shift + / = ?
};