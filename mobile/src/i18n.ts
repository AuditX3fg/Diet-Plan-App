import type { FruitOption, Language } from './types'

export function tr(language: Language, english: string, arabic: string, french?: string) {
  if (language === 'ar') return arabic
  if (language === 'fr') return french ?? english
  return english
}

export function isRtl(language: Language) {
  return language === 'ar'
}

export function fruitName(language: Language, fruit: FruitOption) {
  return language === 'ar' ? fruit.name : language === 'fr' ? fruit.nameFr : fruit.nameEn
}

export function fruitAmount(language: Language, fruit: FruitOption) {
  return language === 'ar' ? fruit.amount : language === 'fr' ? fruit.amountFr : fruit.amountEn
}
