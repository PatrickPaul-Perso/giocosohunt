export type ClassItem = {
  id: string;
  display_name: string;
  display_name_en: string | null;
  image_key: string | null;
  nickname: string | null;
  public_slug: string | null;
  latest_disposition: 'keep' | 'rehide' | null;
};

export const classItemsQuery = `SELECT i.id, i.display_name, i.display_name_en, i.image_key, i.nickname, i.public_slug,
  (SELECT r.disposition FROM scan_events s JOIN scan_responses r ON r.scan_event_id = s.id
   WHERE s.item_id = i.id ORDER BY s.occurred_at DESC, s.id DESC LIMIT 1) AS latest_disposition
  FROM items i WHERE i.campaign_id = ? AND i.class_id = ? ORDER BY i.created_at, i.public_slug`;

export async function getClassItems(db: D1Database, campaignId: string, classId: string): Promise<ClassItem[]> {
  const result = await db.prepare(classItemsQuery).bind(campaignId, classId).all<ClassItem>();
  return result.results;
}
