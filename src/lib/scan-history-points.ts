/** Coordinates supplied here have already passed the public consent/moderation
 * filter and were offset and rounded when saved. Do not recover private GPS. */
type LocationEvent = {
  id: string;
  occurred_at: string;
  disposition: 'keep' | 'rehide' | null;
  map_lat_milli: number | null;
  map_lon_milli: number | null;
  rehide_lat_milli: number | null;
  rehide_lon_milli: number | null;
};

export type HistoryPoint = {
  eventId: string;
  lat: number;
  lon: number;
  current: boolean;
};

export function getHistoryPoints(entries: readonly LocationEvent[]): HistoryPoint[] {
  const confirmed = entries.filter(({ disposition }) => disposition === 'keep' || disposition === 'rehide')
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id));
  const points: HistoryPoint[] = [];
  for (const entry of confirmed) {
    // A rehide location follows the scan location within the same event.
    const locations = [
      [entry.rehide_lat_milli, entry.rehide_lon_milli],
      [entry.map_lat_milli, entry.map_lon_milli],
    ];
    for (const [lat, lon] of locations) {
      if (lat === null || lon === null || !Number.isInteger(lat) || !Number.isInteger(lon) ||
        Math.abs(lat) > 90_000 || Math.abs(lon) > 180_000) continue;
      points.push({ eventId: entry.id, lat: lat / 1000, lon: lon / 1000, current: points.length === 0 });
    }
  }
  return points;
}
