import type { HistoryEntry } from '../components/ScanHistory.astro';

export async function getScanHistory(db: D1Database, itemId: string): Promise<HistoryEntry[]> {
  const result = await db.prepare(`SELECT s.id, s.occurred_at, r.disposition, r.moderation_status,
    CASE WHEN r.moderation_status = 'approved' AND r.public_clue_consent_at IS NOT NULL AND r.disposition = 'rehide' THEN r.clue_text ELSE NULL END AS clue_text,
    CASE WHEN r.moderation_status = 'approved' AND r.public_clue_consent_at IS NOT NULL AND r.disposition = 'rehide' AND p.scan_event_id IS NOT NULL THEN 1 ELSE 0 END AS has_photo,
    CASE WHEN r.moderation_status = 'approved' AND r.map_location_consent_at IS NOT NULL THEN r.map_lat_milli ELSE NULL END AS map_lat_milli,
    CASE WHEN r.moderation_status = 'approved' AND r.map_location_consent_at IS NOT NULL THEN r.map_lon_milli ELSE NULL END AS map_lon_milli,
    CASE WHEN r.moderation_status = 'approved' AND r.rehide_location_consent_at IS NOT NULL THEN r.rehide_lat_milli ELSE NULL END AS rehide_lat_milli,
    CASE WHEN r.moderation_status = 'approved' AND r.rehide_location_consent_at IS NOT NULL THEN r.rehide_lon_milli ELSE NULL END AS rehide_lon_milli
    FROM scan_events s
    LEFT JOIN scan_responses r ON r.scan_event_id = s.id
    LEFT JOIN scan_response_photos p ON p.scan_event_id = s.id
    WHERE s.item_id = ? ORDER BY s.occurred_at DESC, s.id DESC`)
    .bind(itemId).all<HistoryEntry>();
  return result.results;
}
