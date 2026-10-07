import type { Language } from './locale.ts';
export type ItemState = 'initial' | 'circulating' | 'kept' | 'missing';
export type ItemSummary = {
  latest_scan_id: string | null;
  latest_disposition: 'keep' | 'rehide' | null;
  state_at: string | null;
  participation_count: number;
  current_state: ItemState;
};
// Response creation (rather than tag opening) defines the last declaration.
// rowid breaks ties between responses received within the same second.
export const latestResponse = `(SELECT r.scan_event_id FROM scan_responses r
  JOIN scan_events s ON s.id = r.scan_event_id WHERE s.item_id = i.id
  ORDER BY r.created_at DESC, r.rowid DESC LIMIT 1)`;
export const itemSummaryColumns = `latest.scan_event_id AS latest_scan_id,
  latest.disposition AS latest_disposition,
  CASE WHEN i.missing_at IS NOT NULL THEN i.missing_at ELSE latest.created_at END AS state_at,
  CASE WHEN i.missing_at IS NOT NULL THEN 'missing'
    WHEN latest.disposition = 'keep' THEN 'kept'
    WHEN latest.disposition = 'rehide' THEN 'circulating' ELSE 'initial' END AS current_state,
  (SELECT COUNT(*) FROM scan_responses r JOIN scan_events s ON s.id = r.scan_event_id
    WHERE s.item_id = i.id) AS participation_count`;
export const itemSummaryJoin = `LEFT JOIN scan_responses latest ON latest.scan_event_id = ${latestResponse}`;
export function itemStateLabel(state: ItemState, language: Language): string {
  return (language === 'fr'
    ? { initial: 'Pas encore en circulation', circulating: 'En circulation', kept: 'Gardée', missing: 'Manquante / perdue' }
    : { initial: 'Not yet in circulation', circulating: 'In circulation', kept: 'Kept', missing: 'Missing / lost' })[state];
}
export function stateDate(value: string | null, language: Language): string {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', { timeZone: 'America/Toronto' });
}
