import { useEffect, useMemo, useState } from 'react';
import { createCanvasRepository } from './data/canvasRepository';
import { productionHttpsRedirectUrl } from './domain/deployment';
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

  useEffect(() => {
    const redirectUrl = productionHttpsRedirectUrl(window.location);

    if (redirectUrl) {
      window.location.replace(redirectUrl);
    }
  }, []);

  return <CanvasBoard identity={identity} repository={repository} />;
}

function makeClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Date.now()}`;
}
