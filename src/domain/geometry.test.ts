import { describe, expect, it } from 'vitest';
import {
  clampFrame,
  screenToWorld,
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
});
