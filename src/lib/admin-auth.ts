export type AuthEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_EMAILS?: string;
  ADMIN_ORIGIN?: string;
};
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function sign(value: object, secret: string): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify(value)));
  return payload + '.' + encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))));
}
export async function verify(value: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = value.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return typeof data.exp === 'number' && data.exp > Date.now() / 1000 ? data : null;
  } catch { return null; }
}
function cookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
}
function setCookie(name: string, value: string, seconds: number, secure: boolean) {
  return `${name}=${value}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
}
const allowed = (env: AuthEnv, email: unknown) => typeof email === 'string' && (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
// A null result means the request is authenticated. Every private endpoint uses this gate.
export async function authenticate(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' });
  const reply = (body: string, status = 200) => new Response(body, { status, headers });
  const redirect = (path: string) => { headers.set('location', path); return reply('', 303); };
  const secret = env.ADMIN_SESSION_SECRET;
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ADMIN_EMAILS', 'ADMIN_ORIGIN'] as const;
  const missing: string[] = required.filter(name => !env[name]?.trim());
  if (!secret) missing.push('ADMIN_SESSION_SECRET');
  if (missing.length || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return reply(`Administration indisponible : variables absentes ou vides dans le Worker : ${missing.join(', ')}.`, 503);
  if (!secret || secret.length < 32) return reply('Administration indisponible : ADMIN_SESSION_SECRET doit contenir au moins 32 caractères.', 503);
  if (url.origin !== env.ADMIN_ORIGIN || (!secure && !['localhost', '127.0.0.1'].includes(url.hostname))) return reply('Forbidden', 403);
  const callback = `${url.origin}/admin/callback`;
  if (url.pathname === '/admin/login') {
    if (request.method !== 'GET') return reply('Method Not Allowed', 405);
    const state = random(), verifier = random();
    const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
    headers.append('set-cookie', setCookie('admin_oauth', await sign({ state, verifier, exp: Math.floor(Date.now() / 1000) + 600 }, secret), 600, secure));
    const login = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    login.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: 'openid email', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' }).toString();
    return redirect(login.href);
  }
  if (url.pathname === '/admin/callback') {
    if (request.method !== 'GET') return reply('Method Not Allowed', 405);
    headers.append('set-cookie', setCookie('admin_oauth', '', 0, secure));
    const flow = await verify(cookie(request, 'admin_oauth'), secret);
    if (!flow || flow.state !== url.searchParams.get('state') || typeof flow.verifier !== 'string' || !url.searchParams.get('code') || url.searchParams.has('error')) return reply('Connexion refusée ou expirée. Recommencez depuis /admin.', 400);
    try {
      const tokens = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code: url.searchParams.get('code')!, code_verifier: flow.verifier, grant_type: 'authorization_code', redirect_uri: callback }), signal: AbortSignal.timeout(10000) });
      const token = await tokens.json() as { access_token?: string };
      if (!tokens.ok || !token.access_token) return reply('Connexion Google refusée.', 403);
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000) });
      const user = await response.json() as { sub?: string; email?: string; email_verified?: boolean; hd?: string };
      // Google must be authoritative for the email used as the administrator identity.
      if (!response.ok || !user.sub || user.email_verified !== true || !allowed(env, user.email) || (!user.email?.endsWith('@gmail.com') && !user.hd)) return reply('Ce compte Google n’est pas autorisé.', 403);
      headers.append('set-cookie', setCookie('admin_session', await sign({ sub: user.sub, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 }, secret), 3600, secure));
      return redirect('/admin/');
    } catch { return reply('Google est temporairement indisponible. Réessayez depuis /admin.', 502); }
  }
  if (url.pathname === '/admin/logout') {
    if (request.method !== 'POST') return reply('Method Not Allowed', 405);
    if (request.headers.get('origin') !== url.origin) return reply('Forbidden', 403);
    headers.append('set-cookie', setCookie('admin_session', '', 0, secure));
    return redirect('/admin/');
  }
  const session = await verify(cookie(request, 'admin_session'), secret);
  if (session && typeof session.sub === 'string' && allowed(env, session.email)) return null;
  if (!['/admin', '/admin/'].includes(url.pathname) || request.method !== 'GET') return reply('Authentification requise.', 401);
  headers.set('content-type', 'text/html; charset=utf-8');
  return reply('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Administration — Giocoso Hunt</title><h1>Administration Giocoso Hunt</h1><p>Accès réservé aux comptes autorisés.</p><a href="/admin/login">Se connecter avec Google</a></html>');
}
