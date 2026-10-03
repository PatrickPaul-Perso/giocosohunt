export type Campaign = { id: string; slug: string; title: string; starts_at: string | null; ends_at: string | null };

export const halloweenCampaign: Campaign = {
  id: '00000000-0000-4000-8000-000000000000', slug: 'halloween-2026', title: 'Halloween 2026', starts_at: null, ends_at: null,
};

export async function getCampaigns(db: D1Database): Promise<Campaign[]> {
  try {
    const result = await db.prepare('SELECT id, slug, title, starts_at, ends_at FROM campaigns ORDER BY created_at DESC, slug').all<Campaign>();
    return result.results;
  } catch {
    return [halloweenCampaign];
  }
}
