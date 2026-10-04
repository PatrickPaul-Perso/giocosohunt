import type { Language } from './locale.ts';

type NamedItem = { display_name: string; display_name_en: string | null; nickname: string | null };

export function itemPresentation(item: NamedItem, language: Language) {
  const name = language === 'en' ? item.display_name_en || item.display_name : item.display_name;
  const title = item.nickname || name;
  return {
    name, title,
    subtitle: item.nickname && item.nickname !== name ? name : null,
    greeting: language === 'fr' ? `Bravo tu as trouvé ${title}!` : `Well done! You found ${title}!`,
  };
}

export function validItemImageKey(value: string): boolean {
  return value === '' || (value.length <= 120 && /^[a-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(value));
}
