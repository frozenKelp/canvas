import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react';
import type {
  CanvasRepository,
  UpdateCanvasItemInput
} from '../../data/canvasRepository';
import { resolveEmbedDraft } from '../../domain/embeds';
import {
  clampFrame,
  normalizeRotation,
  resizeFrameFromDelta,
  screenToWorld,
  transformViewportAt,
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

type HeldKeys = {
  move: boolean;
  rotate: boolean;
  aspect: boolean;
};

type DragMode = 'pan' | 'move' | 'transform';
type TransformMode = 'free-resize' | 'aspect-resize' | 'rotate';

type DragState = {
  mode: DragMode;
  transformMode?: TransformMode;
  itemId?: string;
  startScreen: Point;
  startFrame?: ItemFrame;
  startViewport?: CanvasViewport;
  rotationCenter?: Point;
};

const EMPTY_DRAFT_TEXT = 'paste a link or write anything';
const DEFAULT_BOX = { width: 320, height: 96 };
const GRID_SIZE = 28;
const WHEEL_ZOOM_SPEED = 0.0015;

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
  const [heldKeys, setHeldKeys] = useState<HeldKeys>({
    move: false,
    rotate: false,
    aspect: false
  });
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewportRef = useRef(viewport);
  const heldKeysRef = useRef(heldKeys);
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

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    heldKeysRef.current = heldKeys;
  }, [heldKeys]);

  const markDirty = useCallback((id: string) => {
    setDirtyIds((current) => new Set(current).add(id));
  }, []);

  const setHeldKey = useCallback((key: keyof HeldKeys, pressed: boolean) => {
    const next = { ...heldKeysRef.current, [key]: pressed };
    heldKeysRef.current = next;
    setHeldKeys(next);
  }, []);

  const rememberSavedItem = useCallback((saved: CanvasItem) => {
    setItems((current) =>
      applyCanvasEvent(current, { eventType: 'UPDATE', item: saved })
    );
    setDirtyIds((current) => {
      const next = new Set(current);
      next.delete(saved.id);
      return next;
    });
  }, []);

  const saveItemPatch = useCallback(
    async (id: string, input: UpdateCanvasItemInput) => {
      try {
        const saved = await repository.updateItem(id, input);
        rememberSavedItem(saved);
      } catch (caught) {
        setError(messageFromError(caught));
      }
    },
    [rememberSavedItem, repository]
  );

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'm') {
        setHeldKey('move', true);
      }

      if (key === 'r') {
        setHeldKey('rotate', true);
      }

      if (key === 'g') {
        setHeldKey('aspect', true);
      }
    };

    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'm') {
        setHeldKey('move', false);
      }

      if (key === 'r') {
        setHeldKey('rotate', false);
      }

      if (key === 'g') {
        setHeldKey('aspect', false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setHeldKey]);

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
          x:
            drag.startViewport.x -
            (point.x - drag.startScreen.x) / drag.startViewport.zoom,
          y:
            drag.startViewport.y -
            (point.y - drag.startScreen.y) / drag.startViewport.zoom
        });
        return;
      }

      if (!drag.itemId || !drag.startFrame) {
        return;
      }

      const nextFrame = frameFromDrag(drag, point, viewportRef.current);
      setItems((current) =>
        current.map((item) =>
          item.id === drag.itemId ? { ...item, ...nextFrame } : item
        )
      );
      markDirty(drag.itemId);
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;

      if (
        !drag ||
        drag.mode === 'pan' ||
        !drag.itemId ||
        !drag.startFrame
      ) {
        return;
      }

      const nextFrame = frameFromDrag(
        drag,
        { x: event.clientX, y: event.clientY },
        viewportRef.current
      );

      if (!frameChanged(drag.startFrame, nextFrame)) {
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === drag.itemId ? { ...item, ...nextFrame } : item
        )
      );
      markDirty(drag.itemId);
      void saveItemPatch(drag.itemId, { frame: nextFrame });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [markDirty, saveItemPatch]);

  const saveDraft = useCallback(async () => {
    const trimmed = draft?.text.trim();

    if (!draft || !trimmed) {
      setDraft(null);
      return;
    }

    try {
      const resolvedDraft = resolveEmbedDraft(trimmed);
      const saved = await repository.createItem({
        draft: resolvedDraft,
        frame: frameForResolvedDraft(draft.frame, resolvedDraft.embedKind),
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
      await saveItemPatch(item.id, {
        frame: pickFrame(item),
        ...input
      });
    },
    [saveItemPatch]
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
    if (!isBlankCanvasTarget(event.target)) {
      return;
    }

    if (
      heldKeysRef.current.move ||
      event.button === 1 ||
      event.altKey ||
      event.metaKey
    ) {
      dragRef.current = {
        mode: 'pan',
        startScreen: { x: event.clientX, y: event.clientY },
        startViewport: viewportRef.current
      };
      clickStartRef.current = null;
      return;
    }

    clickStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !isBlankCanvasTarget(event.target) ||
      dragRef.current ||
      heldKeysRef.current.move
    ) {
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

  const onSurfaceWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!heldKeysRef.current.move) {
      return;
    }

    const nextZoom =
      viewportRef.current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED);

    setViewport((current) =>
      transformViewportAt(
        current,
        { x: event.clientX, y: event.clientY },
        nextZoom
      )
    );
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
  const surfaceStyle = {
    backgroundPosition: `${-viewport.x * viewport.zoom}px ${-viewport.y * viewport.zoom}px`,
    backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`
  };

  return (
    <main
      className={`canvas-app ${heldKeys.move ? 'is-move-mode' : ''}`}
      aria-label="Canvas"
    >
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
        style={surfaceStyle}
        onPointerDown={onSurfacePointerDown}
        onPointerUp={onSurfacePointerUp}
        onWheel={onSurfaceWheel}
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
              moveMode={heldKeys.move}
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
                dragRef.current = createDragState(
                  event,
                  mode,
                  item,
                  transformModeFromKeys(heldKeysRef.current)
                );
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
  moveMode,
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
  moveMode: boolean;
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
      onPointerDown={(event) => {
        if (moveMode) {
          onStartDrag(event, 'move');
        }
      }}
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
        <div className="item-content">
          <ItemContent item={item} />
        </div>
      )}
      {moveMode ? <span className="item-interaction-shield" aria-hidden /> : null}
      <span className="author-tag">{item.ownerName}</span>
      {selected && owned ? (
        <button
          className="handle transform-handle"
          type="button"
          aria-label="Transform item"
          onPointerDown={(event) => onStartDrag(event, 'transform')}
        />
      ) : null}
    </article>
  );
}

function createDragState(
  event: ReactPointerEvent<HTMLElement>,
  mode: Exclude<DragMode, 'pan'>,
  item: CanvasItem,
  transformMode?: TransformMode
): DragState {
  return {
    mode,
    transformMode,
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

  if (drag.transformMode !== 'rotate') {
    return resizeFrameFromDelta(
      startFrame,
      dx,
      dy,
      drag.transformMode === 'aspect-resize'
    );
  }

  const world = screenToWorld(point, viewport);
  const startWorld = screenToWorld(drag.startScreen, viewport);
  const center = drag.rotationCenter!;
  const startAngle =
    (Math.atan2(startWorld.y - center.y, startWorld.x - center.x) * 180) /
    Math.PI;
  const angle = (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;

  return {
    ...startFrame,
    rotation: normalizeRotation(startFrame.rotation + angle - startAngle)
  };
}

function itemStyle(
  frame: ItemFrame
): CSSProperties &
  Record<
    | '--content-scale'
    | '--content-font-size'
    | '--caption-font-size'
    | '--tiny-font-size'
    | '--favicon-size',
    string
  > {
  const scale = contentScale(frame);

  return {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    transform: `rotate(${frame.rotation}deg)`,
    '--content-scale': scale.toFixed(3),
    '--content-font-size': `${17 * scale}px`,
    '--caption-font-size': `${13 * scale}px`,
    '--tiny-font-size': `${11 * scale}px`,
    '--favicon-size': `${14 * scale}px`
  };
}

function contentScale(frame: ItemFrame): number {
  const raw = Math.min(frame.width / 320, frame.height / 120);
  return Math.min(3, Math.max(0.75, raw));
}

function transformModeFromKeys(keys: HeldKeys): TransformMode {
  if (keys.rotate) {
    return 'rotate';
  }

  return keys.aspect ? 'aspect-resize' : 'free-resize';
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

function frameChanged(left: ItemFrame, right: ItemFrame): boolean {
  return (
    left.x !== right.x ||
    left.y !== right.y ||
    left.width !== right.width ||
    left.height !== right.height ||
    left.rotation !== right.rotation
  );
}

function nextZIndex(items: CanvasItem[]): number {
  return items.reduce((z, item) => Math.max(z, item.zIndex), 0) + 1;
}

function frameForResolvedDraft(
  frame: ItemFrame,
  embedKind: CanvasItem['embedKind']
): ItemFrame {
  if (embedKind === 'text') {
    return clampFrame(frame);
  }

  return clampFrame({
    ...frame,
    width: Math.max(frame.width, 320),
    height: Math.max(frame.height, 220)
  });
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went sideways';
}

function isBlankCanvasTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.classList.contains('canvas-surface') ||
      target.classList.contains('canvas-world'))
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  );
}
