type LocationLike = {
  protocol: string;
  hostname: string;
  href: string;
};

const PRODUCTION_HOST = 'frozenkelp.vip';

export function productionHttpsRedirectUrl(location: LocationLike): string | null {
  if (location.protocol !== 'http:' || location.hostname !== PRODUCTION_HOST) {
    return null;
  }

  return location.href.replace(/^http:/u, 'https:');
}
