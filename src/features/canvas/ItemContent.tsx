import { findFirstUrl } from '../../domain/embeds';
import type { CanvasItem } from '../../domain/realtime';

type ItemContentProps = {
  item: CanvasItem;
};

export function ItemContent({ item }: ItemContentProps) {
  const caption = getCaption(item);

  if (item.embedKind === 'image' && item.primaryUrl) {
    return (
      <div className="item-stack">
        <img
          className="embed-image"
          src={item.primaryUrl}
          alt={item.contentText || item.primaryUrl}
          draggable={false}
        />
        {caption ? <p>{caption}</p> : null}
      </div>
    );
  }

  if (item.embedKind === 'video' && item.primaryUrl) {
    return (
      <div className="item-stack">
        <video className="embed-video" src={item.primaryUrl} controls />
        {caption ? <p>{caption}</p> : null}
      </div>
    );
  }

  if (
    (item.embedKind === 'youtube' ||
      item.embedKind === 'vimeo' ||
      item.embedKind === 'website') &&
    item.primaryUrl
  ) {
    const url = getEmbedUrl(item);
    return (
      <div className="item-stack">
        <iframe
          className="embed-frame"
          src={url}
          title={item.primaryUrl}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
        <a href={item.primaryUrl} target="_blank" rel="noreferrer">
          {hostLabel(item.primaryUrl)}
        </a>
        {caption ? <p>{caption}</p> : null}
      </div>
    );
  }

  return <p>{item.contentText}</p>;
}

function getCaption(item: CanvasItem): string {
  return item.contentText.replace(findFirstUrl(item.contentText) ?? '', '').trim();
}

function getEmbedUrl(item: CanvasItem): string {
  if (item.embedKind === 'youtube') {
    const url = new URL(item.primaryUrl!);
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') ||
          pathAfter(url.pathname, 'shorts') ||
          pathAfter(url.pathname, 'embed');
    return id ? `https://www.youtube.com/embed/${id}` : item.primaryUrl!;
  }

  if (item.embedKind === 'vimeo') {
    const id = new URL(item.primaryUrl!).pathname
      .split('/')
      .filter(Boolean)
      .find((part) => /^\d+$/u.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : item.primaryUrl!;
  }

  return item.primaryUrl!;
}

function pathAfter(pathname: string, marker: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const index = parts.indexOf(marker);
  return index >= 0 ? parts[index + 1] || null : null;
}

function hostLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./u, '');
  } catch {
    return rawUrl;
  }
}
