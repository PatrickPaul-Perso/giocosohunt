import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sanitizeCluePhoto } from '../../../../../lib/clue-photo';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async ({ params }) => {
  const { uuid, scanId } = params;
  if (!uuid || !scanId || !uuidPattern.test(uuid) || !uuidPattern.test(scanId)) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const row = await env.DB.prepare(`SELECT p.jpeg
      FROM scan_response_photos p
      JOIN scan_responses r ON r.scan_event_id = p.scan_event_id
      JOIN scan_events s ON s.id = r.scan_event_id
      WHERE s.id = ? AND s.item_id = ? AND r.disposition = 'rehide'
        AND r.public_clue_consent_at IS NOT NULL AND r.moderation_status = 'approved'`)
      .bind(scanId, uuid)
      .first<{ jpeg: number[] }>();
    if (!row || !Array.isArray(row.jpeg)) return new Response('Not Found', { status: 404 });

    // D1 conserve parfois le GPS EXIF avec un consentement privé. Le public reçoit
    // une copie sans métadonnées, jamais les octets originaux de la base.
    const photo = sanitizeCluePhoto(new Uint8Array(row.jpeg), false).jpeg;
    return new Response(photo.buffer as ArrayBuffer, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new Response('Photo unavailable', { status: 503 });
  }
};
