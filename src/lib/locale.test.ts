import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLanguage } from './locale.ts';

test('la langue du navigateur respecte la préférence et la qualité HTTP', () => {
  const request = new Request('https://example.test', { headers: { 'accept-language': 'fr-CA;q=0.2,en-CA;q=0.9' } });
  assert.equal(getLanguage(request, undefined), 'en');
  assert.equal(getLanguage(request, 'fr'), 'fr');
  assert.equal(getLanguage(new Request('https://example.test'), undefined), 'fr');
});
