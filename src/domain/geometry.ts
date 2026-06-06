export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type Point = {
  x: number;
  y: number;
};

export type ItemFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

const MIN_WIDTH = 140;
const MIN_HEIGHT = 88;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

export function screenToWorld(
  screenPoint: Point,
  viewport: CanvasViewport
): Point {
  return {
    x: viewport.x + screenPoint.x / viewport.zoom,
    y: viewport.y + screenPoint.y / viewport.zoom
  };
}

export function clampFrame(frame: ItemFrame): ItemFrame {
  return {
    ...frame,
    width: Math.max(MIN_WIDTH, frame.width),
    height: Math.max(MIN_HEIGHT, frame.height)
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function transformViewportAt(
  viewport: CanvasViewport,
  screenPoint: Point,
  zoom: number
): CanvasViewport {
  const nextZoom = clampZoom(zoom);
  const worldPoint = screenToWorld(screenPoint, viewport);

  return {
    x: worldPoint.x - screenPoint.x / nextZoom,
    y: worldPoint.y - screenPoint.y / nextZoom,
    zoom: nextZoom
  };
}

export function resizeFrameFromDelta(
  frame: ItemFrame,
  dx: number,
  dy: number,
  aspectLocked: boolean
): ItemFrame {
  if (!aspectLocked) {
    return clampFrame({
      ...frame,
      width: frame.width + dx,
      height: frame.height + dy
    });
  }

  const ratio = frame.width / frame.height;
  const freeWidth = frame.width + dx;
  const freeHeight = frame.height + dy;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return clampFrame({
      ...frame,
      width: freeHeight * ratio,
      height: freeHeight
    });
  }

  return clampFrame({
    ...frame,
    width: freeWidth,
    height: freeWidth / ratio
  });
}

export function normalizeRotation(rotation: number): number {
  const wrapped = rotation % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
