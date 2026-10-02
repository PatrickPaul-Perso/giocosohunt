export type ApproxLocation = {
  latMilli: number;
  lonMilli: number;
  source: 'device' | 'manual';
};

const integer = /^-?\d+$/;

export function parseApproxLocation(form: FormData, prefix: 'map' | 'rehide' = 'map'): { location: ApproxLocation | null; error: string | null } {
  const consent = form.has(prefix + '_location_consent');
  const lat = form.get(prefix + '_lat_milli');
  const lon = form.get(prefix + '_lon_milli');
  const source = form.get(prefix + '_location_source');
  const latitude = typeof lat === 'string' ? lat.trim() : '';
  const longitude = typeof lon === 'string' ? lon.trim() : '';
  const origin = typeof source === 'string' ? source.trim() : '';
  const hasData = Boolean(latitude || longitude || origin);

  if (!consent) {
    return hasData
      ? { location: null, error: 'La position approximative exige un consentement distinct.' }
      : { location: null, error: null };
  }
  if (!integer.test(latitude) || !integer.test(longitude) || !['device', 'manual'].includes(origin)) {
    return { location: null, error: 'Choisissez une position approximative sur la carte.' };
  }
  const latMilli = Number(latitude);
  const lonMilli = Number(longitude);
  if (!Number.isSafeInteger(latMilli) || !Number.isSafeInteger(lonMilli) ||
      Math.abs(latMilli) > 90_000 || Math.abs(lonMilli) > 180_000) {
    return { location: null, error: 'La position approximative est invalide.' };
  }
  return { location: { latMilli, lonMilli, source: origin as ApproxLocation['source'] }, error: null };
}
