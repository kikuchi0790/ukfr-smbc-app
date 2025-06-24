import { useEffect, useState } from 'react';
import { Check, Save, AlertCircle } from 'lucide-react';

interface SaveStatusIndicatorProps {
  hasUnsavedChanges: boolean;
  lastSaveTime?: Date;
}

export default function SaveStatusIndicator({ 
  hasUnsavedChanges, 
  lastSaveTime 
}: SaveStatusIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!hasUnsavedChanges && lastSaveTime) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, lastSaveTime]);

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-400">
        <Save className="w-4 h-4 animate-pulse" />
        <span>保存中...</span>
      </div>
    );
  }

  if (showSaved) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <Check className="w-4 h-4" />
        <span>保存済み</span>
      </div>
    );
  }

  return null;
}