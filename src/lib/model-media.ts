export function imageKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[a-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(value) ? value : null;
}

export function etsyListingUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['etsy.com', 'www.etsy.com'].includes(url.hostname) ||
        !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/\d+(?:\/|$)/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
