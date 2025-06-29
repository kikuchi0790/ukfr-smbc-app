import React, { useState } from 'react';

interface NoteEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

function NoteEditor({ initialContent, onSave, onCancel }: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="p-4 bg-gray-800 text-white rounded-lg shadow-lg">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-32 p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">
          Cancel
        </button>
        <button onClick={() => onSave(content)} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">
          Save
        </button>
      </div>
    </div>
  );
}

export default React.memo(NoteEditor);
