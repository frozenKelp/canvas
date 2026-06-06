import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  CanvasRepository,
  CreateCanvasItemInput,
  UpdateCanvasItemInput
} from '../../data/canvasRepository';
import type { CanvasIdentity } from '../../domain/identity';
import type { CanvasItem } from '../../domain/realtime';
import { CanvasBoard } from './CanvasBoard';

const identity: CanvasIdentity = {
  clientId: 'client-one',
  name: 'anu',
  cookiesToWrite: []
};

describe('CanvasBoard', () => {
  it('creates a text item by clicking the canvas and pressing Enter', async () => {
    const repository = makeRepository();
    render(<CanvasBoard identity={identity} repository={repository} />);

    fireCanvasClick();
    await userEvent.type(screen.getByLabelText('New canvas text'), 'hello canvas');
    fireEvent.keyDown(screen.getByLabelText('New canvas text'), { key: 'Enter' });

    await screen.findByText('hello canvas');
    expect(repository.created[0].draft.contentText).toBe('hello canvas');
  });

  it('resolves the first pasted URL as an embed when saved', async () => {
    const repository = makeRepository();
    render(<CanvasBoard identity={identity} repository={repository} />);

    fireCanvasClick();
    await userEvent.type(
      screen.getByLabelText('New canvas text'),
      'look https://site.test/cat.gif'
    );
    fireEvent.keyDown(screen.getByLabelText('New canvas text'), { key: 'Enter' });

    const image = await screen.findByAltText('look https://site.test/cat.gif');
    expect(image).toHaveAttribute('src', 'https://site.test/cat.gif');
    expect(repository.created[0].draft.embedKind).toBe('image');
  });

  it('lets the owner delete their own selected item', async () => {
    const item = makeItem({ id: 'owned', ownerClientId: 'client-one' });
    const repository = makeRepository([item]);
    render(<CanvasBoard identity={identity} repository={repository} />);

    await screen.findByText('owned note');
    await userEvent.click(screen.getByText('owned note'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    await waitFor(() => expect(repository.deleteItem).toHaveBeenCalledWith('owned'));
  });

  it('pans the world when holding M and dragging blank canvas', async () => {
    const repository = makeRepository();
    render(<CanvasBoard identity={identity} repository={repository} />);

    const canvas = screen.getByTestId('canvas-surface');
    const world = document.querySelector('.canvas-world') as HTMLElement;
    const before = world.style.transform;

    fireEvent.keyDown(window, { key: 'm' });
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      button: 0,
      clientX: 300,
      clientY: 240
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 360,
      clientY: 260
    });
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.keyUp(window, { key: 'm' });

    expect(world.style.transform).not.toBe(before);
  });

  it('zooms the world around the cursor when holding M and scrolling', async () => {
    const repository = makeRepository();
    render(<CanvasBoard identity={identity} repository={repository} />);

    const canvas = screen.getByTestId('canvas-surface');
    const world = document.querySelector('.canvas-world') as HTMLElement;

    fireEvent.keyDown(window, { key: 'm' });
    fireEvent.wheel(canvas, {
      deltaY: -160,
      clientX: 320,
      clientY: 240
    });
    fireEvent.keyUp(window, { key: 'm' });

    expect(world.style.transform).toContain('scale(1.');
  });

  it('uses one transform handle for owned selected items', async () => {
    const item = makeItem({ id: 'owned', ownerClientId: 'client-one' });
    const repository = makeRepository([item]);
    render(<CanvasBoard identity={identity} repository={repository} />);

    await screen.findByText('owned note');
    await userEvent.click(screen.getByText('owned note'));

    expect(screen.getByRole('button', { name: 'Transform item' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resize item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rotate item' })).not.toBeInTheDocument();
  });

  it('saves a rotated item frame when the transform drag ends', async () => {
    const item = makeItem({ id: 'owned', ownerClientId: 'client-one' });
    const repository = makeRepository([item]);
    render(<CanvasBoard identity={identity} repository={repository} />);

    await screen.findByText('owned note');
    await userEvent.click(screen.getByText('owned note'));

    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Transform item' }), {
      pointerId: 1,
      button: 0,
      clientX: 280,
      clientY: 180
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 160,
      clientY: 300
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 160,
      clientY: 300
    });
    fireEvent.keyUp(window, { key: 'r' });

    await waitFor(() => expect(repository.updateItem).toHaveBeenCalled());
    expect(repository.updated[0].input.frame?.rotation).toBeGreaterThan(0);
  });

  it('shows a static website preview fallback when no preview endpoint is configured', async () => {
    const item = makeItem({
      id: 'site',
      contentText: 'https://example.com/story',
      primaryUrl: 'https://example.com/story',
      embedKind: 'website',
      width: 360,
      height: 220
    });
    const repository = makeRepository([item]);
    render(<CanvasBoard identity={identity} repository={repository} />);

    expect(await screen.findByText('preview unavailable')).toBeVisible();
    expect(screen.getByRole('link', { name: 'open' })).toHaveAttribute(
      'href',
      'https://example.com/story'
    );
  });
});

function fireCanvasClick() {
  const canvas = screen.getByTestId('canvas-surface');
  fireEvent.pointerDown(canvas, {
    pointerId: 1,
    button: 0,
    clientX: 180,
    clientY: 140
  });
  fireEvent.pointerUp(canvas, {
    pointerId: 1,
    button: 0,
    clientX: 180,
    clientY: 140
  });
}

function makeRepository(seed: CanvasItem[] = []) {
  let items = [...seed];
  const listeners = new Set<(event: Parameters<CanvasRepository['subscribe']>[0] extends (event: infer Event) => void ? Event : never) => void>();
  const repository: CanvasRepository & {
    created: CreateCanvasItemInput[];
    updated: Array<{ id: string; input: UpdateCanvasItemInput }>;
    deleted: string[];
  } = {
    mode: 'local',
    created: [],
    updated: [],
    deleted: [],
    listItems: vi.fn(async () => items),
    createItem: vi.fn(async (input) => {
      repository.created.push(input);
      const item = makeItem({
        id: `item-${repository.created.length}`,
        contentText: input.draft.contentText,
        primaryUrl: input.draft.primaryUrl,
        embedKind: input.draft.embedKind,
        x: input.frame.x,
        y: input.frame.y,
        width: input.frame.width,
        height: input.frame.height,
        rotation: input.frame.rotation,
        zIndex: input.zIndex
      });
      items = [...items, item];
      listeners.forEach((listener) =>
        listener({ eventType: 'INSERT', item })
      );
      return item;
    }),
    updateItem: vi.fn(async (id, input) => {
      repository.updated.push({ id, input });
      const oldItem = items.find((item) => item.id === id)!;
      const updated = {
        ...oldItem,
        ownerName: input.name ?? oldItem.ownerName,
        contentText: input.draft?.contentText ?? oldItem.contentText,
        primaryUrl: input.draft?.primaryUrl ?? oldItem.primaryUrl,
        embedKind: input.draft?.embedKind ?? oldItem.embedKind,
        x: input.frame?.x ?? oldItem.x,
        y: input.frame?.y ?? oldItem.y,
        width: input.frame?.width ?? oldItem.width,
        height: input.frame?.height ?? oldItem.height,
        rotation: input.frame?.rotation ?? oldItem.rotation
      };
      items = items.map((item) => (item.id === id ? updated : item));
      listeners.forEach((listener) =>
        listener({ eventType: 'UPDATE', item: updated })
      );
      return updated;
    }),
    deleteItem: vi.fn(async (id) => {
      repository.deleted.push(id);
      items = items.filter((item) => item.id !== id);
      listeners.forEach((listener) =>
        listener({ eventType: 'DELETE', oldId: id })
      );
    }),
    subscribe: vi.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    })
  };
  return repository;
}

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
