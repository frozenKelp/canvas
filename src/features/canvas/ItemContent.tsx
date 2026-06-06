import { useEffect, useState } from 'react';
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
      item.embedKind === 'vimeo') &&
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

  if (item.embedKind === 'website' && item.primaryUrl) {
    return <WebsitePreview item={item} caption={caption} />;
  }

  return <p>{item.contentText}</p>;
}

type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  favicon?: string;
};

type PreviewState = {
  sourceUrl: string;
  preview: LinkPreview | null;
  failed: boolean;
};

function WebsitePreview({
  item,
  caption
}: {
  item: CanvasItem;
  caption: string;
}) {
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const endpoint = import.meta.env.VITE_LINK_PREVIEW_ENDPOINT;
  const primaryUrl = item.primaryUrl ?? '';
  const requestUrl =
    endpoint && primaryUrl
      ? previewRequestUrl(endpoint, primaryUrl)
      : null;

  useEffect(() => {
    const controller = new AbortController();

    if (!requestUrl || !primaryUrl) {
      return;
    }

    fetch(requestUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: LinkPreview) =>
        setPreviewState({
          sourceUrl: primaryUrl,
          preview: data,
          failed: false
        })
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreviewState({
            sourceUrl: primaryUrl,
            preview: null,
            failed: true
          });
        }
      });

    return () => controller.abort();
  }, [primaryUrl, requestUrl]);

  const host = hostLabel(primaryUrl);
  const activePreview =
    previewState?.sourceUrl === primaryUrl ? previewState : null;
  const preview = activePreview?.preview ?? null;
  const failed = !requestUrl || activePreview?.failed;
  const title = preview?.title || host;
  const description =
    preview?.description ||
    (failed ? 'preview unavailable' : 'fetching preview');

  return (
    <div className="website-card">
      {preview?.image ? (
        <img className="website-card-image" src={preview.image} alt="" />
      ) : null}
      <div className="website-card-body">
        <div className="website-card-host">
          {preview?.favicon ? <img src={preview.favicon} alt="" /> : null}
          <span>{preview?.siteName || host}</span>
        </div>
        <strong>{title}</strong>
        <p>{description}</p>
        <a href={primaryUrl} target="_blank" rel="noreferrer">
          open
        </a>
      </div>
      {caption ? <p className="website-card-caption">{caption}</p> : null}
    </div>
  );
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

function previewRequestUrl(endpoint: string, targetUrl: string): string | null {
  try {
    const url = new URL(endpoint);
    url.searchParams.set('url', targetUrl);
    return url.toString();
  } catch {
    return null;
  }
}

function hostLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./u, '');
  } catch {
    return rawUrl;
  }
}
