import { describe, expect, it } from 'vitest';
import {
  buildIdentity,
  normalizeCanvasName,
  serializeCanvasCookie
} from './identity';

describe('canvas identity', () => {
  it('creates a client id and default name when cookies are missing', () => {
    const identity = buildIdentity('', () => 'client-one');

    expect(identity.clientId).toBe('client-one');
    expect(identity.name).toBe('anon');
    expect(identity.cookiesToWrite).toEqual([
      serializeCanvasCookie('canvas_client_id', 'client-one'),
      serializeCanvasCookie('canvas_name', 'anon')
    ]);
  });

  it('keeps the existing machine id and author name', () => {
    const identity = buildIdentity(
      'canvas_client_id=machine-9; canvas_name=soft%20coffee',
      () => 'ignored'
    );

    expect(identity.clientId).toBe('machine-9');
    expect(identity.name).toBe('soft coffee');
    expect(identity.cookiesToWrite).toEqual([]);
  });

  it('normalizes author names into a small human label', () => {
    expect(normalizeCanvasName('   tiny   desk   ')).toBe('tiny desk');
    expect(normalizeCanvasName('')).toBe('anon');
    expect(normalizeCanvasName('x'.repeat(80))).toHaveLength(32);
  });
});
