import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { classItemsQuery } from './class-items.ts';
import { itemPresentation } from './item-presentation.ts';

test('l’Escouade grenouille utilise les cinq tags CSV, leurs noms et leurs images individuelles', () => {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../../migrations/', import.meta.url);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    for (const file of readdirSync(migrations).sort().filter((name) => name.endsWith('.sql') && name < '0013')) db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    db.exec("INSERT INTO scan_events (id, item_id) VALUES ('preserved', '94158f04-db1d-4d99-b4c7-079bff27739b')");
    const existing = db.prepare('SELECT * FROM items ORDER BY id').all();
    db.exec(readFileSync(new URL('0013_frog_squad.sql', migrations), 'utf8'));
    const group = db.prepare("SELECT * FROM figurine_classes WHERE slug = 'grenouille-halloween'").get();
    assert.equal(group?.name_fr, 'L’Escouade grenouille');
    assert.equal(group?.image_key, 'escouade_grenouilles.png');
    assert.ok(existsSync(new URL(`../assets/items/${group?.image_key}`, import.meta.url)));
    const frogs = db.prepare(classItemsQuery).all('00000000-0000-4000-8000-000000000000', 'halloween-2026:grenouille-halloween');
    assert.equal(frogs.length, 5);
    const csv = readFileSync(new URL('../../data/instances/grenouilles-halloween.csv', import.meta.url), 'utf8');
    const expected = [
      ['Nox', 'Grenouille citrouille', 'Pumpkin frog'], ['Draco', 'Grenouille vampire', 'Vampire frog'],
      ['Boo', 'Grenouille fantôme', 'Ghost frog'], ['Luna', 'Grenouille sorcière', 'Witch frog'], ['Echo', 'Grenouille chauve-souris', 'Bat frog'],
    ];
    for (const [nickname, fr, en] of expected) {
      const frog = frogs.find((item) => item.nickname === nickname)!;
      assert.ok(frog);
      assert.ok(csv.includes(`/t/${frog.id},${nickname} |`));
      assert.equal(frog.display_name, fr);
      assert.equal(frog.display_name_en, en);
      assert.equal(frog.image_key, `${nickname.toLowerCase()}.png`);
      assert.equal(frog.public_slug, `grenouille-halloween-${nickname.toLowerCase()}`);
      assert.ok(existsSync(new URL(`../assets/items/${frog.image_key}`, import.meta.url)));
      assert.equal(frog.latest_disposition, null);
      assert.equal(itemPresentation({ display_name: fr, display_name_en: en, nickname }, 'fr').greeting, `Bravo tu as trouvé ${nickname}!`);
    }
    assert.deepEqual(db.prepare("SELECT * FROM items WHERE class_id IS NULL OR class_id != 'halloween-2026:grenouille-halloween' ORDER BY id").all(), existing);
    assert.equal(db.prepare("SELECT item_id FROM scan_events WHERE id = 'preserved'").get()?.item_id, '94158f04-db1d-4d99-b4c7-079bff27739b');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { db.close(); }
});
