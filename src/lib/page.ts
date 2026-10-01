import { getLanguage, type Language } from './locale';

export function pageLanguage(astro: { request: Request; cookies: { get(name: string): { value: string } | undefined; set(name: string, value: string, options: object): void }; url: URL }): Language {
  const selected = astro.url.searchParams.get('lang');
  if (selected === 'fr' || selected === 'en') {
    astro.cookies.set('giocoso_lang', selected, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
    return selected;
  }
  return getLanguage(astro.request, astro.cookies.get('giocoso_lang')?.value);
}
