import { describe, expect, it } from 'vitest';
import { productionHttpsRedirectUrl } from './deployment';

describe('deployment routing', () => {
  it('redirects the production canvas from http to https', () => {
    expect(
      productionHttpsRedirectUrl({
        protocol: 'http:',
        hostname: 'frozenkelp.vip',
        href: 'http://frozenkelp.vip/canvas/?x=1'
      })
    ).toBe('https://frozenkelp.vip/canvas/?x=1');
  });

  it('leaves local and already-secure URLs alone', () => {
    expect(
      productionHttpsRedirectUrl({
        protocol: 'http:',
        hostname: 'localhost',
        href: 'http://localhost:5173/canvas/'
      })
    ).toBeNull();
    expect(
      productionHttpsRedirectUrl({
        protocol: 'https:',
        hostname: 'frozenkelp.vip',
        href: 'https://frozenkelp.vip/canvas/'
      })
    ).toBeNull();
  });
});
