import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CanvasIdentity } from '../domain/identity';
import type { ResolvedEmbedDraft } from '../domain/embeds';
import type { ItemFrame } from '../domain/geometry';
import {
  applyCanvasEvent,
  orderCanvasItems,
  type CanvasItem,
  type CanvasRealtimeEvent
} from '../domain/realtime';
import {
  canvasEventFromPayload,
  itemPatchToUpdateRow,
  itemToInsertRow,
  rowToCanvasItem,
  type CanvasItemRow,
  type CanvasPayload
} from './canvasRows';

export type CreateCanvasItemInput = {
  draft: ResolvedEmbedDraft;
  frame: ItemFrame;
  zIndex: number;
};

export type UpdateCanvasItemInput = {
  name?: string;
  draft?: ResolvedEmbedDraft;
  frame?: ItemFrame;
  zIndex?: number;
};

export type CanvasRepository = {
  mode: 'supabase' | 'local';
  listItems: () => Promise<CanvasItem[]>;
  createItem: (input: CreateCanvasItemInput) => Promise<CanvasItem>;
  updateItem: (
    id: string,
    input: UpdateCanvasItemInput
  ) => Promise<CanvasItem>;
  deleteItem: (id: string) => Promise<void>;
  subscribe: (onEvent: (event: CanvasRealtimeEvent) => void) => () => void;
};

export function createCanvasRepository(
  identity: Pick<CanvasIdentity, 'clientId' | 'name'>
): CanvasRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return createLocalRepository(identity);
  }

  return createSupabaseRepository(
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          'x-canvas-client-id': identity.clientId
        }
      }
    }),
    identity
  );
}

function createSupabaseRepository(
  client: SupabaseClient,
  identity: Pick<CanvasIdentity, 'clientId' | 'name'>
): CanvasRepository {
  return {
    mode: 'supabase',
    async listItems() {
      const { data, error } = await client
        .from('canvas_items')
        .select('*')
        .order('z_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data as CanvasItemRow[]).map(rowToCanvasItem);
    },
    async createItem(input) {
      const { data, error } = await client
        .from('canvas_items')
        .insert(itemToInsertRow({ ...input, ...identity }))
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return rowToCanvasItem(data as CanvasItemRow);
    },
    async updateItem(id, input) {
      const { data, error } = await client
        .from('canvas_items')
        .update(itemPatchToUpdateRow(input))
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return rowToCanvasItem(data as CanvasItemRow);
    },
    async deleteItem(id) {
      const { error } = await client.from('canvas_items').delete().eq('id', id);

      if (error) {
        throw error;
      }
    },
    subscribe(onEvent) {
      const channel = client
        .channel('canvas-items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'canvas_items' },
          (payload) => {
            const event = canvasEventFromPayload(payload as CanvasPayload);

            if (event) {
              onEvent(event);
            }
          }
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    }
  };
}

function createLocalRepository(
  identity: Pick<CanvasIdentity, 'clientId' | 'name'>
): CanvasRepository {
  let items: CanvasItem[] = [];
  const listeners = new Set<(event: CanvasRealtimeEvent) => void>();

  const emit = (event: CanvasRealtimeEvent) => {
    items = applyCanvasEvent(items, event);
    listeners.forEach((listener) => listener(event));
  };

  return {
    mode: 'local',
    async listItems() {
      return orderCanvasItems(items);
    },
    async createItem(input) {
      const now = new Date().toISOString();
      const item: CanvasItem = {
        id: crypto.randomUUID(),
        ownerClientId: identity.clientId,
        ownerName: identity.name,
        contentText: input.draft.contentText,
        primaryUrl: input.draft.primaryUrl,
        embedKind: input.draft.embedKind,
        x: input.frame.x,
        y: input.frame.y,
        width: input.frame.width,
        height: input.frame.height,
        rotation: input.frame.rotation,
        zIndex: input.zIndex,
        createdAt: now,
        updatedAt: now
      };

      emit({ eventType: 'INSERT', item });
      return item;
    },
    async updateItem(id, input) {
      const oldItem = items.find((item) => item.id === id);

      if (!oldItem) {
        throw new Error(`Canvas item ${id} was not found`);
      }

      const now = new Date().toISOString();
      const updated: CanvasItem = {
        ...oldItem,
        ownerName: input.name ?? oldItem.ownerName,
        contentText: input.draft?.contentText ?? oldItem.contentText,
        primaryUrl: input.draft?.primaryUrl ?? oldItem.primaryUrl,
        embedKind: input.draft?.embedKind ?? oldItem.embedKind,
        x: input.frame?.x ?? oldItem.x,
        y: input.frame?.y ?? oldItem.y,
        width: input.frame?.width ?? oldItem.width,
        height: input.frame?.height ?? oldItem.height,
        rotation: input.frame?.rotation ?? oldItem.rotation,
        zIndex: input.zIndex ?? oldItem.zIndex,
        updatedAt: now
      };

      emit({ eventType: 'UPDATE', item: updated });
      return updated;
    },
    async deleteItem(id) {
      emit({ eventType: 'DELETE', oldId: id });
    },
    subscribe(onEvent) {
      listeners.add(onEvent);
      return () => listeners.delete(onEvent);
    }
  };
}
