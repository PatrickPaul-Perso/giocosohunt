import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScanResponse } from './scan-response.ts';
import { tinyJpeg, withMetadata } from './test-photo-fixture.ts';

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

test('le GPS absent est signalé si son consentement a été coché', async () => {
  const data = form({ disposition: 'rehide', gps_consent: 'on', location_source: 'photo' });
  data.set('clue_photo', new File([Buffer.from(tinyJpeg, 'base64')], 'indice.jpg', { type: 'image/jpeg' }));
  const result = await parseScanResponse(data);
  assert.equal(result.submission, null);
  assert.ok(result.errors.some((error) => error.includes('Aucune coordonnée GPS')));
});

test('la position actuelle exige son propre consentement', async () => {
  const data = form({ disposition: 'rehide', location_source: 'device' });
  data.set('clue_photo', new File([withMetadata().buffer as ArrayBuffer], 'indice.jpg', { type: 'image/jpeg' }));
  const invalid = await parseScanResponse(data);
  assert.equal(invalid.submission, null);
  assert.ok(invalid.errors.some((error) => error.includes('séparément la position actuelle')));

  data.set('device_location_consent', 'on');
  const valid = await parseScanResponse(data);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.submission?.locationSource, 'device');
  assert.equal(valid.submission?.photo instanceof Uint8Array, true);
});
