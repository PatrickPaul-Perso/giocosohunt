import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import piexif from 'piexifjs';
import worker from './worker.ts';
import { classItemsQuery } from '../src/lib/class-items.ts';
import { withMetadata } from '../src/lib/test-photo-fixture.ts';

const itemId = '94158f04-db1d-4d99-b4c7-079bff27739b';
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).sort().filter(f => f.endsWith('.sql'))) db.exec(readFileSync(new URL(file, dir), 'utf8'));
  const env = { DB: { prepare(sql: string) {
    let params: (string | null)[] = [];
    const statement = { bind(...values: (string | null)[]) { params = values; return statement; },
      async all() { return { results: db.prepare(sql).all(...params) }; } };
    return statement;
  } } } as never;
  const get = (path = '/') => worker.fetch(new Request('http://localhost:8788' + path), env);
  const post = (action: string, values: Record<string, string>) => worker.fetch(new Request('http://localhost:8788/', {
    method: 'POST', headers: { origin: 'http://localhost:8788', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ target: 'local', action, ...values }),
  }), env);
  const declare = (id: string, disposition: string) => {
    db.prepare('INSERT INTO scan_events (id, item_id, occurred_at) VALUES (?, ?, ?)').run(id, itemId, '2020-01-01');
    db.prepare('INSERT INTO scan_responses (scan_event_id, disposition) VALUES (?, ?)').run(id, disposition);
  };
  const item = () => db.prepare(classItemsQuery).all('00000000-0000-4000-8000-000000000000', 'halloween-2026:chat-fantome').find(i => i.id === itemId)!;
  return { db, env, get, post, declare, item };
}

test('inventaire complet, états et compteur communs; une réponse sur un ancien tag lève la perte', async () => {
  const f = fixture();
  try {
    assert.equal(f.item().current_state, 'initial');
    // Inventory must not inherit the review list's 100-row cap.
    for (let index = 0; index < 105; index++) f.db.prepare('INSERT INTO items (id, campaign_id, display_name) VALUES (?, ?, ?)').run(crypto.randomUUID(), '00000000-0000-4000-8000-000000000000', 'Inventory ' + index);
    const total = f.db.prepare('SELECT COUNT(*) AS n FROM items').get()!.n;
    const html = await (await f.get()).text();
    assert.equal((html.match(/<tr data-name=/g) || []).length, total);
    assert.ok(html.indexOf('Inventaire des figurines') < html.indexOf('<summary>Paramètres'));
    f.declare(first, 'keep');
    assert.equal(f.item().participation_count, 1);
    assert.equal((await f.post('item_missing', { id: itemId })).status, 303);
    assert.equal(f.item().current_state, 'missing');
    assert.equal(f.db.prepare('SELECT missing_after_scan_id FROM items WHERE id = ?').get(itemId)!.missing_after_scan_id, first);
    f.db.prepare('INSERT INTO scan_events (id, item_id, occurred_at) VALUES (?, ?, ?)').run(second, itemId, '2019-01-01');
    assert.equal(f.item().current_state, 'missing');
    assert.equal(f.item().participation_count, 1);
    f.db.prepare("INSERT INTO scan_responses (scan_event_id, disposition) VALUES (?, 'rehide')").run(second);
    assert.equal(f.item().current_state, 'circulating');
    assert.equal(f.item().participation_count, 2);
    await f.post('item_missing', { id: itemId });
    await f.post('item_missing_clear', { id: itemId });
    assert.equal(f.item().current_state, 'circulating');
    for (const action of ['scan_review_approve','scan_review_hold','scan_review_reject']) assert.equal((await f.post(action, { scan_event_id: second })).status, 303);
    assert.equal(f.item().current_state, 'circulating');
    assert.equal(f.item().participation_count, 2);
    assert.equal((await f.post('scan_review_approve', { scan_event_id: second })).status, 400);
  } finally { f.db.close(); }
});

test('shoutout consenti, persistant et annulable; coordonnées historiques privées et photos sans EXIF', async () => {
  const f = fixture();
  try {
    f.declare(first, 'rehide');
    assert.equal((await f.post('shoutout_done', { scan_event_id: first })).status, 400);
    f.db.prepare(`UPDATE scan_responses SET social_platform = 'instagram', social_handle = '@<script>', social_consent_at = CURRENT_TIMESTAMP,
      rehide_lat_milli = 45420, rehide_lon_milli = -75700, rehide_location_source = 'manual', rehide_location_consent_at = CURRENT_TIMESTAMP WHERE scan_event_id = ?`).run(first);
    assert.equal((await f.post('shoutout_done', { scan_event_id: first })).status, 303);
    assert.ok(f.db.prepare('SELECT shoutout_at FROM scan_responses WHERE scan_event_id = ?').get(first)!.shoutout_at);
    f.declare(second, 'keep');
    assert.equal(f.db.prepare('SELECT shoutout_at FROM scan_responses WHERE scan_event_id = ?').get(second)!.shoutout_at, null);
    let point = await (await f.get('/location/' + itemId)).json() as { lat: number; lon: number; scanId: string; label: string };
    assert.equal(point.lat, 45.42); assert.equal(point.scanId, first); assert.match(point.label, /approximative/);
    f.db.prepare('INSERT INTO scan_response_photos (scan_event_id, jpeg, location_source) VALUES (?, ?, ?)').run(first, withMetadata(), 'photo');
    point = await (await f.get('/location/' + itemId)).json() as typeof point;
    assert.equal(point.lat, 45.42); // GPS is ignored without consent.
    f.db.prepare('UPDATE scan_response_photos SET gps_consent_at = CURRENT_TIMESTAMP WHERE scan_event_id = ?').run(first);
    point = await (await f.get('/location/' + itemId)).json() as typeof point;
    assert.equal(point.lat, 45.5); assert.equal(point.lon, -73.5); assert.match(point.label, /Exacte privée/);
    const photo = await f.get('/photo/' + first);
    assert.equal(photo.headers.get('cache-control'), 'no-store');
    const jpeg = Buffer.from(await photo.arrayBuffer());
    assert.deepEqual(piexif.load('data:image/jpeg;base64,' + jpeg.toString('base64')).GPS, {});
    await f.post('shoutout_clear', { scan_event_id: first });
    assert.equal(f.db.prepare('SELECT shoutout_at FROM scan_responses WHERE scan_event_id = ?').get(first)!.shoutout_at, null);
    f.db.prepare('UPDATE scan_response_photos SET jpeg = ? WHERE scan_event_id = ?').run(Buffer.from('invalid'), first);
    point = await (await f.get('/location/' + itemId)).json() as typeof point;
    assert.equal(point.lat, 45.42);
    // The last participation supplies contacts/clue, while positions can be older.
    f.db.prepare('DELETE FROM scan_responses WHERE scan_event_id = ?').run(second);
    const html = await (await f.get()).text();
    assert.ok(html.includes('@&lt;script&gt;'));
    assert.ok(!html.includes('@<script>'));
    f.db.prepare('UPDATE scan_responses SET rehide_location_consent_at = NULL WHERE scan_event_id = ?').run(first);
    assert.equal(await (await f.get('/location/' + itemId)).json(), null);
    assert.equal((await worker.fetch(new Request('https://example.com/location/' + itemId), f.env)).status, 404);
    assert.equal((await f.get('/location/invalid')).status, 404);
  } finally { f.db.close(); }
});
