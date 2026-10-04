import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { itemPresentation, validItemImageKey } from './item-presentation.ts';
import { classItemsQuery } from './class-items.ts';

test('titres individuels FR/EN, sans traduction et sans surnom', () => {
  const pixel = { display_name: 'Chat fantôme', display_name_en: 'Ghost cat', nickname: 'Pixel' };
  assert.deepEqual(itemPresentation(pixel, 'fr'), { name: 'Chat fantôme', title: 'Pixel', subtitle: 'Chat fantôme', greeting: 'Bravo tu as trouvé Pixel!' });
  assert.equal(itemPresentation(pixel, 'en').subtitle, 'Ghost cat');
  assert.equal(itemPresentation({ ...pixel, display_name_en: null }, 'en').name, 'Chat fantôme');
  const unnamed = itemPresentation({ ...pixel, nickname: null }, 'en');
  assert.equal(unnamed.greeting, 'Well done! You found Ghost cat!');
  assert.equal(unnamed.subtitle, null);
  assert.equal(itemPresentation({ display_name: 'Token', display_name_en: null, nickname: 'Token' }, 'fr').subtitle, null);
});

test('les références d’image acceptent les fichiers locaux simples uniquement', () => {
  for (const key of ['', 'chat_fantome.jpg', 'item-2.jpeg', 'image.png', 'photo.webp']) assert.ok(validItemImageKey(key), key);
  for (const key of ['../photo.jpg', 'folder/photo.jpg', 'https://example.com/photo.jpg', 'Photo.JPG', 'photo.svg', 'photo.jpg?x=1', 'a'.repeat(121) + '.jpg']) assert.equal(validItemImageKey(key), false, key);
});

test('la migration reprend les images sans confondre nom individuel et thème ni modifier l’historique', () => {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../../migrations/', import.meta.url);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    for (const file of readdirSync(migrations).sort().filter((name) => name.endsWith('.sql') && name < '0012')) db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    db.exec(`UPDATE items SET display_name = 'Citrouille souriante' WHERE nickname = 'Pixel';
      INSERT INTO scan_events (id, item_id) SELECT 'preserved', id FROM items WHERE nickname = 'Pixel';
      INSERT INTO scan_responses (scan_event_id, disposition) VALUES ('preserved', 'keep');`);
    const before = db.prepare('SELECT id, nickname, public_slug, class_id FROM items ORDER BY id').all();
    db.exec(readFileSync(new URL('0012_item_images_names.sql', migrations), 'utf8'));
    assert.deepEqual(db.prepare('SELECT id, nickname, public_slug, class_id FROM items ORDER BY id').all(), before);
    const cats = db.prepare(classItemsQuery).all('00000000-0000-4000-8000-000000000000', 'halloween-2026:chat-fantome');
    assert.equal(cats.length, 6);
    assert.ok(cats.every((item) => item.image_key === 'chat_fantome.jpg'));
    const pixel = cats.find((item) => item.nickname === 'Pixel')!;
    assert.equal(pixel.display_name_en, null);
    assert.equal(pixel.latest_disposition, 'keep');
    assert.equal(cats.find((item) => item.nickname === 'Moustache')?.display_name_en, 'Ghost cat');
    assert.equal(db.prepare("SELECT image_key FROM figurine_classes WHERE slug = 'chat-fantome'").get()?.image_key, 'chat_fantome.jpg');
    assert.equal(db.prepare("SELECT image_key FROM items WHERE display_name = 'Token'").get()?.image_key, null);
    db.exec(`UPDATE items SET image_key = 'citrouille.jpg', display_name_en = 'Smiling pumpkin' WHERE nickname = 'Pixel';
      UPDATE items SET image_key = NULL WHERE nickname = 'Moustache';`);
    const changed = db.prepare(classItemsQuery).all('00000000-0000-4000-8000-000000000000', 'halloween-2026:chat-fantome');
    assert.equal(changed.find((item) => item.nickname === 'Pixel')?.image_key, 'citrouille.jpg');
    assert.equal(changed.find((item) => item.nickname === 'Moustache')?.image_key, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM scan_events WHERE id = 'preserved'").get()?.total, 1);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { db.close(); }
});
