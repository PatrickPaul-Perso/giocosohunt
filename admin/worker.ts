import { itemSummaryColumns, itemSummaryJoin, latestResponse, itemStateLabel, stateDate, type ItemSummary } from '../src/lib/item-state.ts';
import { privatePhotoCoordinates } from '../src/lib/private-location.ts';
import { validItemImageKey } from '../src/lib/item-presentation.ts';
import { sanitizeCluePhoto } from '../src/lib/clue-photo.ts';
type AdminEnv = {
  DB: D1Database;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

type Target = 'local' | 'remote';
type Campaign = { id: string; slug: string; title: string };
type Item = ItemSummary & { id: string; display_name: string; display_name_en: string | null; image_key: string | null; nickname: string | null; public_slug: string | null; campaign_slug: string; clue_text: string | null; has_photo: number; moderation_status: string | null; public_clue_consent_at: string | null; social_platform: string | null; social_handle: string | null; email: string | null; shoutout_at: string | null };
type Setting = { key: string; value: string };
type Review = { social_platform: string | null; social_handle: string | null; email: string | null; shoutout_at: string | null; scan_event_id: string; occurred_at: string; item_name: string; nickname: string | null; campaign_slug: string; disposition: string; clue_text: string | null; has_photo: number; moderation_status: 'pending' | 'approved' | 'rejected'; public_clue_consent_at: string | null; map_location_consent_at: string | null; rehide_location_consent_at: string | null };
type QueryResult<T> = { results: T[] };

const databaseId = '9fcf24de-112d-4608-882b-08f0553dec73';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

function targetOf(value: string | null): Target {
  return value === 'remote' ? 'remote' : 'local';
}

async function query<T>(env: AdminEnv, target: Target, sql: string, params: (string | null)[] = []): Promise<QueryResult<T>> {
  if (target === 'local') {
    const result = await env.DB.prepare(sql).bind(...params).all<T>();
    return { results: result.results };
  }
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('Définissez CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID dans le conteneur pour utiliser la D1 distante.');
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const body = await response.json() as {
    success?: boolean;
    errors?: { message: string }[];
    result?: { success: boolean; results: T[] }[];
  };
  if (!response.ok || !body.success || !body.result?.[0]?.success) {
    throw new Error(body.errors?.map(({ message }) => message).join('; ') || `Cloudflare D1: HTTP ${response.status}`);
  }
  return { results: body.result[0].results ?? [] };
}

async function batch(env: AdminEnv, target: Target, statements: { sql: string; params: (string | null)[] }[]): Promise<void> {
  if (target === 'local') {
    await env.DB.batch(statements.map(({ sql, params }) => env.DB.prepare(sql).bind(...params)));
    return;
  }
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('Identifiants Cloudflare manquants.');
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: statements }),
  });
  const body = await response.json() as { success?: boolean; errors?: { message: string }[]; result?: { success: boolean }[] };
  if (!response.ok || !body.success || body.result?.some((item) => !item.success)) {
    throw new Error(body.errors?.map(({ message }) => message).join('; ') || `Cloudflare D1: HTTP ${response.status}`);
  }
}

const scalar = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

async function perform(env: AdminEnv, target: Target, data: FormData): Promise<string> {
  const action = scalar(data, 'action');
  if (action === 'item_missing' || action === 'item_missing_clear') {
    const id = scalar(data, 'id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Figurine invalide.');
    const existing = await query(env, target, 'SELECT id FROM items WHERE id = ?', [id]);
    if (!existing.results.length) throw new Error('Figurine introuvable.');
    await query(env, target, action === 'item_missing'
      ? `UPDATE items AS i SET missing_at = CURRENT_TIMESTAMP, missing_after_scan_id = ${latestResponse} WHERE id = ?`
      : 'UPDATE items SET missing_at = NULL, missing_after_scan_id = NULL WHERE id = ?', [id]);
    return 'État enregistré.';
  }
  if (action === 'shoutout_done' || action === 'shoutout_clear') {
    const id = scalar(data, 'scan_event_id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Scan invalide.');
    const existing = await query(env, target, `SELECT scan_event_id FROM scan_responses WHERE scan_event_id = ? AND social_consent_at IS NOT NULL AND social_handle IS NOT NULL`, [id]);
    if (!existing.results.length) throw new Error('Shoutout sans consentement social.');
    await query(env, target, `UPDATE scan_responses SET shoutout_at = ${action === 'shoutout_done' ? 'COALESCE(shoutout_at, CURRENT_TIMESTAMP)' : 'NULL'} WHERE scan_event_id = ? AND social_consent_at IS NOT NULL AND social_handle IS NOT NULL`, [id]);
    return 'Shoutout enregistré.';
  }
  if (action === 'campaign_create') {
    const slug = scalar(data, 'slug');
    const title = scalar(data, 'title');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || title.length < 1 || title.length > 80) throw new Error('Slug ou titre de campagne invalide.');
    await query(env, target, 'INSERT INTO campaigns (id, slug, title) VALUES (?, ?, ?)', [crypto.randomUUID(), slug, title]);
    return 'Campagne créée.';
  }
  if (action === 'campaign_update') {
    const id = scalar(data, 'id');
    const title = scalar(data, 'title');
    if (!/^[0-9a-f-]{36}$/i.test(id) || title.length < 1 || title.length > 80) throw new Error('Campagne ou titre invalide.');
    await query(env, target, 'UPDATE campaigns SET title = ? WHERE id = ?', [title, id]);
    return 'Campagne mise à jour.';
  }
  if (action === 'item_update') {
    const id = scalar(data, 'id');
    const nickname = scalar(data, 'nickname');
    const slug = scalar(data, 'public_slug');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !nickname || nickname.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      throw new Error('Surnom ou adresse publique invalide. Utilisez un slug en minuscules avec des tirets.');
    }
    const displayName = scalar(data, 'display_name');
    const displayNameEn = scalar(data, 'display_name_en');
    const imageKey = scalar(data, 'image_key');
    if (!displayName || displayName.length > 80 || displayNameEn.length > 80) throw new Error('Les noms doivent contenir au plus 80 caractères; le nom français est obligatoire.');
    if (!validItemImageKey(imageKey)) throw new Error('Utilisez un nom de fichier image simple en minuscules : jpg, jpeg, png ou webp.');
    const existing = await query<Item>(env, target, 'SELECT id FROM items WHERE id = ?', [id]);
    if (!existing.results.length) throw new Error('Figurine introuvable.');
    await query(env, target, 'UPDATE items SET nickname = ?, public_slug = ?, display_name = ?, display_name_en = ?, image_key = ? WHERE id = ?', [nickname, slug, displayName, displayNameEn || null, imageKey || null, id]);
    return 'Figurine mise à jour.';
  }
  if (action === 'scan_review_approve' || action === 'scan_review_hold' || action === 'scan_review_reject') {
    const id = scalar(data, 'scan_event_id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Identifiant de scan invalide.');
    const existing = await query<{ moderation_status: string }>(env, target,
      'SELECT moderation_status FROM scan_responses WHERE scan_event_id = ?', [id]);
    const status = existing.results[0]?.moderation_status;
    if (!status || status === 'rejected') throw new Error('Cette réponse ne peut plus être modérée.');
    if (action === 'scan_review_approve') {
      if (status !== 'pending') throw new Error('Seule une réponse en attente peut être approuvée.');
      await query(env, target, `UPDATE scan_responses SET moderation_status = 'approved', moderated_at = CURRENT_TIMESTAMP
        WHERE scan_event_id = ? AND moderation_status = 'pending'`, [id]);
      return 'Réponse approuvée et détails consentis publiés.';
    }
    if (action === 'scan_review_hold') {
      if (status !== 'approved') throw new Error('Seule une réponse approuvée peut être remise en attente.');
      await query(env, target, `UPDATE scan_responses SET moderation_status = 'pending', moderated_at = NULL
        WHERE scan_event_id = ? AND moderation_status = 'approved'`, [id]);
      return 'Publication suspendue.';
    }
    await query(env, target, `UPDATE scan_responses SET moderation_status = 'rejected', moderated_at = CURRENT_TIMESTAMP
      WHERE scan_event_id = ? AND moderation_status IN ('pending', 'approved')`, [id]);
    return 'Réponse rejetée; détails conservés privés.';
  }
  if (action === 'settings_save') {
    const active = scalar(data, 'active_campaign_id');
    const campaign = await query<Campaign>(env, target, 'SELECT id, slug, title FROM campaigns WHERE id = ?', [active]);
    if (!campaign.results.length) throw new Error('La campagne active est introuvable.');
    const colors = ['theme_background', 'theme_text', 'theme_accent'];
    for (const key of colors) if (!/^#[0-9a-f]{6}$/i.test(scalar(data, key))) throw new Error('Une couleur hexadécimale est invalide.');
    for (const key of ['headline_fr', 'headline_en']) {
      const value = scalar(data, key);
      if (!value || value.length > 200) throw new Error('Les deux accroches doivent contenir entre 1 et 200 caractères.');
    }
    const fudge = Number(scalar(data, 'location_fudge_max_meters'));
    if (!Number.isInteger(fudge) || fudge < 100 || fudge > 1000) throw new Error('Le décalage maximal doit être entre 100 et 1000 mètres.');
    const prefix = `campaign:${active}:`;
    const settings: [string, string][] = [['active_campaign_id', active]];
    for (const key of [...colors, 'headline_fr', 'headline_en']) settings.push([prefix + key, scalar(data, key)]);
    settings.push([prefix + 'location_fudge_max_meters', String(fudge)]);
    await batch(env, target, settings.map(([key, value]) => ({
      sql: 'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      params: [key, value],
    })));
    return 'Paramètres enregistrés.';
  }
  throw new Error('Opération inconnue.');
}

function confirm(target: Target) {
  return target === 'remote'
    ? '<label class="confirm"><input type="checkbox" name="confirm_remote" required> Je confirme que cette modification affectera le site en production.</label>'
    : '';
}

function form(target: Target, action: string, contents: string, label: string) {
  return `<form method="post" action="/?target=${target}">
    <input type="hidden" name="target" value="${target}">
    <input type="hidden" name="action" value="${action}">
    ${contents}${confirm(target)}<button type="submit">${escape(label)}</button>
  </form>`;
}

async function render(env: AdminEnv, target: Target, message = '', status = 200): Promise<Response> {
  let campaigns: Campaign[] = [];
  let items: Item[] = [];
  let reviews: Review[] = [];
  let values: Record<string, string> = {};
  try {
    if (target === 'remote' && (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID)) {
      throw new Error('Mode distant indisponible : le jeton et l’identifiant du compte Cloudflare ne sont pas fournis au conteneur.');
    }
    const [campaignResult, settingsResult, itemResult, reviewResult] = await Promise.all([
      query<Campaign>(env, target, 'SELECT id, slug, title FROM campaigns ORDER BY created_at DESC'),
      query<Setting>(env, target, 'SELECT key, value FROM app_settings'),
      query<Item>(env, target, `SELECT i.id, i.display_name, i.display_name_en, i.image_key, i.nickname, i.public_slug, c.slug AS campaign_slug, ${itemSummaryColumns},
        latest.clue_text, latest.moderation_status, latest.public_clue_consent_at, latest.shoutout_at,
        CASE WHEN latest.social_consent_at IS NOT NULL THEN latest.social_platform END AS social_platform,
        CASE WHEN latest.social_consent_at IS NOT NULL THEN latest.social_handle END AS social_handle,
        CASE WHEN latest.email_consent_at IS NOT NULL THEN latest.email END AS email,
        CASE WHEN p.scan_event_id IS NOT NULL THEN 1 ELSE 0 END AS has_photo
        FROM items i ${itemSummaryJoin} LEFT JOIN scan_response_photos p ON p.scan_event_id = latest.scan_event_id JOIN campaigns c ON c.id = i.campaign_id ORDER BY c.slug, i.display_name, COALESCE(i.nickname, i.display_name), i.id`),
      query<Review>(env, target, `SELECT r.scan_event_id, s.occurred_at, i.display_name AS item_name, i.nickname,
        c.slug AS campaign_slug, r.disposition, r.clue_text, r.moderation_status, r.public_clue_consent_at,
        r.map_location_consent_at, r.rehide_location_consent_at, r.shoutout_at,
        CASE WHEN r.social_consent_at IS NOT NULL THEN r.social_platform END AS social_platform,
        CASE WHEN r.social_consent_at IS NOT NULL THEN r.social_handle END AS social_handle,
        CASE WHEN r.email_consent_at IS NOT NULL THEN r.email END AS email,
        CASE WHEN p.scan_event_id IS NOT NULL THEN 1 ELSE 0 END AS has_photo
        FROM scan_responses r JOIN scan_events s ON s.id = r.scan_event_id
        JOIN items i ON i.id = s.item_id JOIN campaigns c ON c.id = i.campaign_id
        LEFT JOIN scan_response_photos p ON p.scan_event_id = r.scan_event_id
        ORDER BY CASE WHEN r.moderation_status = 'pending' THEN 0 ELSE 1 END, s.occurred_at DESC LIMIT 100`),
    ]);
    campaigns = campaignResult.results;
    items = itemResult.results;
    reviews = reviewResult.results;
    values = Object.fromEntries(settingsResult.results.map(({ key, value }) => [key, value]));
  } catch (error) {
    message = error instanceof Error ? error.message : 'Lecture de la base impossible.';
    status = 503;
  }
  const active = values.active_campaign_id || campaigns[0]?.id || '';
  const options = campaigns.map((campaign) =>
    `<option value="${escape(campaign.id)}" ${campaign.id === active ? 'selected' : ''}>${escape(campaign.title)} (${escape(campaign.slug)})</option>`).join('');
  const campaignForms = campaigns.map((campaign) => form(target, 'campaign_update',
    `<input type="hidden" name="id" value="${escape(campaign.id)}"><label>Titre <input name="title" maxlength="80" value="${escape(campaign.title)}" required></label>`,
    `Enregistrer ${campaign.slug}`)).join('');
  const siteOrigin = target === 'remote' ? 'https://giocosohunt.forgenord.ca' : 'http://localhost:4321';
  const itemForms = items.map((item) => {
    const campaignPath = `/${encodeURIComponent(item.campaign_slug)}`;
    const scanUrl = `${siteOrigin}${campaignPath}/t/${encodeURIComponent(item.id)}`;
    const statsUrl = item.public_slug ? `${siteOrigin}${campaignPath}/figurines/${encodeURIComponent(item.public_slug)}` : null;
    return form(target, 'item_update',
      `<input type="hidden" name="id" value="${escape(item.id)}">
      <h3>${escape(item.nickname || item.display_name)}</h3>
      <p>Nom de la figurine : ${escape(item.display_name)} · Campagne : ${escape(item.campaign_slug)}</p>
      <p>UUID de l’instance : <code>${escape(item.id)}</code></p>
      <div class="item-links"><p>Statistiques : ${statsUrl ? `<a href="${escape(statsUrl)}" target="_blank" rel="noopener noreferrer">${escape(statsUrl)}</a>` : 'définissez un surnom et une adresse publique.'}</p>
      <p>Scan : <a href="${escape(scanUrl)}" target="_blank" rel="noopener noreferrer">${escape(scanUrl)}</a></p></div>
      <label>Nom français <input name="display_name" maxlength="80" value="${escape(item.display_name)}" required></label>
      <label>Nom anglais (facultatif) <input name="display_name_en" maxlength="80" value="${escape(item.display_name_en)}"></label>
      <label>Fichier image (facultatif) <input name="image_key" maxlength="120" value="${escape(item.image_key)}" placeholder="figurine.jpg"></label>
      <p>Ajoutez le fichier dans src/assets/items puis effectuez un build et un déploiement. Plusieurs figurines peuvent utiliser le même fichier. Aucun téléversement ici.</p>
      <label>Surnom public unique <input name="nickname" maxlength="80" value="${escape(item.nickname)}" required></label>
      <label>Adresse publique unique <input name="public_slug" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${escape(item.public_slug)}" required></label>`,
      'Enregistrer cette figurine');
  }).join('');
  const reviewCards = reviews.map((review) => {
    const label = `${review.nickname || review.item_name} · ${review.campaign_slug} · ${review.occurred_at}`;
    const photoUrl = `/photo/${encodeURIComponent(review.scan_event_id)}?target=${target}`;
    const reviewActions = review.moderation_status === 'rejected' ? '' : [
      review.moderation_status === 'pending' ? form(target, 'scan_review_approve',
        `<input type="hidden" name="scan_event_id" value="${escape(review.scan_event_id)}">`, 'Approuver la publication') : form(target, 'scan_review_hold',
        `<input type="hidden" name="scan_event_id" value="${escape(review.scan_event_id)}">`, 'Suspendre la publication'),
      form(target, 'scan_review_reject', `<input type="hidden" name="scan_event_id" value="${escape(review.scan_event_id)}">`, 'Rejeter et garder privé'),
    ].join('');
    return `<article class="review"><h3>${escape(label)}</h3>
      <p>Statut : <strong>${escape(review.moderation_status)}</strong> · Décision : ${escape(review.disposition)}</p>
      <p>Consentements publics : indice/photo ${review.public_clue_consent_at ? 'oui' : 'non'}, scan ${review.map_location_consent_at ? 'oui' : 'non'}, cachette ${review.rehide_location_consent_at ? 'oui' : 'non'}.</p>
      <p>Contact consenti : ${escape(review.social_platform || '—')} ${escape(review.social_handle || '')} · ${escape(review.email || '—')}</p>
      <p>Shoutout : ${review.social_handle ? review.shoutout_at ? 'Fait · ' + escape(stateDate(review.shoutout_at, 'fr')) : 'À faire' : 'Non applicable'}</p>
      ${review.social_handle ? form(target, review.shoutout_at ? 'shoutout_clear' : 'shoutout_done', `<input type="hidden" name="scan_event_id" value="${escape(review.scan_event_id)}">`, review.shoutout_at ? 'Annuler le shoutout' : 'Marquer le shoutout fait') : ''}
      <p>Indice : ${escape(review.clue_text || 'Aucun')}</p>
      ${review.has_photo ? `<img class="review-photo" src="${escape(photoUrl)}" alt="Photo d’indice privée à examiner" loading="lazy" referrerpolicy="no-referrer">` : '<p>Aucune photo.</p>'}
      <div class="review-actions">${reviewActions}</div></article>`;
  }).join('');
  const inventory = items.map(item => {
    const scanField = `<input type="hidden" name="scan_event_id" value="${escape(item.latest_scan_id)}">`;
    const itemField = `<input type="hidden" name="id" value="${escape(item.id)}">`;
    const shoutout = !item.social_handle ? 'na' : item.shoutout_at ? 'done' : 'todo';
    const moderation = item.latest_scan_id && item.moderation_status !== 'rejected' ?
      form(target, item.moderation_status === 'pending' ? 'scan_review_approve' : 'scan_review_hold', scanField, item.moderation_status === 'pending' ? 'Approuver' : 'Suspendre') + form(target, 'scan_review_reject', scanField, 'Rejeter') : '';
    return `<tr data-name="${escape(((item.nickname || '') + ' ' + item.display_name).toLowerCase())}" data-campaign="${escape(item.campaign_slug)}" data-state="${escape(item.current_state)}" data-moderation="${escape(item.moderation_status || 'none')}" data-shoutout="${shoutout}">
      <th scope="row">${escape(item.nickname || item.display_name)}<small>${escape(item.display_name)} · ${escape(item.campaign_slug)}</small></th>
      <td>${escape(itemStateLabel(item.current_state, 'fr'))}<small>${escape(stateDate(item.state_at, 'fr'))}</small>${form(target, item.current_state === 'missing' ? 'item_missing_clear' : 'item_missing', itemField, item.current_state === 'missing' ? 'Annuler le signalement' : 'Signaler perdue')}</td>
      <td>${item.participation_count}</td><td>${escape(item.social_platform || '—')} ${escape(item.social_handle || '')}<small>${escape(item.email || '—')}</small></td>
      <td data-location="${escape(item.id)}" data-latest="${escape(item.latest_scan_id)}">Chargement…</td>
      <td>${escape(item.clue_text || '—')}<small>Publication consentie : ${item.public_clue_consent_at ? 'oui' : 'non'}</small></td>
      <td>${item.has_photo ? `<button type="button" class="photo-open" data-photo="/photo/${encodeURIComponent(item.latest_scan_id!)}?target=${target}" aria-label="Agrandir la photo de ${escape(item.nickname || item.display_name)}"><img src="/photo/${encodeURIComponent(item.latest_scan_id!)}?target=${target}" alt="Photo d’indice" loading="lazy" referrerpolicy="no-referrer"></button>` : '—'}</td>
      <td>${escape(({pending:'En attente',approved:'Approuvée',rejected:'Rejetée'} as Record<string,string>)[item.moderation_status || ''] || 'Aucune réponse')}${moderation}</td>
      <td>${shoutout === 'na' ? 'Non applicable' : `${item.shoutout_at ? 'Fait · ' + escape(stateDate(item.shoutout_at, 'fr')) : 'À faire'}${form(target, item.shoutout_at ? 'shoutout_clear' : 'shoutout_done', scanField, item.shoutout_at ? 'Annuler' : 'Marquer fait')}`}</td>
    </tr>`;
  }).join('');
  const filters = `<label>Rechercher <input id="inventory-search" type="search" placeholder="Nom ou surnom"></label>` + [
    ['campaign', 'Campagne', [...new Set(items.map(i => i.campaign_slug))].map(v => [v,v])],
    ['state', 'État', ['initial','circulating','kept','missing'].map(v => [v,itemStateLabel(v as ItemSummary['current_state'],'fr')])],
    ['moderation','Modération',[['pending','En attente'],['approved','Approuvée'],['rejected','Rejetée'],['none','Aucune réponse']]],
    ['shoutout','Shoutout',[['todo','À faire'],['done','Fait'],['na','Non applicable']]],
  ].map(([key,label,options]) => `<label>${label}<select data-filter="${key}"><option value="">Tous</option>${(options as string[][]).map(([v,l]) => `<option value="${escape(v)}">${escape(l)}</option>`).join('')}</select></label>`).join('');
  const pick = (key: string) => values[`campaign:${active}:${key}`] ?? values[key];
  const color = (key: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(pick(key) || '') ? pick(key) : fallback;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Gestion locale — Giocoso Hunt</title><style>
      body{font:16px/1.5 system-ui,sans-serif;max-width:110rem;margin:auto;padding:1.5rem;background:#f8f5ef;color:#24231f}
      header{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}nav{display:flex;gap:.7rem}nav a{padding:.5rem 1rem;border:1px solid #aaa;border-radius:.4rem}
      nav a[aria-current]{background:#24231f;color:#fff}section{padding:1rem 0;border-top:1px solid #bbb}
      form{background:white;border:1px solid #ddd;border-radius:.4rem;padding:1rem;margin:.7rem 0}
      label{display:block;margin:.6rem 0}input:not([type=checkbox]),textarea,select{display:block;box-sizing:border-box;width:100%;max-width:36rem;padding:.5rem;font:inherit}
      button{padding:.6rem 1rem;background:#603b21;color:white;border:0;border-radius:.3rem;cursor:pointer}
      .confirm{color:#8b1a1a;font-weight:bold}.confirm input{display:inline}
      .target{padding:.6rem 1rem;border-radius:.4rem;font-weight:bold;background:${target === 'remote' ? '#ffe0df' : '#e3eee2'}}
      .message{padding:1rem;background:#fff3ca}
      .item-links{overflow-wrap:anywhere}.item-links p{margin:.4rem 0}.item-links a{font-weight:bold}code{overflow-wrap:anywhere}
      .review{background:white;border:1px solid #ddd;border-radius:.4rem;padding:1rem;margin:.7rem 0}.review form{display:inline-block;margin:.3rem}.review-photo{display:block;max-width:min(100%,24rem);max-height:24rem;border-radius:.4rem}.review-actions{display:flex;flex-wrap:wrap;gap:.5rem}
      .table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white}td:nth-child(6){min-width:14rem;max-width:24rem;overflow-wrap:anywhere}th,td{padding:.7rem;border:1px solid #ddd;text-align:left;vertical-align:top;min-width:8rem}td form{padding:0;border:0;background:transparent;margin:.5rem 0;font-size:.8rem}td button{padding:.4rem .6rem}thead th{background:#eee8df}tbody tr:nth-child(even){background:#fcfaf6}small{display:block;color:#665f56}td img{width:90px;height:70px;object-fit:cover}.photo-open{padding:0;background:transparent}.filters{display:flex;gap:1rem;flex-wrap:wrap}dialog{max-width:90vw;max-height:90vh}dialog img{display:block;max-width:85vw;max-height:75vh}details>summary{cursor:pointer;font-weight:bold;font-size:1.2rem;padding:1rem 0}tr[hidden]{display:none}
    </style></head><body><header><h1>Gestion Giocoso Hunt</h1><nav aria-label="Environnement">
      <a href="/?target=local" ${target === 'local' ? 'aria-current="page"' : ''}>Local</a>
      <a href="/?target=remote" ${target === 'remote' ? 'aria-current="page"' : ''}>Distant</a>
    </nav></header>
    <p class="target">Environnement sélectionné : ${target === 'remote' ? 'DISTANT — D1 Cloudflare en production' : 'LOCAL — D1 de développement'}</p>
    ${message ? `<p class="message" role="alert">${escape(message)}</p>` : ''}
    <section><h2>Inventaire des figurines</h2><p>Les états suivent les déclarations reçues, indépendamment de leur modération. Les coordonnées exactes et les contacts restent privés.</p><div class="filters">${filters}</div><p id="inventory-count" aria-live="polite"></p><div class="table-scroll"><table id="inventory"><caption>État actuel et dernière participation de chaque figurine</caption><thead><tr>${['Figurine','État / date','Participations','Contacts consentis','Coordonnées connues','Indice','Photo','Modération','Shoutout'].map(l=>`<th scope="col">${l}</th>`).join('')}</tr></thead><tbody>${inventory}</tbody></table></div></section>
    <details><summary>Paramètres</summary><section>
    ${form(target, 'settings_save', `
      <label>Campagne active <select name="active_campaign_id" required>${options}</select></label>
      <label>Arrière-plan <input name="theme_background" value="${escape(color('theme_background', '#f8f5ef'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Texte <input name="theme_text" value="${escape(color('theme_text', '#24231f'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Accent <input name="theme_accent" value="${escape(color('theme_accent', '#603b21'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Accroche française <input name="headline_fr" value="${escape(pick('headline_fr') || '')}" maxlength="200" required></label>
      <label>English headline <input name="headline_en" value="${escape(pick('headline_en') || '')}" maxlength="200" required></label>
      <label>Décalage maximal des points publics (mètres, 100 à 1000) <input name="location_fudge_max_meters" type="number" min="100" max="1000" step="1" value="${escape(pick('location_fudge_max_meters') || '300')}" required></label>
    `, 'Enregistrer les paramètres')}
    </section>
    </details><details><summary>Campagnes</summary><section>
      ${form(target, 'campaign_create', '<label>Slug <input name="slug" pattern="[a-z0-9-]+" required></label><label>Titre <input name="title" maxlength="80" required></label>', 'Créer une campagne')}
      ${campaignForms}
    </section>
    </details><details><summary>Modifier les figurines physiques</summary><section><p>Chaque carte représente une instance. La cible choisie détermine la base utilisée et le site ouvert par les liens. Le lien de scan crée un nouvel événement lorsqu’il est ouvert. Les anciennes adresses de statistiques peuvent cesser de fonctionner si vous modifiez le slug.</p>${itemForms}</section>
    </details><details><summary>Historique des demandes de validation</summary><section><p>Les indices, photos et positions restent privés jusqu’à approbation. Les réponses en attente sont affichées en premier. Un rejet garde les détails privés.</p>${reviewCards || '<p>Aucune réponse à examiner.</p>'}</section>
    </details><dialog id="photo-dialog" aria-label="Photo d’indice agrandie"><button type="button" id="photo-close">Fermer</button><img alt="Photo d’indice agrandie" referrerpolicy="no-referrer"></dialog>
    <script>
      const rows = [...document.querySelectorAll('#inventory tbody tr')];
      const search = document.querySelector('#inventory-search');
      const filters = [...document.querySelectorAll('[data-filter]')];
      function filterRows() {
        let count = 0;
        for (const row of rows) {
          row.hidden = !row.dataset.name.includes(search.value.toLowerCase()) || filters.some(f => f.value && row.dataset[f.dataset.filter] !== f.value);
          if (!row.hidden) count++;
        }
        document.querySelector('#inventory-count').textContent = count + ' figurines affichées';
      }
      search.addEventListener('input',filterRows); filters.forEach(f=>f.addEventListener('change',filterRows)); filterRows();
      const dialog = document.querySelector('#photo-dialog');
      document.querySelectorAll('.photo-open').forEach(b=>b.addEventListener('click',()=>{dialog.querySelector('img').src=b.dataset.photo;dialog.showModal();}));
      document.querySelector('#photo-close').addEventListener('click',()=>dialog.close());
      // Limit concurrent private location requests; no GPS is sent to a map service before a click.
      const cells = [...document.querySelectorAll('[data-location]')];
      async function loadLocations() {
        while(cells.length) {
          const cell=cells.shift();
          try {
            const response=await fetch('/location/'+encodeURIComponent(cell.dataset.location)+'?target=${target}');
            if(!response.ok) throw new Error();
            const point=await response.json();
            cell.textContent=point ? point.lat+', '+point.lon : 'Aucune position';
            if(point) {
              const info=document.createElement('small');info.textContent=point.label+' · '+point.at+(point.scanId!==cell.dataset.latest?' · Position antérieure':'');cell.append(info);
              const link=document.createElement('a');link.textContent='Ouvrir Google Maps';link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(point.lat+','+point.lon);link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';cell.append(link);
            }
          } catch {cell.textContent='Position indisponible';}
        }
      }
      Promise.all([loadLocations(),loadLocations(),loadLocations()]);
    </script></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' } });
}

type LocationRow = {
  scan_event_id: string; created_at: string;
  rehide_lat_milli: number | null; rehide_lon_milli: number | null; rehide_location_consent_at: string | null; rehide_location_source: string | null;
  map_lat_milli: number | null; map_lon_milli: number | null; map_location_consent_at: string | null; map_location_source: string | null;
  location_source: string | null; gps_consent_at: string | null; device_location_consent_at: string | null;
};
async function knownLocation(env: AdminEnv, target: Target, itemId: string): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer' };
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return new Response('Not Found', { status: 404 });
  try {
    const rows = await query<LocationRow>(env, target, `SELECT r.scan_event_id, r.created_at,
      r.rehide_lat_milli, r.rehide_lon_milli, r.rehide_location_consent_at, r.rehide_location_source,
      r.map_lat_milli, r.map_lon_milli, r.map_location_consent_at, r.map_location_source,
      p.location_source, p.gps_consent_at, p.device_location_consent_at
      FROM scan_responses r JOIN scan_events s ON s.id = r.scan_event_id
      LEFT JOIN scan_response_photos p ON p.scan_event_id = r.scan_event_id
      WHERE s.item_id = ? ORDER BY r.created_at DESC, r.rowid DESC`, [itemId]);
    for (const row of rows.results) {
      const consentedGps = row.location_source === 'photo' && row.gps_consent_at || row.location_source === 'device' && row.device_location_consent_at;
      if (consentedGps) {
        const photo = await query<{ jpeg_hex: string }>(env, target, `SELECT hex(jpeg) AS jpeg_hex FROM scan_response_photos WHERE scan_event_id = ?`, [row.scan_event_id]);
        const gps = privatePhotoCoordinates(photo.results[0]?.jpeg_hex || '');
        if (gps) return new Response(JSON.stringify({ ...gps, scanId: row.scan_event_id, at: stateDate(row.created_at, 'fr'), label: 'Exacte privée · ' + (row.location_source === 'photo' ? 'GPS photo' : 'Position du navigateur') }), { headers });
      }
      for (const [lat, lon, consent, source, label] of [
        [row.rehide_lat_milli, row.rehide_lon_milli, row.rehide_location_consent_at, row.rehide_location_source, 'Cachette'],
        [row.map_lat_milli, row.map_lon_milli, row.map_location_consent_at, row.map_location_source, 'Scan'],
      ] as const) {
        if (consent && (source === 'device' || source === 'manual') && lat !== null && lon !== null && Number.isInteger(lat) && Number.isInteger(lon) && Math.abs(lat) <= 90_000 && Math.abs(lon) <= 180_000) {
          return new Response(JSON.stringify({ lat: lat / 1000, lon: lon / 1000, scanId: row.scan_event_id, at: stateDate(row.created_at, 'fr'), label: label + ' approximative · ' + (source === 'device' ? 'Navigateur' : 'Carte manuelle') }), { headers });
        }
      }
    }
    return new Response('null', { headers });
  } catch { return new Response('Position indisponible', { status: 503, headers }); }
}

async function reviewPhoto(env: AdminEnv, target: Target, scanId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) return new Response('Not Found', { status: 404 });
  try {
    const row = await query<{ jpeg_hex: string }>(env, target,
      `SELECT hex(p.jpeg) AS jpeg_hex FROM scan_response_photos p
       JOIN scan_responses r ON r.scan_event_id = p.scan_event_id
       WHERE r.scan_event_id = ?`, [scanId]);
    const hex = row.results[0]?.jpeg_hex;
    if (!hex || !/^(?:[0-9a-f]{2})+$/i.test(hex) || hex.length > 600_000) return new Response('Not Found', { status: 404 });
    const bytes = Uint8Array.from({ length: hex.length / 2 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
    const photo = sanitizeCluePhoto(bytes, false).jpeg;
    return new Response(photo.buffer as ArrayBuffer, { headers: {
      'content-type': 'image/jpeg', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer',
    } });
  } catch {
    return new Response('Photo indisponible', { status: 503 });
  }
}

export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return new Response('Not Found', { status: 404 });
    const target = targetOf(url.searchParams.get('target'));
    if (url.pathname.startsWith('/location/')) {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      return knownLocation(env, target, url.pathname.slice('/location/'.length));
    }
    if (url.pathname.startsWith('/photo/')) {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      return reviewPhoto(env, target, url.pathname.slice('/photo/'.length));
    }
    if (url.pathname !== '/') return new Response('Not Found', { status: 404 });
    if (request.method === 'GET') return render(env, target, url.searchParams.has('saved') ? 'Modification enregistrée.' : '');
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return new Response('Forbidden', { status: 403 });
    }
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Unsupported Media Type', { status: 415 });
    if (Number(request.headers.get('content-length') ?? 0) > 10_000) return new Response('Payload Too Large', { status: 413 });
    const data = await request.formData();
    if (scalar(data, 'target') !== target) return new Response('Target mismatch', { status: 400 });
    if (target === 'remote' && !data.has('confirm_remote')) return render(env, target, 'Confirmez explicitement la modification de la D1 distante.', 400);
    try {
      await perform(env, target, data);
      return Response.redirect(`${url.origin}/?target=${target}&saved=1`, 303);
    } catch (error) {
      return render(env, target, error instanceof Error ? error.message : 'Modification impossible.', 400);
    }
  },
};
