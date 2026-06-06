export const CLIENT_ID_COOKIE = 'canvas_client_id';
export const NAME_COOKIE = 'canvas_name';

export type CanvasIdentity = {
  clientId: string;
  name: string;
  cookiesToWrite: string[];
};

export function normalizeCanvasName(input: string): string {
  const tidied = input.trim().replace(/\s+/g, ' ');

  if (!tidied) {
    return 'anon';
  }

  return tidied.slice(0, 32);
}

export function serializeCanvasCookie(name: string, value: string): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax'
  ].join('; ');
}

export function buildIdentity(
  cookieText: string,
  makeClientId: () => string
): CanvasIdentity {
  const cookies = parseCookies(cookieText);
  const clientId = cookies[CLIENT_ID_COOKIE] || makeClientId();
  const name = normalizeCanvasName(cookies[NAME_COOKIE] || 'anon');
  const cookiesToWrite: string[] = [];

  if (!cookies[CLIENT_ID_COOKIE]) {
    cookiesToWrite.push(serializeCanvasCookie(CLIENT_ID_COOKIE, clientId));
  }

  if (!cookies[NAME_COOKIE] || cookies[NAME_COOKIE] !== name) {
    cookiesToWrite.push(serializeCanvasCookie(NAME_COOKIE, name));
  }

  return { clientId, name, cookiesToWrite };
}

function parseCookies(cookieText: string): Record<string, string> {
  return cookieText.split(';').reduce<Record<string, string>>((jar, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');

    if (!rawName) {
      return jar;
    }

    jar[rawName] = safeDecode(rawValue.join('='));
    return jar;
  }, {});
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
