import { describe, expect, it } from 'vitest';
import {
  clampFrame,
  resizeFrameFromDelta,
  screenToWorld,
  transformViewportAt,
  type CanvasViewport,
  type ItemFrame
} from './geometry';

describe('canvas geometry', () => {
  it('maps screen positions into world positions', () => {
    const viewport: CanvasViewport = { x: 100, y: 50, zoom: 2 };

    expect(screenToWorld({ x: 40, y: 20 }, viewport)).toEqual({
      x: 120,
      y: 60
    });
  });

  it('clamps item dimensions without moving the item', () => {
    const frame: ItemFrame = {
      x: 12,
      y: 24,
      width: 10,
      height: 20,
      rotation: 12
    };

    expect(clampFrame(frame)).toEqual({
      x: 12,
      y: 24,
      width: 140,
      height: 88,
      rotation: 12
    });
  });

  it('zooms around the cursor without moving the world point under it', () => {
    const viewport: CanvasViewport = { x: 100, y: 50, zoom: 1 };
    const cursor = { x: 300, y: 200 };
    const worldBefore = screenToWorld(cursor, viewport);

    const zoomed = transformViewportAt(viewport, cursor, 2);

    expect(zoomed.zoom).toBe(2);
    expect(screenToWorld(cursor, zoomed)).toEqual(worldBefore);
  });

  it('resizes freely when aspect ratio is not locked', () => {
    const frame: ItemFrame = {
      x: 12,
      y: 24,
      width: 200,
      height: 100,
      rotation: 0
    };

    expect(resizeFrameFromDelta(frame, 50, 20, false)).toMatchObject({
      width: 250,
      height: 120
    });
  });

  it('resizes with the original aspect ratio when locked', () => {
    const frame: ItemFrame = {
      x: 12,
      y: 24,
      width: 200,
      height: 100,
      rotation: 0
    };

    expect(resizeFrameFromDelta(frame, 40, 90, true)).toMatchObject({
      width: 380,
      height: 190
    });
  });
});
