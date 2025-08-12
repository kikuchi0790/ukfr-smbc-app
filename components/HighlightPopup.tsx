import { useState } from 'react';
import { Highlighter, StickyNote, X } from 'lucide-react';
import { HighlightColor } from '@/types';

interface HighlightPopupProps {
  position: { x: number; y: number };
  onSelectColor: (color: HighlightColor) => void;
  onClose: () => void;
  onNote: () => void;
}

export default function HighlightPopup({ position, onSelectColor, onClose, onNote }: HighlightPopupProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');

  const colors: { color: HighlightColor; bg: string; hover: string }[] = [
    { color: 'yellow', bg: 'bg-yellow-300', hover: 'hover:bg-yellow-400' },
    { color: 'green', bg: 'bg-green-300', hover: 'hover:bg-green-400' },
    { color: 'red', bg: 'bg-red-300', hover: 'hover:bg-red-400' },
    { color: 'blue', bg: 'bg-blue-300', hover: 'hover:bg-blue-400' },
  ];

  const handleColorSelect = (color: HighlightColor) => {
    onSelectColor(color);
    onClose();
  };

  return (
    <div
      className="highlight-popup absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {!showNoteInput ? (
        <div className="flex items-center gap-1">
          <div className="flex gap-1">
            {colors.map(({ color, bg, hover }) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded ${bg} ${hover} transition-colors flex items-center justify-center`}
                data-color={color}
                title={`${color}でハイライト`}
              >
                <Highlighter className="w-4 h-4 text-gray-700" />
              </button>
            ))}
          </div>
          <div className="w-px h-8 bg-gray-300 mx-1" />
          <button
            onClick={onNote}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="ノートを追加"
          >
            <StickyNote className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="閉じる"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <div className="w-64">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ノートを入力..."
            className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                // ノート付きでハイライトを作成
                onSelectColor('yellow'); // デフォルトは黄色
                onClose();
              }}
              className="flex-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              保存
            </button>
            <button
              onClick={() => {
                setShowNoteInput(false);
                setNote('');
              }}
              className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}