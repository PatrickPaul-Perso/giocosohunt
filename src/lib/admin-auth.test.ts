import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate, sign, verify } from './admin-auth.ts';
const secret = 'a-secure-test-secret-with-at-least-32-characters';
const env = { ADMIN_SESSION_SECRET: secret, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', ADMIN_EMAILS: 'owner@gmail.com', ADMIN_ORIGIN: 'https://example.com' };
const request = (path: string, token = '') => new Request('https://example.com/admin' + path, { headers: { cookie: 'admin_session=' + token } });
test('signatures altérées et sessions expirées refusées', async () => {
  const token = await sign({ exp: Date.now() / 1000 + 100 }, secret);
  assert.ok(await verify(token, secret));
  assert.equal(await verify(token + 'x', secret), null);
  assert.equal(await verify(await sign({ exp: 1 }, secret), secret), null);
});
test('toutes les données privées exigent une session autorisée', async () => {
  for (const path of ['/photo/private', '/location/private']) assert.equal((await authenticate(request(path), env))?.status, 401);
  const token = await sign({ sub: 'google-id', email: 'owner@gmail.com', exp: Date.now() / 1000 + 100 }, secret);
  assert.equal(await authenticate(request('/photo/private', token), env), null);
  assert.equal((await authenticate(request('/photo/private', token), { ...env, ADMIN_EMAILS: 'other@gmail.com' }))?.status, 401);
});
test('callback sans état valide refusé avant tout échange Google', async () => {
  assert.equal((await authenticate(request('/callback?code=abc&state=forged'), env))?.status, 400);
});
test('configuration absente refuse l’accès et login utilise PKCE', async () => {
  assert.equal((await authenticate(request('/'), {}))?.status, 503);
  const response = await authenticate(request('/login'), env);
  const url = new URL(response!.headers.get('location')!);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(response!.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
});
test('le diagnostic nomme seulement les variables manquantes sans révéler les valeurs', async () => {
  const response = await authenticate(request('/'), { ...env, GOOGLE_CLIENT_SECRET: '', ADMIN_ORIGIN: undefined });
  assert.equal(response?.status, 503);
  const body = await response!.text();
  assert.match(body, /GOOGLE_CLIENT_SECRET, ADMIN_ORIGIN/);
  assert.ok(!body.includes(secret));
  assert.ok(!body.includes(env.ADMIN_EMAILS));
  const short = await authenticate(request('/'), { ...env, ADMIN_SESSION_SECRET: 'short' });
  assert.match(await short!.text(), /ADMIN_SESSION_SECRET doit contenir au moins 32/);
  assert.equal((await authenticate(request('/'), { ...env, ADMIN_SESSION_SECRET: 'a'.repeat(32) }))?.status, 200);
});
