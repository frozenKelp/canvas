import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasItem } from '../../domain/realtime';
import { ItemContent } from './ItemContent';

describe('ItemContent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('falls back when a website preview takes too long', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_LINK_PREVIEW_ENDPOINT', 'https://preview.test/preview');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );

    render(
      <ItemContent
        item={makeItem({
          primaryUrl: 'https://example.com/story',
          embedKind: 'website',
          contentText: 'https://example.com/story'
        })}
      />
    );

    expect(screen.getByText('fetching preview')).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText('preview unavailable')).toBeVisible();
  });
});

function makeItem(overrides: Partial<CanvasItem> = {}): CanvasItem {
  return {
    id: 'item-one',
    ownerClientId: 'client-one',
    ownerName: 'anu',
    contentText: 'owned note',
    primaryUrl: null,
    embedKind: 'text',
    x: 40,
    y: 60,
    width: 240,
    height: 120,
    rotation: 0,
    zIndex: 1,
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
    ...overrides
  };
}
