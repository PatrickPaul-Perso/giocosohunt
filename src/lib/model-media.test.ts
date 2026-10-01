import assert from 'node:assert/strict';
import test from 'node:test';
import { etsyListingUrl, imageKey } from './model-media.ts';

test('les photos de catalogue ne peuvent référencer que des noms de fichiers locaux', () => {
  assert.equal(imageKey('chat_fantome.jpg'), 'chat_fantome.jpg');
  assert.equal(imageKey('../secret.jpg'), null);
});

test('les liens du catalogue pointent uniquement vers une fiche Etsy HTTPS', () => {
  assert.ok(etsyListingUrl('https://www.etsy.com/listing/123456789/model-name'));
  assert.equal(etsyListingUrl('javascript:alert(1)'), null);
  assert.equal(etsyListingUrl('https://etsy.com.evil.example/listing/123'), null);
  assert.equal(etsyListingUrl('https://www.etsy.com/shop/example'), null);
});
