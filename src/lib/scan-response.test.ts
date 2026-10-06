import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeCluePhoto } from './clue-photo.ts';
import { parseScanResponse } from './scan-response.ts';
import { withMetadata } from './test-photo-fixture.ts';

const scanId = '00000000-0000-4000-8000-000000000001';

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    scan_event_id: scanId,
    disposition: 'keep',
    ...entries,
  })) data.set(key, value);
  return data;
}

test('une réponse au scan sans contact est acceptée', async () => {
  const result = await parseScanResponse(form({}));
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.socialHandle, null);
  assert.equal(result.submission?.email, null);
});

test('handle et courriel exigent chacun leur propre consentement', async () => {
  const data = form({ social_platform: 'instagram', social_handle: '@giocoso', email: 'jeu@example.ca' });
  let result = await parseScanResponse(data);
  assert.equal(result.submission, null);
  assert.equal(result.errors.length, 2);

  data.set('social_consent', 'on');
  result = await parseScanResponse(data);
  assert.equal(result.submission, null);
  assert.equal(result.errors.length, 1);

  data.set('email_consent', 'on');
  result = await parseScanResponse(data);
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.socialHandle, 'giocoso');
  assert.equal(result.submission?.email, 'jeu@example.ca');
});

test('un indice général est accepté seulement après une nouvelle cachette', async () => {
  const result = await parseScanResponse(form({ disposition: 'rehide', clue_text: 'Près des arbres du sentier' }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.clueText, 'Près des arbres du sentier');

  assert.equal((await parseScanResponse(form({ disposition: 'keep', clue_text: 'Près des arbres' }))).submission, null);
  assert.equal((await parseScanResponse(form({ disposition: 'rehide', clue_text: '123 rue Principale' }))).submission, null);
});

test('les métadonnées GPS des photos sont retirées même avec les anciens champs', async () => {
  const data = form({ disposition: 'rehide', gps_consent: 'on', location_source: 'photo' });
  data.set('clue_photo', new File([withMetadata().buffer as ArrayBuffer], 'indice.jpg', { type: 'image/jpeg' }));
  const result = await parseScanResponse(data);
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.locationSource, null);
  assert.equal(sanitizeCluePhoto(result.submission!.photo!, true).hasGps, false);
});

test('le lieu du scan est ignoré et la nouvelle cachette exige un consentement', async () => {
  const data = form({
    disposition: 'rehide',
    map_location_consent: 'on', map_lat_milli: '45421', map_lon_milli: '-75700', map_location_source: 'device',
    rehide_location_consent: 'on', rehide_lat_milli: '45430', rehide_lon_milli: '-75690', rehide_location_source: 'manual',
  });
  const valid = await parseScanResponse(data);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.submission?.approxLocation, null);
  assert.deepEqual(valid.submission?.rehideLocation, { latMilli: 45430, lonMilli: -75690, source: 'manual' });

  data.delete('rehide_location_consent');
  assert.equal((await parseScanResponse(data)).submission, null);
  data.set('rehide_location_consent', 'on');
  data.set('disposition', 'keep');
  assert.equal((await parseScanResponse(data)).submission, null);
});

test('l’autorisation de publier les indices est distincte des consentements GPS', async () => {
  const data = form({ disposition: 'rehide', clue_text: 'Près des arbres', public_clue_consent: 'on' });
  const result = await parseScanResponse(data);
  assert.deepEqual(result.errors, []);
  assert.equal(result.submission?.publicClueConsent, true);
  assert.equal(result.submission?.locationSource, null);
});
