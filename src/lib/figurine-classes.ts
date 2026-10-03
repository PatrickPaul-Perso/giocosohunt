export type FigurineClass = {
  id: string; slug: string; name_fr: string; name_en: string; image_key: string | null; instance_count: number;
};

export async function getFigurineClasses(db: D1Database, campaignId: string): Promise<FigurineClass[]> {
  const result = await db.prepare(`SELECT f.id, f.slug, f.name_fr, f.name_en, f.image_key, COUNT(i.id) AS instance_count
    FROM figurine_classes f LEFT JOIN items i ON i.class_id = f.id AND i.campaign_id = f.campaign_id
    WHERE f.campaign_id = ? GROUP BY f.id ORDER BY f.slug`).bind(campaignId).all<FigurineClass>();
  return result.results;
}
