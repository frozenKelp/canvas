import { describe, expect, it } from 'vitest';
import type { ResolvedEmbedDraft } from '../domain/embeds';
import type { ItemFrame } from '../domain/geometry';
import {
  canvasEventFromPayload,
  itemToInsertRow,
  rowToCanvasItem,
  type CanvasItemRow
} from './canvasRows';

const row: CanvasItemRow = {
  id: 'row-one',
  owner_client_id: 'client-one',
  owner_name: 'anu',
  content_text: 'hello',
  primary_url: null,
  embed_kind: 'text',
  x: 4,
  y: 8,
  width: 200,
  height: 120,
  rotation: 2,
  z_index: 3,
  created_at: '2026-06-06T00:00:00.000Z',
  updated_at: '2026-06-06T01:00:00.000Z'
};

describe('canvas row mapping', () => {
  it('maps database rows into canvas items', () => {
    expect(rowToCanvasItem(row)).toEqual({
      id: 'row-one',
      ownerClientId: 'client-one',
      ownerName: 'anu',
      contentText: 'hello',
      primaryUrl: null,
      embedKind: 'text',
      x: 4,
      y: 8,
      width: 200,
      height: 120,
      rotation: 2,
      zIndex: 3,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T01:00:00.000Z'
    });
  });

  it('builds insert rows from identity, frame, and resolved draft content', () => {
    const draft: ResolvedEmbedDraft = {
      contentText: 'look https://example.com',
      primaryUrl: 'https://example.com',
      embedKind: 'website',
      embedUrl: 'https://example.com'
    };
    const frame: ItemFrame = {
      x: 10,
      y: 20,
      width: 300,
      height: 160,
      rotation: 4
    };

    expect(
      itemToInsertRow({
        clientId: 'client-two',
        name: 'tiny desk',
        draft,
        frame,
        zIndex: 8
      })
    ).toEqual({
      owner_client_id: 'client-two',
      owner_name: 'tiny desk',
      content_text: 'look https://example.com',
      primary_url: 'https://example.com',
      embed_kind: 'website',
      x: 10,
      y: 20,
      width: 300,
      height: 160,
      rotation: 4,
      z_index: 8
    });
  });

  it('turns realtime payloads into canvas events', () => {
    expect(
      canvasEventFromPayload({
        eventType: 'INSERT',
        new: row,
        old: {}
      })
    ).toEqual({
      eventType: 'INSERT',
      item: rowToCanvasItem(row)
    });

    expect(
      canvasEventFromPayload({
        eventType: 'DELETE',
        new: {},
        old: { id: 'row-one' }
      })
    ).toEqual({
      eventType: 'DELETE',
      oldId: 'row-one'
    });
  });
});
