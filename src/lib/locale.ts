export type Language = 'fr' | 'en';

export function getLanguage(request: Request, cookie: string | undefined): Language {
  if (cookie === 'fr' || cookie === 'en') return cookie;
  const accepted = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().toLowerCase().split(';');
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='))?.trim().slice(2);
      const weight = quality === undefined ? 1 : Number(quality);
      return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter(({ tag, weight }) => /^(fr|en)(-|$)/.test(tag) && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return accepted[0]?.tag.startsWith('en') ? 'en' : 'fr';
}

export const common = {
  fr: {
    language: 'Langue', campaign: 'Campagne', vote: 'Voter',
    ai: 'L’IA générative a servi d’assistante à l’ingénierie et à la rédaction de ce site Web. Patrick Paul a révisé et approuvé l’ensemble du contenu publié et des décisions techniques.',
  },
  en: {
    language: 'Language', campaign: 'Campaign', vote: 'Vote',
    ai: 'Generative AI was used as an engineering and writing assistant in the production of this website. All published content and technical decisions were reviewed and approved by Patrick Paul.',
  },
} as const;
