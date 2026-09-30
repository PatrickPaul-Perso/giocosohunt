import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  let database: 'ready' | 'unavailable' = 'unavailable';

  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1').first();
      database = 'ready';
    }
  } catch {
    // Le projet doit rester consultable avant la configuration locale de D1.
  }

  return new Response(JSON.stringify({ status: 'ok', database }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
