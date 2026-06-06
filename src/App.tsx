import { useMemo, useState } from 'react';
import { createCanvasRepository } from './data/canvasRepository';
import { buildIdentity, type CanvasIdentity } from './domain/identity';
import { CanvasBoard } from './features/canvas/CanvasBoard';

export function App() {
  const [identity] = useState<CanvasIdentity>(() => {
    const built = buildIdentity(document.cookie, makeClientId);
    built.cookiesToWrite.forEach((cookie) => {
      document.cookie = cookie;
    });
    return built;
  });
  const repository = useMemo(
    () => createCanvasRepository(identity),
    [identity]
  );

  return <CanvasBoard identity={identity} repository={repository} />;
}

function makeClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Date.now()}`;
}
