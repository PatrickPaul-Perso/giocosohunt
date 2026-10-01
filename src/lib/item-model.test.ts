import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const campaignId = '00000000-0000-4000-8000-000000000000';
const demoItemId = '00000000-0000-4000-8000-000000000001';
const modelId = '00000000-0000-4000-8000-000000000101';

function database(upTo: number): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (let number = 1; number <= upTo; number++) {
    const name = [
      '0001_initial.sql',
      '0002_scan_responses.sql',
      '0003_clue_photos.sql',
      '0004_photo_location_source.sql',
      '0005_item_model.sql',
    ][number - 1];
    db.exec(readFileSync(`migrations/${name}`, 'utf8'));
  }
  return db;
}

test('migration des données existantes et plusieurs instances du même modèle', () => {
  const db = database(4);
  db.prepare('INSERT INTO campaigns (id, slug, title) VALUES (?, ?, ?)').run(campaignId, 'halloween-2026', 'Halloween 2026');
  db.prepare('INSERT INTO model_candidates (id, campaign_id, name) VALUES (?, ?, ?)').run(modelId, campaignId, 'Modèle #1');
  db.prepare('INSERT INTO items (id, campaign_id, display_name) VALUES (?, ?, ?)').run(demoItemId, campaignId, 'Démo fictive');
  db.exec(readFileSync('migrations/0005_item_model.sql', 'utf8'));

  assert.equal(db.prepare('SELECT model_candidate_id FROM items WHERE id = ?').get(demoItemId)?.model_candidate_id, modelId);
  const insert = db.prepare('INSERT INTO items (id, campaign_id, model_candidate_id, display_name) VALUES (?, ?, ?, ?)');
  const first = randomUUID();
  const second = randomUUID();
  insert.run(first, campaignId, modelId, 'Instance A');
  insert.run(second, campaignId, modelId, 'Instance B');
  assert.notEqual(first, second);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM items WHERE model_candidate_id = ?').get(modelId)?.total, 3);

  assert.throws(() => insert.run(randomUUID(), campaignId, null, 'Sans modèle'));
  assert.throws(() => insert.run('2', campaignId, modelId, 'ID séquentiel'));
  const otherCampaign = randomUUID();
  db.prepare('INSERT INTO campaigns (id, slug, title) VALUES (?, ?, ?)').run(otherCampaign, 'autre', 'Autre');
  assert.throws(() => insert.run(randomUUID(), otherCampaign, modelId, 'Mauvaise campagne'));
  assert.throws(() => db.prepare('UPDATE model_candidates SET campaign_id = ? WHERE id = ?').run(otherCampaign, modelId));
  assert.throws(() => db.prepare('UPDATE items SET id = ? WHERE id = ?').run(randomUUID(), first));
  db.close();
});

test('une installation neuve crée la figurine fictive après son modèle', () => {
  const db = database(5);
  db.exec(readFileSync('scripts/seed-demo.sql', 'utf8'));
  db.exec(readFileSync('scripts/seed-demo.sql', 'utf8'));
  assert.equal(db.prepare('SELECT model_candidate_id FROM items WHERE id = ?').get(demoItemId)?.model_candidate_id, modelId);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM items').get()?.total, 1);
  db.close();
});

test('la migration refuse un item existant dont le modèle est inconnu', () => {
  const db = database(4);
  db.prepare('INSERT INTO campaigns (id, slug, title) VALUES (?, ?, ?)').run(campaignId, 'halloween-2026', 'Halloween 2026');
  db.prepare('INSERT INTO model_candidates (id, campaign_id, name) VALUES (?, ?, ?)').run(modelId, campaignId, 'Modèle #1');
  db.prepare('INSERT INTO items (id, campaign_id, display_name) VALUES (?, ?, ?)').run(randomUUID(), campaignId, 'Modèle inconnu');
  assert.throws(() => db.exec(readFileSync('migrations/0005_item_model.sql', 'utf8')));
  db.close();
});
