import type { FruitOption, Language, MealGroup, MealOption } from './types'

let activeLanguage: Language = 'ar'

export function setActiveLanguage(language: Language) {
  activeLanguage = language
}

export function getActiveLanguage() {
  return activeLanguage
}

export function tr(arabic: string, english: string, french?: string) {
  if (activeLanguage === 'ar') return arabic
  if (activeLanguage === 'fr') return french ?? english
  return english
}

export function mealName(option: MealOption) {
  return activeLanguage === 'ar' ? option.name : option.nameEn
}

export function mealDescription(option: MealOption) {
  return activeLanguage === 'ar' ? option.description : option.descriptionEn
}

export function mealTitle(meal: MealGroup) {
  return activeLanguage === 'ar' ? meal.title : meal.titleEn
}

export function mealSubtitle(meal: MealGroup) {
  return activeLanguage === 'ar' ? meal.subtitle : meal.subtitleEn
}

export function fruitName(fruit: FruitOption) {
  return activeLanguage === 'ar' ? fruit.name : activeLanguage === 'fr' ? fruit.nameFr : fruit.nameEn
}

export function fruitAmount(fruit: FruitOption) {
  return activeLanguage === 'ar' ? fruit.amount : activeLanguage === 'fr' ? fruit.amountFr : fruit.amountEn
}

export function localeCode() {
  return activeLanguage === 'ar' ? 'ar-EG' : activeLanguage === 'fr' ? 'fr-FR' : 'en-US'
}
