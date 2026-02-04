export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'uk',
  'ko',
  'fa',
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const isValidLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};
