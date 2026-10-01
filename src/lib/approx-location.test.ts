import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApproxLocation } from './approx-location.ts';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test('la position publique exige un consentement distinct', () => {
  assert.equal(parseApproxLocation(form({})).location, null);
  assert.ok(parseApproxLocation(form({ map_lat_milli: '45421', map_lon_milli: '-75700', map_location_source: 'device' })).error);
});

test('seuls des milli-degrés entiers dans les limites terrestres sont acceptés', () => {
  const valid = parseApproxLocation(form({ map_location_consent: 'on', map_lat_milli: '45421', map_lon_milli: '-75700', map_location_source: 'manual' }));
  assert.deepEqual(valid.location, { latMilli: 45421, lonMilli: -75700, source: 'manual' });
  assert.ok(parseApproxLocation(form({ map_location_consent: 'on', map_lat_milli: '45421.123', map_lon_milli: '-75700', map_location_source: 'device' })).error);
  assert.ok(parseApproxLocation(form({ map_location_consent: 'on', map_lat_milli: '99999', map_lon_milli: '-75700', map_location_source: 'device' })).error);
});
