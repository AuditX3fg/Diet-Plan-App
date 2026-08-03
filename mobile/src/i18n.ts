import type { Language } from './types'

export function tr(language: Language, english: string, arabic: string, french?: string) {
  if (language === 'ar') return arabic
  if (language === 'fr') return french ?? english
  return english
}

export function isRtl(language: Language) {
  return language === 'ar'
}
