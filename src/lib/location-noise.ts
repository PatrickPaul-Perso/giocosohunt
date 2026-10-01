import type { ApproxLocation } from './approx-location.ts';

const metresPerDegree = 111_320;

function randomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

// Le point reçu est déjà arrondi à trois décimales. Seul le point décalé
// et de nouveau arrondi est conservé dans la D1.
export function addLocationNoise(location: ApproxLocation, maximumMetres = 300, random = randomUnit): ApproxLocation {
  if (!Number.isInteger(maximumMetres) || maximumMetres < 100 || maximumMetres > 1000) {
    throw new Error('Rayon de décalage invalide');
  }
  const latitude = location.latMilli / 1000;
  const longitude = location.lonMilli / 1000;
  const cosLatitude = Math.cos(latitude * Math.PI / 180);
  for (let attempt = 0; attempt < 16; attempt++) {
    const angle = random() * 2 * Math.PI;
    const minimumMetres = maximumMetres / 3;
    const radius = Math.sqrt(minimumMetres ** 2 + random() * (maximumMetres ** 2 - minimumMetres ** 2));
    const latMilli = Math.round((latitude + radius * Math.cos(angle) / metresPerDegree) * 1000);
    const lonMilli = Math.round((longitude + radius * Math.sin(angle) / (metresPerDegree * cosLatitude)) * 1000);
    const distance = Math.hypot((latMilli - location.latMilli) * 111.32,
      (lonMilli - location.lonMilli) * 111.32 * cosLatitude);
    if (distance > 0 && distance <= maximumMetres && Math.abs(latMilli) <= 90_000 && Math.abs(lonMilli) <= 180_000) {
      return { latMilli, lonMilli, source: location.source };
    }
  }
  // À 100 m, l'arrondi peut éliminer tous les essais. Déplacer alors le point
  // d'une cellule en longitude si cela reste dans le rayon configuré.
  const step = location.lonMilli < 180_000 ? 1 : -1;
  if (111.32 * Math.abs(cosLatitude) <= maximumMetres) {
    return { latMilli: location.latMilli, lonMilli: location.lonMilli + step, source: location.source };
  }
  return location;
}
