import assert from 'node:assert/strict';
import test from 'node:test';
import { addLocationNoise } from './location-noise.ts';

test('le point conservé reste en milli-degrés et décalé dans un rayon de 300 m', () => {
  const source = { latMilli: 45421, lonMilli: -75700, source: 'device' as const };
  const result = addLocationNoise(source, 300, () => 0);
  assert.notDeepEqual(result, source);
  assert.equal(Number.isInteger(result.latMilli), true);
  assert.equal(Number.isInteger(result.lonMilli), true);
  const metres = Math.hypot((result.latMilli - source.latMilli) * 111.32,
    (result.lonMilli - source.lonMilli) * 111.32 * Math.cos(45.421 * Math.PI / 180));
  assert.ok(metres <= 300);
});
