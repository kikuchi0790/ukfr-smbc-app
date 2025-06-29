import React, { useEffect, useState, useMemo } from 'react';
import { MaterialMetadata, TocItem } from '@/types';

interface TableOfContentsProps {
  materialId: string;
  onJumpToPage: (pageNumber: number) => void;
}

function TableOfContents({ materialId, onJumpToPage }: TableOfContentsProps) {
  const [metadata, setMetadata] = useState<MaterialMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await fetch(`/data/materials/${materialId.replace('.pdf', '.metadata.json')}`);
        const data = await response.json();
        setMetadata(data);
      } catch (error) {
        console.error('Failed to fetch material metadata:', error);
      }
      setIsLoading(false);
    }

    fetchMetadata();
  }, [materialId]);

  const renderTocItem = (item: TocItem, level = 0) => (
    <div key={item.title} style={{ marginLeft: `${level * 20}px` }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && item.pageNumber && onJumpToPage(item.pageNumber)}>
      <button onClick={() => item.pageNumber && onJumpToPage(item.pageNumber)} className="text-left hover:underline">
        {item.title}
      </button>
      {item.children && item.children.map(child => renderTocItem(child, level + 1))}
    </div>
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!metadata) {
    return <div>Table of contents not available.</div>;
  }

  return (
    <div className="p-4 bg-gray-800 text-white" role="navigation" aria-label="Table of Contents">
      <h3 className="text-lg font-bold mb-4">Table of Contents</h3>
      {metadata.tableOfContents.map(item => renderTocItem(item))}
    </div>
  );
}

export default React.memo(TableOfContents);
