import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sanitizeCluePhoto } from '../../../../../lib/clue-photo';

export const GET: APIRoute = async ({ params }) => {
  const { campaign, slug, index } = params;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !index || !/^(0|[1-9][0-9]{0,5})$/.test(index)) {
    return new Response('Not Found', { status: 404 });
  }
  try {
    const row = await env.DB.prepare(`SELECT p.jpeg FROM scan_events s
      JOIN items i ON i.id = s.item_id
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN scan_responses r ON r.scan_event_id = s.id
      JOIN scan_response_photos p ON p.scan_event_id = s.id
      WHERE c.slug = ? AND i.public_slug = ?
        AND r.disposition = 'rehide' AND r.public_clue_consent_at IS NOT NULL AND r.moderation_status = 'approved'
        AND s.id = (SELECT id FROM scan_events WHERE item_id = i.id ORDER BY occurred_at DESC, id DESC LIMIT 1 OFFSET ?)`)
      .bind(campaign, slug, Number(index)).first<{ jpeg: number[] }>();
    if (!row || !Array.isArray(row.jpeg)) return new Response('Not Found', { status: 404 });
    const photo = sanitizeCluePhoto(new Uint8Array(row.jpeg), false).jpeg;
    return new Response(photo.buffer as ArrayBuffer, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch {
    return new Response('Photo unavailable', { status: 503 });
  }
};
