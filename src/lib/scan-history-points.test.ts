import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHistoryPoints } from './scan-history-points.ts';

function event(id: string, occurred_at: string, disposition: 'keep' | 'rehide' | null, lat: number | null = null, lon: number | null = null) {
  return { id, occurred_at, disposition, map_lat_milli: null as number | null, map_lon_milli: null as number | null,
    rehide_lat_milli: lat, rehide_lon_milli: lon };
}

test('un tag avec plusieurs localisations a un seul point actuel, le plus récent confirmé', () => {
  const entries = [
    event('old', '2026-10-01 12:00:00', 'rehide', 45400, -75700),
    event('unanswered', '2026-10-06 15:00:00', null, 45900, -75900),
    event('latest', '2026-10-05 12:00:00', 'rehide', 45430, -75690),
    event('middle', '2026-10-03 12:00:00', 'rehide', 45420, -75695),
  ];
  const original = structuredClone(entries);
  const points = getHistoryPoints(entries);
  assert.deepEqual(points.map(({ eventId }) => eventId), ['latest', 'middle', 'old']);
  assert.deepEqual(points.filter(({ current }) => current), [
    { eventId: 'latest', lat: 45.43, lon: -75.69, current: true },
  ]);
  assert.ok(points.slice(1).every(({ current }) => !current));
  assert.deepEqual(entries, original, 'le journal ne doit pas être réordonné');
});

test('sans réponse au formulaire, aucun point ni trajet, même si des coordonnées sont présentes', () => {
  assert.deepEqual(getHistoryPoints([event('opened', '2026-10-06 12:00:00', null, 45430, -75690)]), []);
  assert.deepEqual(getHistoryPoints([]), []);
});

test('la dernière cachette suit le lieu du scan au sein d’une même réponse', () => {
  const entry = event('latest', '2026-10-06 12:00:00', 'rehide', 45430, -75690);
  entry.map_lat_milli = 45400;
  entry.map_lon_milli = -75700;
  const points = getHistoryPoints([entry]);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { eventId: 'latest', lat: 45.43, lon: -75.69, current: true });
  assert.equal(points[1].current, false);
});

test('les réponses sans localisation ne créent pas de point et la dernière localisation disponible reste actuelle', () => {
  const points = getHistoryPoints([
    event('latest', '2026-10-06 12:00:00', 'keep'),
    event('located', '2026-10-05 12:00:00', 'rehide', 45430, -75690),
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].eventId, 'located');
  assert.equal(points[0].current, true);
  assert.deepEqual(getHistoryPoints([event('latest', '2026-10-06 12:00:00', 'keep')]), []);
});

test('les coordonnées déjà arrondies sont préservées et les coordonnées incomplètes sont ignorées', () => {
  assert.deepEqual(getHistoryPoints([event('invalid', '2026-10-06 12:00:00', 'rehide', 45430, null)]), []);
  assert.deepEqual(getHistoryPoints([event('zero', '2026-10-06 12:00:00', 'rehide', 0, 0)]), [
    { eventId: 'zero', lat: 0, lon: 0, current: true },
  ]);
});
