import type { EmbedKind } from './embeds';

export type CanvasItem = {
  id: string;
  ownerClientId: string;
  ownerName: string;
  contentText: string;
  primaryUrl: string | null;
  embedKind: EmbedKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type CanvasRealtimeEvent =
  | {
      eventType: 'INSERT' | 'UPDATE';
      item: CanvasItem;
    }
  | {
      eventType: 'DELETE';
      oldId: string;
    };

export function applyCanvasEvent(
  items: CanvasItem[],
  event: CanvasRealtimeEvent
): CanvasItem[] {
  if (event.eventType === 'DELETE') {
    return items.filter((item) => item.id !== event.oldId);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  byId.set(event.item.id, event.item);
  return orderCanvasItems([...byId.values()]);
}

export function orderCanvasItems(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }

    return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  });
}
