import { itemSummaryColumns, itemSummaryJoin, type ItemSummary } from './item-state.ts';
export type ClassItem = ItemSummary & {
  id: string;
  display_name: string;
  display_name_en: string | null;
  image_key: string | null;
  nickname: string | null;
  public_slug: string | null;
};

export const classItemsQuery = `SELECT i.id, i.display_name, i.display_name_en, i.image_key, i.nickname, i.public_slug,
  ${itemSummaryColumns}
  FROM items i ${itemSummaryJoin} WHERE i.campaign_id = ? AND i.class_id = ? ORDER BY i.created_at, i.public_slug`;

export async function getClassItems(db: D1Database, campaignId: string, classId: string): Promise<ClassItem[]> {
  const result = await db.prepare(classItemsQuery).bind(campaignId, classId).all<ClassItem>();
  return result.results;
}
