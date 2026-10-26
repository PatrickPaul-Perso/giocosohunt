import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { authenticate, type AuthEnv } from '../../lib/admin-auth';
import { handleAdmin } from '../../../admin/worker';

export const ALL: APIRoute = async ({ request }) => {
  const auth = await authenticate(request, env as typeof env & AuthEnv);
  if (auth) return auth;
  // The deployed UI always uses the existing D1 binding, never the remote API.
  const url = new URL(request.url);
  url.pathname = url.pathname.slice('/admin'.length) || '/';
  url.searchParams.set('target', 'local');
  const forwarded = new Request(url, request);
  const response = await handleAdmin(forwarded, { DB: env.DB, ADMIN_SITE_ORIGIN: url.origin });
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('referrer-policy', 'no-referrer');
  const location = headers.get('location');
  if (location) headers.set('location', location.replace(url.origin + '/', url.origin + '/admin/'));
  if (!headers.get('content-type')?.includes('text/html')) return new Response(response.body, { status: response.status, headers });
  let html = await response.text();
  html = html.replace(/(href|action|src|data-photo)="\//g, '$1="/admin/').replace("fetch('/location/", "fetch('/admin/location/");
  html = html.replace(/<nav aria-label="Environnement">[\s\S]*?<\/nav>/, '<form method="post" action="/admin/logout"><button>Se déconnecter</button></form>');
  html = html.replace('Gestion locale —', 'Administration —').replace('LOCAL — D1 de développement', 'SITE — base de données du site');
  return new Response(html, { status: response.status, headers });
};
