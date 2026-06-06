import type { ResolvedEmbedDraft } from '../domain/embeds';
import type { ItemFrame } from '../domain/geometry';
import type {
  CanvasItem,
  CanvasRealtimeEvent
} from '../domain/realtime';

export type CanvasItemRow = {
  id: string;
  owner_client_id: string;
  owner_name: string;
  content_text: string;
  primary_url: string | null;
  embed_kind: CanvasItem['embedKind'];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  created_at: string;
  updated_at: string;
};

export type CanvasInsertRow = Omit<
  CanvasItemRow,
  'id' | 'created_at' | 'updated_at'
>;

export type CanvasUpdateRow = Partial<
  Pick<
    CanvasItemRow,
    | 'owner_name'
    | 'content_text'
    | 'primary_url'
    | 'embed_kind'
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'rotation'
    | 'z_index'
  >
>;

export type CanvasPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: unknown;
  old: unknown;
};

export function rowToCanvasItem(row: CanvasItemRow): CanvasItem {
  return {
    id: row.id,
    ownerClientId: row.owner_client_id,
    ownerName: row.owner_name,
    contentText: row.content_text,
    primaryUrl: row.primary_url,
    embedKind: row.embed_kind,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.z_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function itemToInsertRow(input: {
  clientId: string;
  name: string;
  draft: ResolvedEmbedDraft;
  frame: ItemFrame;
  zIndex: number;
}): CanvasInsertRow {
  return {
    owner_client_id: input.clientId,
    owner_name: input.name,
    content_text: input.draft.contentText,
    primary_url: input.draft.primaryUrl,
    embed_kind: input.draft.embedKind,
    x: input.frame.x,
    y: input.frame.y,
    width: input.frame.width,
    height: input.frame.height,
    rotation: input.frame.rotation,
    z_index: input.zIndex
  };
}

export function itemPatchToUpdateRow(input: {
  name?: string;
  draft?: ResolvedEmbedDraft;
  frame?: ItemFrame;
  zIndex?: number;
}): CanvasUpdateRow {
  return {
    ...(input.name ? { owner_name: input.name } : {}),
    ...(input.draft
      ? {
          content_text: input.draft.contentText,
          primary_url: input.draft.primaryUrl,
          embed_kind: input.draft.embedKind
        }
      : {}),
    ...(input.frame
      ? {
          x: input.frame.x,
          y: input.frame.y,
          width: input.frame.width,
          height: input.frame.height,
          rotation: input.frame.rotation
        }
      : {}),
    ...(typeof input.zIndex === 'number' ? { z_index: input.zIndex } : {})
  };
}

export function canvasEventFromPayload(
  payload: CanvasPayload
): CanvasRealtimeEvent | null {
  if (payload.eventType === 'DELETE') {
    const oldRow = payload.old as Partial<CanvasItemRow>;
    return oldRow.id ? { eventType: 'DELETE', oldId: oldRow.id } : null;
  }

  return {
    eventType: payload.eventType,
    item: rowToCanvasItem(payload.new as CanvasItemRow)
  };
}
