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

export function normalizeRotation(rotation: number): number {
  const wrapped = rotation % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
