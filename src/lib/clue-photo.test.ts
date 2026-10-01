import assert from 'node:assert/strict';
import { test } from 'node:test';
import piexif from 'piexifjs';
import { sanitizeCluePhoto } from './clue-photo.ts';

import { withMetadata } from './test-photo-fixture.ts';

const dataUrl = (value: Uint8Array) => 'data:image/jpeg;base64,' + Buffer.from(value).toString('base64');

test('sans consentement, toutes les métadonnées EXIF sont retirées', () => {
  const result = sanitizeCluePhoto(withMetadata(), false);
  const metadata = piexif.load(dataUrl(result.jpeg));
  assert.equal(result.hasGps, false);
  assert.deepEqual(metadata.GPS, {});
  assert.equal(metadata['0th']?.[piexif.ImageIFD.Make], undefined);
});

test('avec consentement, seules latitude et longitude sont conservées', () => {
  const result = sanitizeCluePhoto(withMetadata(), true);
  const metadata = piexif.load(dataUrl(result.jpeg));
  assert.equal(result.hasGps, true);
  assert.equal(metadata.GPS?.[piexif.GPSIFD.GPSLatitudeRef], 'N');
  assert.equal(metadata.GPS?.[piexif.GPSIFD.GPSLongitudeRef], 'W');
  assert.equal(metadata.GPS?.[piexif.GPSIFD.GPSAltitude], undefined);
  assert.equal(metadata['0th']?.[piexif.ImageIFD.Make], undefined);
});

test('un fichier qui n’est pas un JPEG est refusé', () => {
  assert.throws(() => sanitizeCluePhoto(new TextEncoder().encode('not a jpeg'), true));
});
