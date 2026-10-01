export type SiteSettings = {
  activeCampaignId: string;
  contestOpen: boolean;
  contestTermsUrl: string;
  background: string;
  text: string;
  accent: string;
  headlineFr: string;
  headlineEn: string;
};

const defaults: SiteSettings = {
  activeCampaignId: '00000000-0000-4000-8000-000000000000',
  contestOpen: false,
  contestTermsUrl: '',
  background: '#f8f5ef',
  text: '#24231f',
  accent: '#603b21',
  headlineFr: 'La chasse d’Halloween 2026 se prépare.',
  headlineEn: 'The Halloween 2026 hunt is coming.',
};

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  try {
    const result = await db.prepare('SELECT key, value FROM app_settings').all<{ key: string; value: string }>();
    const values = Object.fromEntries(result.results.map(({ key, value }) => [key, value]));
    const activeId = values.active_campaign_id || defaults.activeCampaignId;
    const pick = (key: string) => values[`campaign:${activeId}:${key}`] ?? values[key];
    const color = (key: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(pick(key) ?? '') ? pick(key) : fallback;
    return {
      activeCampaignId: activeId,
      contestOpen: pick('contest_open') === 'true',
      contestTermsUrl: pick('contest_terms_url') || '',
      background: color('theme_background', defaults.background),
      text: color('theme_text', defaults.text),
      accent: color('theme_accent', defaults.accent),
      headlineFr: pick('headline_fr') || defaults.headlineFr,
      headlineEn: pick('headline_en') || defaults.headlineEn,
    };
  } catch {
    return defaults;
  }
}

export async function getActiveCampaign(db: D1Database, settings: SiteSettings) {
  return db.prepare('SELECT id, slug, title FROM campaigns WHERE id = ?')
    .bind(settings.activeCampaignId)
    .first<{ id: string; slug: string; title: string }>();
}
