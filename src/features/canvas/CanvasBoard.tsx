import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type {
  CanvasRepository,
  UpdateCanvasItemInput
} from '../../data/canvasRepository';
import { resolveEmbedDraft } from '../../domain/embeds';
import {
  clampFrame,
  normalizeRotation,
  screenToWorld,
  type CanvasViewport,
  type ItemFrame,
  type Point
} from '../../domain/geometry';
import {
  NAME_COOKIE,
  normalizeCanvasName,
  serializeCanvasCookie,
  type CanvasIdentity
} from '../../domain/identity';
import {
  applyCanvasEvent,
  orderCanvasItems,
  type CanvasItem
} from '../../domain/realtime';
import { ItemContent } from './ItemContent';

type CanvasBoardProps = {
  identity: CanvasIdentity;
  repository: CanvasRepository;
};

type DraftBox = {
  text: string;
  frame: ItemFrame;
};

type DragMode = 'pan' | 'move' | 'resize' | 'rotate';

type DragState = {
  mode: DragMode;
  itemId?: string;
  startScreen: Point;
  startFrame?: ItemFrame;
  startViewport?: CanvasViewport;
  rotationCenter?: Point;
};

const EMPTY_DRAFT_TEXT = 'paste a link or write anything';
const DEFAULT_BOX = { width: 320, height: 96 };

export function CanvasBoard({ identity, repository }: CanvasBoardProps) {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [authorName, setAuthorName] = useState(identity.name);
  const [viewport, setViewport] = useState<CanvasViewport>({
    x: 0,
    y: 0,
    zoom: 1
  });
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const clickStartRef = useRef<Point | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );
  const canEditSelected =
    !!selectedItem && selectedItem.ownerClientId === identity.clientId;

  useEffect(() => {
    let alive = true;

    repository
      .listItems()
      .then((loaded) => {
        if (alive) {
          setItems(orderCanvasItems(loaded));
        }
      })
      .catch((caught: unknown) => setError(messageFromError(caught)));

    const unsubscribe = repository.subscribe((event) => {
      setItems((current) => applyCanvasEvent(current, event));
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [repository]);

  useEffect(() => {
    draftRef.current?.focus();
  }, [draft]);

  const markDirty = useCallback((id: string) => {
    setDirtyIds((current) => new Set(current).add(id));
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      const point = { x: event.clientX, y: event.clientY };

      if (drag.mode === 'pan' && drag.startViewport) {
        setViewport({
          ...drag.startViewport,
          x: drag.startViewport.x - (point.x - drag.startScreen.x) / viewport.zoom,
          y: drag.startViewport.y - (point.y - drag.startScreen.y) / viewport.zoom
        });
        return;
      }

      if (!drag.itemId || !drag.startFrame) {
        return;
      }

      const nextFrame = frameFromDrag(drag, point, viewport);
      setItems((current) =>
        current.map((item) =>
          item.id === drag.itemId ? { ...item, ...nextFrame } : item
        )
      );
      markDirty(drag.itemId);
    };

    const onPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [markDirty, viewport]);

  const saveDraft = useCallback(async () => {
    const trimmed = draft?.text.trim();

    if (!draft || !trimmed) {
      setDraft(null);
      return;
    }

    try {
      const saved = await repository.createItem({
        draft: resolveEmbedDraft(trimmed),
        frame: clampFrame(draft.frame),
        zIndex: nextZIndex(items),
        name: authorName
      });
      setItems((current) =>
        applyCanvasEvent(current, { eventType: 'INSERT', item: saved })
      );
      setSelectedId(saved.id);
      setDraft(null);
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }, [authorName, draft, items, repository]);

  const saveItem = useCallback(
    async (item: CanvasItem, input: UpdateCanvasItemInput = {}) => {
      try {
        const saved = await repository.updateItem(item.id, {
          frame: pickFrame(item),
          ...input
        });
        setItems((current) =>
          applyCanvasEvent(current, { eventType: 'UPDATE', item: saved })
        );
        setDirtyIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      } catch (caught) {
        setError(messageFromError(caught));
      }
    },
    [repository]
  );

  const saveSelected = useCallback(() => {
    if (selectedItem) {
      void saveItem(selectedItem);
    }
  }, [saveItem, selectedItem]);

  const deleteSelected = useCallback(async () => {
    if (!selectedItem || !canEditSelected) {
      return;
    }

    try {
      await repository.deleteItem(selectedItem.id);
      setItems((current) =>
        current.filter((item) => item.id !== selectedItem.id)
      );
      setSelectedId(null);
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }, [canEditSelected, repository, selectedItem]);

  const finishTextEdit = useCallback(
    async (item: CanvasItem) => {
      const trimmed = editingText.trim();
      setEditingId(null);

      if (!trimmed || trimmed === item.contentText) {
        return;
      }

      await saveItem(item, { draft: resolveEmbedDraft(trimmed) });
    },
    [editingText, saveItem]
  );

  const commitName = useCallback(() => {
    const normalized = normalizeCanvasName(authorName);
    setAuthorName(normalized);
    document.cookie = serializeCanvasCookie(NAME_COOKIE, normalized);

    items
      .filter((item) => item.ownerClientId === identity.clientId)
      .forEach((item) => {
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, ownerName: normalized }
              : currentItem
          )
        );
        void repository.updateItem(item.id, { name: normalized });
      });
  }, [authorName, identity.clientId, items, repository]);

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    clickStartRef.current = { x: event.clientX, y: event.clientY };

    if (event.button === 1 || event.altKey || event.metaKey) {
      dragRef.current = {
        mode: 'pan',
        startScreen: { x: event.clientX, y: event.clientY },
        startViewport: viewport
      };
    }
  };

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || dragRef.current) {
      return;
    }

    const start = clickStartRef.current;
    clickStartRef.current = null;

    if (!start || distance(start, { x: event.clientX, y: event.clientY }) > 4) {
      return;
    }

    const world = screenToWorld({ x: event.clientX, y: event.clientY }, viewport);
    setSelectedId(null);
    setDraft({
      text: '',
      frame: {
        x: world.x,
        y: world.y,
        width: DEFAULT_BOX.width,
        height: DEFAULT_BOX.height,
        rotation: 0
      }
    });
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void saveDraft();
    }

    if (event.key === 'Escape') {
      setDraft(null);
    }
  };

  const worldStyle = {
    transform: `translate(${-viewport.x * viewport.zoom}px, ${-viewport.y * viewport.zoom}px) scale(${viewport.zoom})`
  };

  return (
    <main className="canvas-app" aria-label="Canvas">
      <h1 className="canvas-wordmark">Canvas</h1>
      <label className="nameplate">
        <span>name:</span>
        <input
          value={authorName}
          aria-label="Your canvas name"
          maxLength={32}
          onChange={(event) => setAuthorName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      </label>

      <div
        className="canvas-surface"
        data-testid="canvas-surface"
        onPointerDown={onSurfacePointerDown}
        onPointerUp={onSurfacePointerUp}
      >
        <div className="canvas-world" style={worldStyle}>
          {items.map((item) => (
            <CanvasItemBox
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              owned={item.ownerClientId === identity.clientId}
              editing={item.id === editingId}
              editingText={editingText}
              onEditingTextChange={setEditingText}
              onSelect={() => setSelectedId(item.id)}
              onStartEdit={() => {
                if (item.ownerClientId === identity.clientId) {
                  setSelectedId(item.id);
                  setEditingId(item.id);
                  setEditingText(item.contentText);
                }
              }}
              onFinishEdit={() => void finishTextEdit(item)}
              onStartDrag={(event, mode) => {
                event.stopPropagation();
                if (item.ownerClientId !== identity.clientId) {
                  setSelectedId(item.id);
                  return;
                }
                setSelectedId(item.id);
                dragRef.current = createDragState(event, mode, item);
              }}
            />
          ))}

          {draft ? (
            <textarea
              ref={draftRef}
              className="draft-box"
              aria-label="New canvas text"
              placeholder={EMPTY_DRAFT_TEXT}
              value={draft.text}
              style={itemStyle(draft.frame)}
              onChange={(event) =>
                setDraft({ ...draft, text: event.target.value })
              }
              onKeyDown={onDraftKeyDown}
              onBlur={() => {
                if (draft.text.trim()) {
                  void saveDraft();
                }
              }}
            />
          ) : null}
        </div>
      </div>

      {selectedItem && canEditSelected ? (
        <button
          className="delete-button"
          type="button"
          aria-label="Delete item"
          onClick={deleteSelected}
        >
          Delete
        </button>
      ) : null}

      {selectedItem && dirtyIds.has(selectedItem.id) ? (
        <button className="save-button" type="button" onClick={saveSelected}>
          Save
        </button>
      ) : null}

      {repository.mode === 'local' ? (
        <div className="local-note">local until Supabase env is set</div>
      ) : null}
      {error ? <div className="error-note">{error}</div> : null}
    </main>
  );
}

function CanvasItemBox({
  item,
  selected,
  owned,
  editing,
  editingText,
  onEditingTextChange,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onStartDrag
}: {
  item: CanvasItem;
  selected: boolean;
  owned: boolean;
  editing: boolean;
  editingText: string;
  onEditingTextChange: (value: string) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onStartDrag: (
    event: ReactPointerEvent<HTMLElement>,
    mode: Exclude<DragMode, 'pan'>
  ) => void;
}) {
  return (
    <article
      className={`canvas-item ${selected ? 'is-selected' : ''}`}
      style={itemStyle(item)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onStartEdit();
      }}
      onPointerDown={(event) => onStartDrag(event, 'move')}
    >
      {editing ? (
        <textarea
          className="edit-box"
          aria-label="Edit canvas text"
          value={editingText}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onEditingTextChange(event.target.value)}
          onBlur={onFinishEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onFinishEdit();
            }
          }}
          autoFocus
        />
      ) : (
        <ItemContent item={item} />
      )}
      <span className="author-tag">{item.ownerName}</span>
      {selected && owned ? (
        <>
          <button
            className="handle resize-handle"
            type="button"
            aria-label="Resize item"
            onPointerDown={(event) => onStartDrag(event, 'resize')}
          />
          <button
            className="handle rotate-handle"
            type="button"
            aria-label="Rotate item"
            onPointerDown={(event) => onStartDrag(event, 'rotate')}
          />
        </>
      ) : null}
    </article>
  );
}

function createDragState(
  event: ReactPointerEvent<HTMLElement>,
  mode: Exclude<DragMode, 'pan'>,
  item: CanvasItem
): DragState {
  return {
    mode,
    itemId: item.id,
    startScreen: { x: event.clientX, y: event.clientY },
    startFrame: pickFrame(item),
    rotationCenter: {
      x: item.x + item.width / 2,
      y: item.y + item.height / 2
    }
  };
}

function frameFromDrag(
  drag: DragState,
  point: Point,
  viewport: CanvasViewport
): ItemFrame {
  const startFrame = drag.startFrame!;
  const dx = (point.x - drag.startScreen.x) / viewport.zoom;
  const dy = (point.y - drag.startScreen.y) / viewport.zoom;

  if (drag.mode === 'move') {
    return {
      ...startFrame,
      x: startFrame.x + dx,
      y: startFrame.y + dy
    };
  }

  if (drag.mode === 'resize') {
    return clampFrame({
      ...startFrame,
      width: startFrame.width + dx,
      height: startFrame.height + dy
    });
  }

  const world = screenToWorld(point, viewport);
  const center = drag.rotationCenter!;
  const angle = (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;

  return {
    ...startFrame,
    rotation: normalizeRotation(angle + 90)
  };
}

function itemStyle(frame: ItemFrame) {
  return {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    transform: `rotate(${frame.rotation}deg)`
  };
}

function pickFrame(item: CanvasItem): ItemFrame {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation
  };
}

function nextZIndex(items: CanvasItem[]): number {
  return items.reduce((z, item) => Math.max(z, item.zIndex), 0) + 1;
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went sideways';
}
