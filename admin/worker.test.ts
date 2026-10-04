import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './worker.ts';

const endpoint = 'http://localhost:8788/?target=remote';

function request(confirm: boolean) {
  const body = new URLSearchParams({
    target: 'remote',
    action: 'settings_save',
    active_campaign_id: '00000000-0000-4000-8000-000000000000',
    theme_background: '#f8f5ef',
    theme_text: '#24231f',
    theme_accent: '#603b21',
    headline_fr: 'Halloween',
    headline_en: 'Halloween',
    location_fudge_max_meters: '300',
  });
  if (confirm) body.set('confirm_remote', 'on');
  return new Request(endpoint, { method: 'POST', headers: { origin: 'http://localhost:8788', 'content-type': 'application/x-www-form-urlencoded' }, body });
}

test('une écriture distante exige une confirmation explicite', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected remote request'); };
  try {
    await worker.fetch(request(false), { DB: null } as never);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('les paramètres distants utilisent l’API D1 et une écriture groupée', async () => {
  const original = globalThis.fetch;
  const calls: unknown[] = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    const body = JSON.parse(String(init?.body));
    if (body.sql) {
      return Response.json({ success: true, result: [{ success: true, results: [{ id: '00000000-0000-4000-8000-000000000000', slug: 'halloween-2026', title: 'Halloween 2026' }] }] });
    }
    return Response.json({ success: true, result: body.batch.map(() => ({ success: true, results: [] })) });
  };
  try {
    const response = await worker.fetch(request(true), {
      DB: null,
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
    } as never);
    assert.equal(response.status, 303);
    assert.equal(calls.length, 2);
    const batch = calls[1] as { batch: { sql: string; params: string[] }[] };
    assert.equal(batch.batch.length, 7);
    assert.ok(batch.batch.every(({ params }) => !params[0].includes('contest_')));
    assert.deepEqual(batch.batch[0].params, ['active_campaign_id', '00000000-0000-4000-8000-000000000000']);
    assert.ok(batch.batch.some(({ params }) => params[0] === 'campaign:00000000-0000-4000-8000-000000000000:location_fudge_max_meters' && params[1] === '300'));
  } finally {
    globalThis.fetch = original;
  }
});

test('la gestion enregistre les noms et l’image individuels et refuse chemins, URL et noms invalides', async () => {
  const original = globalThis.fetch;
  const calls: { sql: string; params: (string | null)[] }[] = [];
  const id = '94158f04-db1d-4d99-b4c7-079bff27739b';
  const env = { DB: null, CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_ACCOUNT_ID: 'test-account' } as never;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    const results = body.sql === 'SELECT id FROM items WHERE id = ?' ? [{ id }] : [];
    return Response.json({ success: true, result: [{ success: true, results }] });
  };
  const submit = (overrides: Record<string, string> = {}, confirm = true) => {
    const body = new URLSearchParams({ target: 'remote', action: 'item_update', id, nickname: 'Pixel', public_slug: 'chat-fantome-pixel', display_name: 'Citrouille', display_name_en: 'Pumpkin', image_key: 'citrouille.jpg', ...overrides });
    if (confirm) body.set('confirm_remote', 'on');
    return worker.fetch(new Request(endpoint, { method: 'POST', headers: { origin: 'http://localhost:8788', 'content-type': 'application/x-www-form-urlencoded' }, body }), env);
  };
  try {
    assert.equal((await submit()).status, 303);
    const write = calls.find(({ sql }) => sql.startsWith('UPDATE items'))!;
    assert.deepEqual(write.params, ['Pixel', 'chat-fantome-pixel', 'Citrouille', 'Pumpkin', 'citrouille.jpg', id]);
    calls.length = 0;
    assert.equal((await submit({ display_name_en: '', image_key: '' })).status, 303);
    assert.deepEqual(calls.find(({ sql }) => sql.startsWith('UPDATE items'))?.params, ['Pixel', 'chat-fantome-pixel', 'Citrouille', null, null, id]);
    const invalidValues: Record<string, string>[] = [{ image_key: '../photo.jpg' }, { image_key: 'https://example.com/photo.jpg' }, { image_key: 'Photo.JPG' }, { display_name: '' }, { display_name_en: 'x'.repeat(81) }];
    for (const overrides of invalidValues) {
      calls.length = 0;
      assert.equal((await submit(overrides)).status, 400);
      assert.ok(calls.every(({ sql }) => !sql.startsWith('UPDATE items')));
    }
    calls.length = 0;
    assert.equal((await submit({}, false)).status, 400);
    assert.ok(calls.every(({ sql }) => !sql.startsWith('UPDATE items')));
  } finally { globalThis.fetch = original; }
});
