import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  key: string;
  description: string;
  category?: string;
}

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMockMode?: boolean;
}

export default function KeyboardHelpModal({ isOpen, onClose, isMockMode = false }: KeyboardHelpModalProps) {
  if (!isOpen) return null;

  const shortcuts: KeyboardShortcut[] = [
    // 選択肢選択
    { key: '1-4 または A-D', description: '選択肢を選択', category: '選択' },
    
    // アクション
    { key: 'Enter / Space', description: '回答を送信 / 次の問題へ', category: 'アクション' },
    { key: '← / P', description: '前の問題へ戻る', category: 'ナビゲーション' },
    { key: '→ / N', description: '次の問題へ進む', category: 'ナビゲーション' },
    
    // 機能
    { key: 'J', description: '日本語表示のON/OFF', category: '表示' },
    { key: 'M', description: '教材で詳しく確認（結果表示後）', category: '学習' },
    { key: 'Escape', description: '学習セッションを終了', category: 'システム' },
    { key: '? / Shift + /', description: 'このヘルプを表示', category: 'システム' },
  ];

  if (isMockMode) {
    shortcuts.push(
      { key: 'S', description: '試験を送信（最後の問題）', category: 'Mock試験' }
    );
  }

  // カテゴリごとにグループ化
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'その他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-gray-100">キーボードショートカット</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.key.split(' / ').map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-gray-500 mx-1">or</span>}
                            <kbd className="px-2 py-1 text-xs font-mono bg-gray-900 border border-gray-600 rounded text-gray-200">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-indigo-900/30 rounded-lg border border-indigo-700">
            <p className="text-sm text-indigo-300">
              💡 ヒント: キーボード操作中は選択した選択肢が青枠でハイライトされます。
              Enterキーまたはスペースキーで確定できます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50">
          <p className="text-center text-sm text-gray-400">
            Escapeキーまたはクリックで閉じる
          </p>
        </div>
      </div>
    </div>
  );
}