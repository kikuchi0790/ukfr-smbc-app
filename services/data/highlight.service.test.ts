import { describe, it, expect, beforeEach } from 'vitest';
import HighlightService from './highlight.service';
import { safeLocalStorage } from '@/utils/storage-utils';
import { getDeviceId } from '@/utils/device-utils';

// Mock the storage utilities
vi.mock('@/utils/storage-utils', () => ({
  safeLocalStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock('@/utils/device-utils', () => ({
  getDeviceId: vi.fn(() => 'test-device'),
}));

describe('HighlightService', () => {
  let highlightService: HighlightService;
  const userId = 'test-user';

  beforeEach(() => {
    highlightService = new HighlightService(userId);
    vi.clearAllMocks();
  });

  it('should save a highlight to local storage', async () => {
    const highlightData = {
      id: 'test-highlight',
      userId,
      materialId: 'test-material',
      text: 'This is a test highlight',
      anchor: { /* ... anchor data ... */ },
      color: 'yellow',
      createdAt: new Date().toISOString(),
    };

    await highlightService.save(highlightData);

    expect(safeLocalStorage.setItem).toHaveBeenCalledWith(
      `userHighlights_${userId}`,
      expect.objectContaining({
        'test-highlight': expect.objectContaining({
          id: 'test-highlight',
          versions: {
            'test-device': 1,
          },
        }),
      })
    );
  });
});
