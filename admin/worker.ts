import { etsyListingUrl, imageKey } from '../src/lib/model-media.ts';
type AdminEnv = {
  DB: D1Database;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

type Target = 'local' | 'remote';
type Campaign = { id: string; slug: string; title: string };
type Item = { id: string; display_name: string; nickname: string | null; public_slug: string | null; campaign_slug: string };
type Candidate = { id: string; name: string; description: string | null; image_key: string | null; etsy_url: string | null };
type Setting = { key: string; value: string };
type Entry = { campaign: string; email: string; choice_type: string; choice: string; updated_at: string };
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
    const existing = await query<Item>(env, target, 'SELECT id FROM items WHERE id = ?', [id]);
    if (!existing.results.length) throw new Error('Figurine introuvable.');
    await query(env, target, 'UPDATE items SET nickname = ?, public_slug = ? WHERE id = ?', [nickname, slug, id]);
    return 'Surnom et adresse publique enregistrés.';
  }
  if (action === 'candidate_create') {
    const name = scalar(data, 'name');
    const description = scalar(data, 'description');
    const active = scalar(data, 'active_campaign_id');
    const image = scalar(data, 'image_key');
    const etsy = scalar(data, 'etsy_url');
    if ((image && imageKey(image) !== image) || (etsy && !etsyListingUrl(etsy))) throw new Error('Photo ou lien Etsy invalide.');
    if (name.length < 2 || name.length > 80 || description.length > 500) throw new Error('Nom ou description de modèle invalide.');
    const exists = await query<Campaign>(env, target, 'SELECT id, slug, title FROM campaigns WHERE id = ?', [active]);
    if (!exists.results.length) throw new Error('La campagne active est introuvable.');
    await query(env, target, 'INSERT INTO model_candidates (id, campaign_id, name, description, image_key, etsy_url) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), active, name, description, image || null, etsy ? etsyListingUrl(etsy) : null]);
    return 'Modèle ajouté au catalogue global.';
  }
  if (action === 'candidate_update') {
    const id = scalar(data, 'id');
    const name = scalar(data, 'name');
    const description = scalar(data, 'description');
    const image = scalar(data, 'image_key');
    const etsy = scalar(data, 'etsy_url');
    if ((image && imageKey(image) !== image) || (etsy && !etsyListingUrl(etsy))) throw new Error('Photo ou lien Etsy invalide.');
    if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2 || name.length > 80 || description.length > 500) throw new Error('Modèle invalide.');
    await query(env, target, 'UPDATE model_candidates SET name = ?, description = ?, image_key = ?, etsy_url = ? WHERE id = ?', [name, description, image || null, etsy ? etsyListingUrl(etsy) : null, id]);
    return 'Modèle mis à jour.';
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
    const terms = scalar(data, 'contest_terms_url');
    if (terms && (!terms.startsWith('https://') || terms.length > 500)) throw new Error('Le lien des modalités doit être une URL HTTPS.');
    const fudge = Number(scalar(data, 'location_fudge_max_meters'));
    if (!Number.isInteger(fudge) || fudge < 100 || fudge > 1000) throw new Error('Le décalage maximal doit être entre 100 et 1000 mètres.');
    const open = data.has('contest_open');
    if (open && !terms) throw new Error('Publiez les modalités du tirage avant de l’ouvrir.');
    const prefix = `campaign:${active}:`;
    const settings: [string, string][] = [['active_campaign_id', active]];
    for (const key of [...colors, 'headline_fr', 'headline_en']) settings.push([prefix + key, scalar(data, key)]);
    settings.push([prefix + 'contest_terms_url', terms], [prefix + 'contest_open', open ? 'true' : 'false'],
      [prefix + 'location_fudge_max_meters', String(fudge)]);
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
  let candidates: Candidate[] = [];
  let items: Item[] = [];
  let entries: Entry[] = [];
  let values: Record<string, string> = {};
  try {
    if (target === 'remote' && (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID)) {
      throw new Error('Mode distant indisponible : le jeton et l’identifiant du compte Cloudflare ne sont pas fournis au conteneur.');
    }
    const [campaignResult, candidateResult, settingsResult, entryResult, itemResult] = await Promise.all([
      query<Campaign>(env, target, 'SELECT id, slug, title FROM campaigns ORDER BY created_at DESC'),
      query<Candidate>(env, target, 'SELECT id, name, description, image_key, etsy_url FROM model_candidates ORDER BY name, id'),
      query<Setting>(env, target, 'SELECT key, value FROM app_settings'),
      query<Entry>(env, target, `SELECT c.title AS campaign, v.email, v.choice_type,
        CASE WHEN v.choice_type = 'candidate' THEN m.name ELSE v.proposed_name END AS choice,
        v.updated_at FROM vote_entries v
        JOIN campaigns c ON c.id = v.campaign_id
        LEFT JOIN model_candidates m ON m.id = v.candidate_id
        ORDER BY v.updated_at DESC LIMIT 100`),
      query<Item>(env, target, `SELECT i.id, i.display_name, i.nickname, i.public_slug, c.slug AS campaign_slug
        FROM items i JOIN campaigns c ON c.id = i.campaign_id ORDER BY c.slug, i.created_at, i.id`),
    ]);
    campaigns = campaignResult.results;
    items = itemResult.results;
    candidates = candidateResult.results;
    entries = entryResult.results;
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
      <label>Surnom public unique <input name="nickname" maxlength="80" value="${escape(item.nickname)}" required></label>
      <label>Adresse publique unique <input name="public_slug" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${escape(item.public_slug)}" required></label>`,
      'Enregistrer cette figurine');
  }).join('');
  const candidateForms = candidates.map((candidate) => form(target, 'candidate_update',
    `<input type="hidden" name="id" value="${escape(candidate.id)}">
      <label>Nom <input name="name" maxlength="80" value="${escape(candidate.name)}" required></label>
      <label>Description <textarea name="description" maxlength="500">${escape(candidate.description)}</textarea></label>
      <label>Fichier photo dans src/assets/models <input name="image_key" value="${escape(candidate.image_key)}" placeholder="modele.jpg"></label>
      <label>URL de la fiche Etsy <input name="etsy_url" type="url" value="${escape(candidate.etsy_url)}" placeholder="https://www.etsy.com/listing/…"></label>`,
    'Enregistrer ce modèle')).join('');
  const entryRows = entries.map((entry) =>
    `<tr><td>${escape(entry.campaign)}</td><td>${escape(entry.email)}</td><td>${escape(entry.choice_type)}</td><td>${escape(entry.choice)}</td><td>${escape(entry.updated_at)}</td></tr>`).join('');
  const pick = (key: string) => values[`campaign:${active}:${key}`] ?? values[key];
  const color = (key: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(pick(key) || '') ? pick(key) : fallback;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Gestion locale — Giocoso Hunt</title><style>
      body{font:16px/1.5 system-ui,sans-serif;max-width:70rem;margin:auto;padding:1.5rem;background:#f8f5ef;color:#24231f}
      header{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}nav{display:flex;gap:.7rem}nav a{padding:.5rem 1rem;border:1px solid #aaa;border-radius:.4rem}
      nav a[aria-current]{background:#24231f;color:#fff}section{padding:1rem 0;border-top:1px solid #bbb}
      form{background:white;border:1px solid #ddd;border-radius:.4rem;padding:1rem;margin:.7rem 0}
      label{display:block;margin:.6rem 0}input:not([type=checkbox]),textarea,select{display:block;box-sizing:border-box;width:100%;max-width:36rem;padding:.5rem;font:inherit}
      button{padding:.6rem 1rem;background:#603b21;color:white;border:0;border-radius:.3rem;cursor:pointer}
      .confirm{color:#8b1a1a;font-weight:bold}.confirm input{display:inline}
      .target{padding:.6rem 1rem;border-radius:.4rem;font-weight:bold;background:${target === 'remote' ? '#ffe0df' : '#e3eee2'}}
      .message{padding:1rem;background:#fff3ca}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:.5rem;text-align:left}
      .overflow{overflow-x:auto}.item-links{overflow-wrap:anywhere}.item-links p{margin:.4rem 0}.item-links a{font-weight:bold}code{overflow-wrap:anywhere}
    </style></head><body><header><h1>Gestion Giocoso Hunt</h1><nav aria-label="Environnement">
      <a href="/?target=local" ${target === 'local' ? 'aria-current="page"' : ''}>Local</a>
      <a href="/?target=remote" ${target === 'remote' ? 'aria-current="page"' : ''}>Distant</a>
    </nav></header>
    <p class="target">Environnement sélectionné : ${target === 'remote' ? 'DISTANT — D1 Cloudflare en production' : 'LOCAL — D1 de développement'}</p>
    ${message ? `<p class="message" role="alert">${escape(message)}</p>` : ''}
    <section><h2>Paramètres</h2>
    ${form(target, 'settings_save', `
      <label>Campagne active <select name="active_campaign_id" required>${options}</select></label>
      <label>Arrière-plan <input name="theme_background" value="${escape(color('theme_background', '#f8f5ef'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Texte <input name="theme_text" value="${escape(color('theme_text', '#24231f'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Accent <input name="theme_accent" value="${escape(color('theme_accent', '#603b21'))}" pattern="#[0-9a-fA-F]{6}" required></label>
      <label>Accroche française <input name="headline_fr" value="${escape(pick('headline_fr') || '')}" maxlength="200" required></label>
      <label>English headline <input name="headline_en" value="${escape(pick('headline_en') || '')}" maxlength="200" required></label>
      <label>Décalage maximal des points publics (mètres, 100 à 1000) <input name="location_fudge_max_meters" type="number" min="100" max="1000" step="1" value="${escape(pick('location_fudge_max_meters') || '300')}" required></label>
      <label>URL HTTPS des modalités du tirage <input name="contest_terms_url" type="url" value="${escape(pick('contest_terms_url') || '')}" maxlength="500"></label>
      <label><input type="checkbox" name="contest_open" ${pick('contest_open') === 'true' ? 'checked' : ''}> Ouvrir le tirage (modalités publiées et validées)</label>
    `, 'Enregistrer les paramètres')}
    </section>
    <section><h2>Campagnes</h2>
      ${form(target, 'campaign_create', '<label>Slug <input name="slug" pattern="[a-z0-9-]+" required></label><label>Titre <input name="title" maxlength="80" required></label>', 'Créer une campagne')}
      ${campaignForms}
    </section>
    <section><h2>Figurines physiques</h2><p>Chaque carte représente une instance. La cible choisie détermine la base utilisée et le site ouvert par les liens. Le lien de scan crée un nouvel événement lorsqu’il est ouvert. Les anciennes adresses de statistiques peuvent cesser de fonctionner si vous modifiez le slug.</p>${itemForms}</section>
    <section><h2>Modèles du catalogue global</h2><p>Les photos doivent être ajoutées à src/assets/models dans le dépôt, puis déployées avec le Worker public. Utilisez seulement une URL HTTPS de fiche produit Etsy.</p>
      ${form(target, 'candidate_create', `<input type="hidden" name="active_campaign_id" value="${escape(active)}"><label>Nom <input name="name" maxlength="80" required></label><label>Description <textarea name="description" maxlength="500"></textarea></label><label>Fichier photo dans src/assets/models <input name="image_key" placeholder="modele.jpg"></label><label>URL de la fiche Etsy <input name="etsy_url" type="url" placeholder="https://www.etsy.com/listing/…"></label>`, 'Ajouter un modèle')}
      ${candidateForms}
    </section>
    <section><h2>Participations récentes</h2><p>Les 100 dernières participations de cet environnement. Données personnelles : usage réservé à l’équipe.</p>
      <div class="overflow"><table><thead><tr><th>Campagne</th><th>Courriel</th><th>Type</th><th>Choix</th><th>Mis à jour</th></tr></thead><tbody>${entryRows}</tbody></table></div>
    </section></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' } });
}

export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/') return new Response('Not Found', { status: 404 });
    const target = targetOf(url.searchParams.get('target'));
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
