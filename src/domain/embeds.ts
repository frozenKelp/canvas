export type EmbedKind =
  | 'text'
  | 'image'
  | 'video'
  | 'youtube'
  | 'vimeo'
  | 'website';

export type ResolvedEmbedDraft = {
  contentText: string;
  primaryUrl: string | null;
  embedKind: EmbedKind;
  embedUrl: string | null;
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const IMAGE_EXTENSIONS = new Set([
  '.apng',
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp'
]);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.ogg', '.ogv', '.webm', '.mov']);
const MEDIA_SHARE_PAGE_HOSTS = new Set(['tenor.com']);

export function resolveEmbedDraft(text: string): ResolvedEmbedDraft {
  const firstUrl = findFirstUrl(text);

  if (!firstUrl) {
    return {
      contentText: text,
      primaryUrl: null,
      embedKind: 'text',
      embedUrl: null
    };
  }

  const parsed = new URL(firstUrl);
  const videoPage = resolveVideoPage(parsed);

  if (videoPage) {
    return {
      contentText: text,
      primaryUrl: firstUrl,
      embedKind: videoPage.kind,
      embedUrl: videoPage.embedUrl
    };
  }

  const extension = getPathExtension(parsed.pathname);

  if (!isMediaSharePage(parsed.hostname) && IMAGE_EXTENSIONS.has(extension)) {
    return {
      contentText: text,
      primaryUrl: firstUrl,
      embedKind: 'image',
      embedUrl: firstUrl
    };
  }

  if (!isMediaSharePage(parsed.hostname) && VIDEO_EXTENSIONS.has(extension)) {
    return {
      contentText: text,
      primaryUrl: firstUrl,
      embedKind: 'video',
      embedUrl: firstUrl
    };
  }

  return {
    contentText: text,
    primaryUrl: firstUrl,
    embedKind: 'website',
    embedUrl: firstUrl
  };
}

export function findFirstUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);

  if (!match) {
    return null;
  }

  return match[0].replace(/[),.!?;:]+$/u, '');
}

function resolveVideoPage(
  url: URL
): { kind: 'youtube' | 'vimeo'; embedUrl: string } | null {
  const host = url.hostname.replace(/^www\./u, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id
      ? { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
      : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id =
      url.searchParams.get('v') ||
      matchPathPart(url.pathname, 'shorts') ||
      matchPathPart(url.pathname, 'embed');

    return id
      ? { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
      : null;
  }

  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).find(isDigits);
    return id
      ? { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
      : null;
  }

  return null;
}

function matchPathPart(pathname: string, marker: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const markerIndex = parts.indexOf(marker);

  return markerIndex >= 0 ? parts[markerIndex + 1] || null : null;
}

function getPathExtension(pathname: string): string {
  const lastDot = pathname.lastIndexOf('.');
  return lastDot >= 0 ? pathname.slice(lastDot).toLowerCase() : '';
}

function isMediaSharePage(hostname: string): boolean {
  return MEDIA_SHARE_PAGE_HOSTS.has(hostname.toLowerCase().replace(/^www\./u, ''));
}

function isDigits(value: string): boolean {
  return /^\d+$/u.test(value);
}
