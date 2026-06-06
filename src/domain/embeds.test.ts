import { describe, expect, it } from 'vitest';
import { resolveEmbedDraft } from './embeds';

describe('embed resolution', () => {
  it('keeps plain text as text', () => {
    expect(resolveEmbedDraft('hello canvas')).toEqual({
      contentText: 'hello canvas',
      primaryUrl: null,
      embedKind: 'text',
      embedUrl: null
    });
  });

  it('uses the first URL as the primary embed', () => {
    const draft = resolveEmbedDraft(
      'first https://example.com then https://frozenkelp.vip'
    );

    expect(draft.primaryUrl).toBe('https://example.com');
    expect(draft.embedKind).toBe('website');
  });

  it('recognizes image and gif URLs', () => {
    expect(resolveEmbedDraft('https://site.test/coffee.gif').embedKind).toBe(
      'image'
    );
    expect(
      resolveEmbedDraft('look https://site.test/sketch.jpg?size=large').embedKind
    ).toBe('image');
  });

  it('treats Tenor share GIF URLs as preview pages', () => {
    const draft = resolveEmbedDraft('https://tenor.com/bPeMW.gif');

    expect(draft.embedKind).toBe('website');
    expect(draft.embedUrl).toBe('https://tenor.com/bPeMW.gif');
  });

  it('recognizes direct video URLs', () => {
    const draft = resolveEmbedDraft('https://cdn.test/clip.mp4');

    expect(draft.embedKind).toBe('video');
    expect(draft.embedUrl).toBe('https://cdn.test/clip.mp4');
  });

  it('turns common video page links into embed URLs', () => {
    expect(resolveEmbedDraft('https://youtu.be/abc123').embedUrl).toBe(
      'https://www.youtube.com/embed/abc123'
    );
    expect(
      resolveEmbedDraft('https://www.youtube.com/watch?v=xyz987&t=14').embedUrl
    ).toBe('https://www.youtube.com/embed/xyz987');
    expect(resolveEmbedDraft('https://vimeo.com/123456').embedUrl).toBe(
      'https://player.vimeo.com/video/123456'
    );
  });
});
