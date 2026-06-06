import { describe, expect, it } from 'vitest';
import {
  applyCanvasEvent,
  orderCanvasItems,
  type CanvasItem
} from './realtime';

const baseItem: CanvasItem = {
  id: 'one',
  ownerClientId: 'client-a',
  ownerName: 'anu',
  contentText: 'hello',
  primaryUrl: null,
  embedKind: 'text',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  rotation: 0,
  zIndex: 1,
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:00.000Z'
};

describe('realtime item merging', () => {
  it('inserts, updates, and deletes rows by id', () => {
    const inserted = applyCanvasEvent([], {
      eventType: 'INSERT',
      item: baseItem
    });

    expect(inserted).toHaveLength(1);

    const updated = applyCanvasEvent(inserted, {
      eventType: 'UPDATE',
      item: { ...baseItem, contentText: 'changed' }
    });

    expect(updated[0].contentText).toBe('changed');

    const deleted = applyCanvasEvent(updated, {
      eventType: 'DELETE',
      oldId: 'one'
    });

    expect(deleted).toEqual([]);
  });

  it('orders by z-index and then creation time', () => {
    const early = { ...baseItem, id: 'early', zIndex: 2 };
    const late = {
      ...baseItem,
      id: 'late',
      zIndex: 2,
      createdAt: '2026-06-07T00:00:00.000Z'
    };
    const back = { ...baseItem, id: 'back', zIndex: 1 };

    expect(orderCanvasItems([late, back, early]).map((item) => item.id)).toEqual(
      ['back', 'early', 'late']
    );
  });
});
