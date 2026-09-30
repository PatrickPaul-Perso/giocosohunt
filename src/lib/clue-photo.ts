import piexif from 'piexifjs';

export const MAX_PHOTO_BYTES = 300_000;
const dataUrl = 'data:image/jpeg;base64,';

function binary(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return result;
}

function bytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

// A JPEG from the browser can contain other metadata. Keep only image segments;
// the GPS fields are rebuilt from four explicitly selected EXIF tags below.
function withoutMetadata(jpeg: string): string {
  if (jpeg.charCodeAt(0) !== 0xff || jpeg.charCodeAt(1) !== 0xd8 || !jpeg.endsWith('\xff\xd9')) {
    throw new Error('JPEG invalide');
  }
  let output = jpeg.slice(0, 2);
  let offset = 2;
  while (offset < jpeg.length - 2) {
    if (jpeg.charCodeAt(offset) !== 0xff) throw new Error('Segment JPEG invalide');
    const marker = jpeg.charCodeAt(offset + 1);
    if (marker === 0xda) return output + jpeg.slice(offset);
    if (marker === 0x00 || marker === 0xff || marker === 0xd8 || marker === 0xd9 || marker === undefined) {
      throw new Error('Marqueur JPEG invalide');
    }
    const length = (jpeg.charCodeAt(offset + 2) << 8) | jpeg.charCodeAt(offset + 3);
    if (length < 2 || offset + 2 + length > jpeg.length) throw new Error('Segment JPEG tronqué');
    if (marker < 0xe0 || marker > 0xef) {
      if (marker !== 0xfe) output += jpeg.slice(offset, offset + 2 + length);
    }
    offset += 2 + length;
  }
  throw new Error('Données JPEG manquantes');
}

function gpsFrom(jpeg: string): Record<number, unknown> | null {
  const gps = piexif.load(dataUrl + btoa(jpeg)).GPS;
  const keys = piexif.GPSIFD;
  const latitudeRef = gps?.[keys.GPSLatitudeRef];
  const longitudeRef = gps?.[keys.GPSLongitudeRef];
  const latitude = gps?.[keys.GPSLatitude];
  const longitude = gps?.[keys.GPSLongitude];
  if (!['N', 'S'].includes(latitudeRef) || !['E', 'W'].includes(longitudeRef)) return null;
  if (![latitude, longitude].every((parts) => Array.isArray(parts) && parts.length === 3 && parts.every(
    (part: unknown) => Array.isArray(part) && part.length === 2 && part.every((n: unknown) => Number.isInteger(n) && (n as number) >= 0) && part[1] > 0,
  ))) return null;
  return {
    [keys.GPSLatitudeRef]: latitudeRef,
    [keys.GPSLatitude]: latitude,
    [keys.GPSLongitudeRef]: longitudeRef,
    [keys.GPSLongitude]: longitude,
  };
}

export function sanitizeCluePhoto(input: Uint8Array, gpsConsent: boolean): { jpeg: Uint8Array; hasGps: boolean } {
  if (!input.length || input.length > MAX_PHOTO_BYTES) throw new Error('Photo trop volumineuse');
  const original = binary(input);
  const clean = withoutMetadata(original);
  const gps = gpsConsent ? gpsFrom(original) : null;
  const result = gps ? piexif.insert(piexif.dump({ '0th': {}, GPS: gps }), clean) : clean;
  const output = bytes(result);
  if (output.length > MAX_PHOTO_BYTES) throw new Error('Photo trop volumineuse');
  return { jpeg: output, hasGps: gps !== null };
}
