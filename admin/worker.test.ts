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
    contest_terms_url: '',
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
    assert.ok(batch.batch.length >= 7);
    assert.deepEqual(batch.batch[0].params, ['active_campaign_id', '00000000-0000-4000-8000-000000000000']);
  } finally {
    globalThis.fetch = original;
  }
});
