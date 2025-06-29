import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TableOfContents from './TableOfContents';
import { MaterialMetadata } from '@/types';

const mockMetadata: MaterialMetadata = {
  id: 'test-material.pdf',
  title: 'Test Material',
  version: '1.0.0',
  tableOfContents: [
    { title: 'Chapter 1', pageNumber: 1 },
    { title: 'Chapter 2', pageNumber: 5 },
  ],
};

global.fetch = vi.fn();

describe('TableOfContents', () => {
  beforeEach(() => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMetadata),
    });
  });

  it('should render the table of contents', async () => {
    render(<TableOfContents materialId="test-material.pdf" onJumpToPage={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    });
  });

  it('should call onJumpToPage with the correct page number when an item is clicked', async () => {
    const onJumpToPage = vi.fn();
    render(<TableOfContents materialId="test-material.pdf" onJumpToPage={onJumpToPage} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Chapter 2'));
      expect(onJumpToPage).toHaveBeenCalledWith(5);
    });
  });
});
