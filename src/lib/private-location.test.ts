import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privatePhotoCoordinates } from './private-location.ts';
import { withMetadata, tinyJpeg } from './test-photo-fixture.ts';
test('lecture GPS privée : coordonnées signées, absence de GPS et fichiers invalides', () => {
  assert.deepEqual(privatePhotoCoordinates(Buffer.from(withMetadata()).toString('hex')), { lat: 45.5, lon: -73.5 });
  assert.equal(privatePhotoCoordinates(Buffer.from(tinyJpeg, 'base64').toString('hex')), null);
  for (const hex of ['', 'xx', 'a', '00', '00'.repeat(300001)]) assert.equal(privatePhotoCoordinates(hex), null);
});
