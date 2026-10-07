import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { itemStateLabel } from './item-state.ts';
import { classItemsQuery } from './class-items.ts';

test('le statut suit la dernière décision et ignore les scans sans réponse', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, campaign_id TEXT, class_id TEXT, display_name TEXT, nickname TEXT, public_slug TEXT, created_at TEXT, display_name_en TEXT, image_key TEXT);
      CREATE TABLE scan_events (id TEXT PRIMARY KEY, item_id TEXT, occurred_at TEXT);
      CREATE TABLE scan_responses (scan_event_id TEXT PRIMARY KEY, disposition TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO items VALUES ('pixel', 'campaign', 'cats', 'Chat fantôme', 'Pixel', 'chat-fantome-pixel', '2026-10-03', NULL, NULL);
      INSERT INTO items VALUES ('moustache', 'campaign', 'cats', 'Chat fantôme', 'Moustache', 'chat-fantome-moustache', '2026-10-03', NULL, NULL);
      INSERT INTO items VALUES ('gnome', 'campaign', 'gnomes', 'Gnome squelette', 'Pipou', 'gnome-squelette-pipou', '2026-10-03', NULL, NULL);`);
    db.exec(readFileSync(new URL('../../migrations/0014_inventory_states_shoutouts.sql', import.meta.url), 'utf8'));
    const items = () => db.prepare(classItemsQuery).all('campaign', 'cats');
    const disposition = () => items().find((item) => item.id === 'pixel')?.latest_disposition;
    assert.equal(items().length, 2);
    assert.equal(disposition(), null);
    assert.equal(items()[0].current_state, 'initial');
    assert.equal(items()[0].participation_count, 0);
    db.exec(`INSERT INTO scan_events VALUES ('initial', 'pixel', '2026-10-03 10:00:00');
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('initial', 'rehide');`);
    assert.equal(disposition(), 'rehide');
    db.exec(`INSERT INTO scan_events VALUES ('found', 'pixel', '2026-10-03 11:00:00');
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('found', 'keep');
      INSERT INTO scan_events VALUES ('opened', 'pixel', '2026-10-03 12:00:00');`);
    assert.equal(disposition(), 'keep');
    assert.equal(items().find((item) => item.id === 'moustache')?.latest_disposition, null);
    db.exec(`INSERT INTO scan_events VALUES ('recache', 'pixel', '2026-10-03 13:00:00');
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('recache', 'rehide');`);
    assert.equal(disposition(), 'rehide');
    db.exec(`INSERT INTO scan_events VALUES ('z-tie', 'pixel', '2026-10-03 13:00:00');
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('z-tie', 'keep');`);
    assert.equal(disposition(), 'keep');
    assert.equal(items().find(i => i.id === 'pixel')?.participation_count, 4);
    db.exec(`UPDATE items SET missing_at = CURRENT_TIMESTAMP, missing_after_scan_id = 'z-tie' WHERE id = 'pixel';`);
    assert.equal(items().find(i => i.id === 'pixel')?.current_state, 'missing');
    db.exec(`INSERT INTO scan_events VALUES ('old-open', 'pixel', '2026-10-01');
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('old-open', 'rehide');`);
    assert.equal(items().find(i => i.id === 'pixel')?.current_state, 'circulating');
    assert.equal(items().find(i => i.id === 'pixel')?.participation_count, 5);
    assert.equal(itemStateLabel('initial', 'fr'), 'Pas encore en circulation');
    assert.equal(itemStateLabel('missing', 'en'), 'Missing / lost');
  } finally { db.close(); }
});
