import { fruits, mealGroups } from './data'
import { localeCode } from './i18n'
import type { DayPlan, FruitMap, MealGroup, MealSelection, SelectionMap, UserProfile } from './types'

const arabicDay = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' })
const arabicDate = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' })
const arabicLongDate = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const englishDate = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' })
const englishLongDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' })

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function buildWeek(): DayPlan[] {
  const now = new Date()
  now.setHours(12, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() + index)
    return {
      id: isoDate(date),
      date: arabicLongDate.format(date),
      dateEn: englishLongDate.format(date),
      shortDate: arabicDate.format(date),
      shortDateEn: englishDate.format(date),
      dayName: index === 0 ? 'اليوم' : arabicDay.format(date),
      dayNameEn: index === 0 ? 'Today' : englishDay.format(date),
      isToday: index === 0,
    }
  })
}

export function createDefaultSelections(days: DayPlan[], groups: MealGroup[] = mealGroups): SelectionMap {
  return Object.fromEntries(
    days.map((day, dayIndex) => [
      day.id,
      Object.fromEntries(
        groups.map((meal, mealIndex) => [
          meal.id,
          { [(meal.options.find((option) => option.isImported) ?? meal.options[(dayIndex + mealIndex) % meal.options.length]).id]: 1 },
        ]),
      ),
    ]),
  )
}

function shuffled<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[random]] = [copy[random], copy[index]]
  }
  return copy
}

export function createRandomWeek(days: DayPlan[], groups: MealGroup[] = mealGroups) {
  const mealPools = Object.fromEntries(groups.map((meal) => [meal.id, shuffled(meal.options)]))
  const fruitPool = shuffled(fruits)
  const selections: SelectionMap = {}
  const fruitMap: FruitMap = {}

  days.forEach((day, dayIndex) => {
    selections[day.id] = Object.fromEntries(groups.map((meal) => [meal.id, { [mealPools[meal.id][dayIndex % meal.options.length].id]: 1 }]))
    fruitMap[day.id] = [fruitPool[(dayIndex * 2) % fruitPool.length].id, fruitPool[(dayIndex * 2 + 1) % fruitPool.length].id]
  })

  return { selections, fruitMap }
}

export function normalizeSelectionMap(value: unknown): SelectionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([dayId, meals]) => {
      if (!meals || typeof meals !== 'object' || Array.isArray(meals)) return [dayId, {}]

      const normalizedMeals = Object.fromEntries(
        Object.entries(meals).map(([mealId, selection]) => {
          if (typeof selection === 'string') return [mealId, { [selection]: 1 }]
          if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return [mealId, {}]

          const portions = Object.fromEntries(
            Object.entries(selection)
              .map(([optionId, portion]) => [optionId, Number(portion)] as const)
              .filter(([, portion]) => Number.isFinite(portion) && portion > 0),
          )
          return [mealId, portions]
        }),
      )
      return [dayId, normalizedMeals]
    }),
  )
}

export function getMealItems(meal: MealGroup, selection: MealSelection | undefined) {
  return Object.entries(selection ?? {}).flatMap(([optionId, portion]) => {
    const option = meal.options.find((item) => item.id === optionId)
    return option && portion > 0 ? [{ option, portion }] : []
  })
}

export function getMealTotals(meal: MealGroup, selection: MealSelection | undefined) {
  return getMealItems(meal, selection).reduce(
    (totals, { option, portion }) => ({
      calories: totals.calories + option.calories * portion,
      protein: totals.protein + option.protein * portion,
      carbs: totals.carbs + option.carbs * portion,
      fat: totals.fat + option.fat * portion,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function formatPortion(value: number) {
  const rounded = Math.round(value * 4) / 4
  const whole = Math.floor(rounded)
  const fraction = rounded - whole
  const symbol = fraction === 0.25 ? '¼' : fraction === 0.5 ? '½' : fraction === 0.75 ? '¾' : ''
  if (whole === 0 && symbol) return symbol
  return `${whole ? toArabicNumber(whole) : ''}${symbol}` || '0'
}

export function getDayTotals(dayId: string, selections: SelectionMap, fruitMap: FruitMap, groups: MealGroup[] = mealGroups) {
  const selected = selections[dayId] ?? {}
  const meals = groups.map((meal) => getMealTotals(meal, selected[meal.id]))

  const chosenFruits = fruits.filter((fruit) => (fruitMap[dayId] ?? []).includes(fruit.id))

  return {
    calories: meals.reduce((sum, item) => sum + item.calories, 0) + chosenFruits.reduce((sum, item) => sum + item.calories, 0),
    protein: meals.reduce((sum, item) => sum + item.protein, 0),
    carbs: meals.reduce((sum, item) => sum + item.carbs, 0) + chosenFruits.reduce((sum, item) => sum + Math.round(item.calories / 4), 0),
    fat: meals.reduce((sum, item) => sum + item.fat, 0),
  }
}

export const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
} as const

export function calculateHealthMetrics(profile: UserProfile) {
  const heightM = profile.height / 100
  const bmi = profile.weight / Math.pow(heightM, 2)
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'male' ? 5 : -161)
  const tdee = bmr * activityFactors[profile.activityLevel]
  const weeklyChange = profile.goalWeeks > 0 ? Math.abs(profile.weight - profile.targetWeight) / profile.goalWeeks : 0
  const dailyDelta = profile.goalWeeks > 0 ? Math.min(750, Math.max(0, (Math.abs(profile.weight - profile.targetWeight) * 7700) / (profile.goalWeeks * 7))) : 0
  const targetCalories = Math.max(1200, Math.round(profile.goal === 'lose' ? tdee - dailyDelta : profile.goal === 'gain' ? tdee + Math.max(250, dailyDelta) : tdee))
  const protein = Math.round(profile.weight * (profile.goal === 'maintain' ? 1.6 : 1.8))
  const fat = Math.round(profile.weight * 0.8)
  const carbs = Math.max(40, Math.round((targetCalories - protein * 4 - fat * 9) / 4))

  return {
    bmi,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    healthyMin: 18.5 * heightM * heightM,
    healthyMax: 24.9 * heightM * heightM,
    weeklyChange,
    targetCalories,
    protein,
    carbs,
    fat,
  }
}

export function toArabicNumber(value: number | string) {
  return new Intl.NumberFormat(localeCode(), { maximumFractionDigits: 1 }).format(Number(value))
}
