import assert from 'node:assert/strict';
import { test } from 'node:test';
import piexif from 'piexifjs';
import { sanitizeCluePhoto } from './clue-photo.ts';

const tinyJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBtFFFdZyn/2Q==';
const dataUrl = (value: Uint8Array) => 'data:image/jpeg;base64,' + Buffer.from(value).toString('base64');

function withMetadata(): Uint8Array {
  const gps = piexif.GPSIFD;
  const exif = piexif.dump({
    '0th': { [piexif.ImageIFD.Make]: 'Appareil privé' },
    GPS: {
      [gps.GPSLatitudeRef]: 'N', [gps.GPSLatitude]: [[45, 1], [30, 1], [0, 1]],
      [gps.GPSLongitudeRef]: 'W', [gps.GPSLongitude]: [[73, 1], [30, 1], [0, 1]],
      [gps.GPSAltitude]: [100, 1],
    },
  });
  return new Uint8Array(Buffer.from(piexif.insert(exif, 'data:image/jpeg;base64,' + tinyJpeg).split(',')[1], 'base64'));
}

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
