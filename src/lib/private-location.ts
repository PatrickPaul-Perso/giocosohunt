import piexif from 'piexifjs';
export function privatePhotoCoordinates(hex: string): { lat: number; lon: number } | null {
  try {
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex) || hex.length > 600_000) return null;
    let binary = '';
    for (let i = 0; i < hex.length; i += 2) binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    const gps = piexif.load('data:image/jpeg;base64,' + btoa(binary)).GPS;
    if (!gps) return null;
    const k = piexif.GPSIFD;
    const decimal = (parts: number[][]): number => {
      if (!Array.isArray(parts) || parts.length !== 3 || !parts.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[1] > 0)) return NaN;
      return parts.reduce((total, p, index) => total + p[0] / p[1] / (60 ** index), 0);
    };
    const lat = decimal(gps[k.GPSLatitude]) * (gps[k.GPSLatitudeRef] === 'S' ? -1 : 1);
    const lon = decimal(gps[k.GPSLongitude]) * (gps[k.GPSLongitudeRef] === 'W' ? -1 : 1);
    return ['N', 'S'].includes(gps[k.GPSLatitudeRef]) && ['E', 'W'].includes(gps[k.GPSLongitudeRef]) && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
  } catch { return null; }
}
