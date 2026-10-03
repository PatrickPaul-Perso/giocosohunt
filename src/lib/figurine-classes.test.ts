import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migrations = new URL('../../migrations/', import.meta.url);

for (const existing of [false, true]) {
  test(`classes et 12 instances sur une base ${existing ? 'existante, en conservant son historique' : 'neuve'}`, () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('PRAGMA foreign_keys = ON');
      for (const file of readdirSync(migrations).sort().filter((name) => name.endsWith('.sql') && name < '0009')) {
        db.exec(readFileSync(new URL(file, migrations), 'utf8'));
      }
      if (existing) {
        db.exec(readFileSync(new URL('../../scripts/seed-demo.sql', import.meta.url), 'utf8'));
        db.exec(`UPDATE items SET nickname = 'Mon chat', public_slug = 'mon-chat' WHERE id = '00000000-0000-4000-8000-000000000001';
          INSERT INTO scan_events (id, item_id) VALUES ('existing-scan', '00000000-0000-4000-8000-000000000001');`);
      }
      db.exec(readFileSync(new URL('0009_figurine_classes.sql', migrations), 'utf8'));
      assert.equal(db.prepare('SELECT COUNT(*) AS total FROM items').get()?.total, 12);
      assert.equal(db.prepare('SELECT COUNT(*) AS total FROM figurine_classes').get()?.total, 2);
      assert.deepEqual(db.prepare('SELECT COUNT(*) AS total FROM items GROUP BY class_id').all().map((row) => row.total), [6, 6]);
      assert.equal(db.prepare('SELECT COUNT(DISTINCT public_slug) AS total FROM items').get()?.total, 12);
      assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
      if (existing) {
        assert.equal(db.prepare("SELECT item_id FROM scan_events WHERE id = 'existing-scan'").get()?.item_id, '00000000-0000-4000-8000-000000000001');
        const item = db.prepare("SELECT nickname, public_slug FROM items WHERE id = '00000000-0000-4000-8000-000000000001'").get();
        assert.equal(item?.nickname, 'Mon chat');
        assert.equal(item?.public_slug, 'mon-chat');
      }
    } finally { db.close(); }
  });
}
