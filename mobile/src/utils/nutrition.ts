import { fruits } from '../data'
import type { ActivityLevel, AppData, DaySelections, MealGroup, NutritionTotals, UserProfile } from '../types'

export function buildWeekIds() {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

export function shortDayLabel(dayId: string, language = 'en') {
  const date = new Date(`${dayId}T12:00:00`)
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric' }).format(date)
}

export function longDateLabel(dayId: string, language = 'en') {
  const date = new Date(`${dayId}T12:00:00`)
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

export function getNutritionTotals(selections: DaySelections | undefined, groups: MealGroup[], fruitIds: string[] = []): NutritionTotals {
  const initial: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const totals = groups.reduce((result, group) => {
    Object.entries(selections?.[group.id] ?? {}).forEach(([optionId, portion]) => {
      const option = group.options.find((item) => item.id === optionId)
      if (!option) return
      result.calories += option.calories * portion
      result.protein += option.protein * portion
      result.carbs += option.carbs * portion
      result.fat += option.fat * portion
    })
    return result
  }, initial)
  fruits.filter((fruit) => fruitIds.includes(fruit.id)).forEach((fruit) => {
    totals.calories += fruit.calories
    totals.carbs += Math.round(fruit.calories / 4)
  })
  return totals
}

export function selectionSummary(group: MealGroup, selections: DaySelections | undefined, language: string) {
  return Object.entries(selections?.[group.id] ?? {}).flatMap(([optionId, portion]) => {
    const option = group.options.find((item) => item.id === optionId)
    return option ? [{ option, portion, name: language === 'ar' ? option.name : option.nameEn }] : []
  })
}

export function formatPortion(value: number) {
  const rounded = Math.round(value * 4) / 4
  const whole = Math.floor(rounded)
  const fraction = rounded - whole
  const suffix = fraction === 0.25 ? '¼' : fraction === 0.5 ? '½' : fraction === 0.75 ? '¾' : ''
  return `${whole || ''}${suffix}` || '0'
}

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
}

export type HealthProfileIssue = 'age' | 'height' | 'weight' | 'targetWeight' | 'goalWeeks' | 'goalDirection' | 'targetCalories' | 'targetProtein' | 'targetCarbs' | 'targetFat'

function finiteWithin(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function safeValue(value: number, minimum: number, maximum: number, fallback: number) {
  return finiteWithin(value, minimum, maximum) ? value : fallback
}

export function calculateHealthMetrics(profile: UserProfile) {
  const issues: HealthProfileIssue[] = []
  if (!finiteWithin(profile.age, 20, 100)) issues.push('age')
  if (!finiteWithin(profile.height, 120, 230)) issues.push('height')
  if (!finiteWithin(profile.weight, 30, 300)) issues.push('weight')
  if (!finiteWithin(profile.targetWeight, 30, 300)) issues.push('targetWeight')
  if (!finiteWithin(profile.goalWeeks, 1, 104)) issues.push('goalWeeks')
  if (!finiteWithin(profile.targetCalories, 1000, 5000)) issues.push('targetCalories')
  if (!finiteWithin(profile.targetProtein, 20, 400)) issues.push('targetProtein')
  if (!finiteWithin(profile.targetCarbs, 20, 600)) issues.push('targetCarbs')
  if (!finiteWithin(profile.targetFat, 20, 200)) issues.push('targetFat')

  const height = safeValue(profile.height, 120, 230, 170)
  const weight = safeValue(profile.weight, 30, 300, 70)
  const targetWeight = safeValue(profile.targetWeight, 30, 300, weight)
  const age = safeValue(profile.age, 20, 100, 30)
  const goalWeeks = safeValue(profile.goalWeeks, 1, 104, 12)
  const goalDirectionValid = profile.goal === 'maintain'
    || (profile.goal === 'lose' && targetWeight < weight)
    || (profile.goal === 'gain' && targetWeight > weight)
  if (!goalDirectionValid) issues.push('goalDirection')

  const heightM = height / 100
  const bmi = weight / Math.pow(heightM, 2)
  const bmr = 10 * weight + 6.25 * height - 5 * age + (profile.gender === 'male' ? 5 : -161)
  const tdee = bmr * activityFactors[profile.activityLevel]
  const changeKg = goalDirectionValid && profile.goal !== 'maintain' ? Math.abs(weight - targetWeight) : 0
  const weeklyChange = changeKg / goalWeeks
  const dailyDelta = Math.min(750, Math.max(0, changeKg * 7700 / (goalWeeks * 7)))
  const adjustedCalories = !goalDirectionValid || profile.goal === 'maintain' ? tdee : profile.goal === 'lose' ? tdee - dailyDelta : tdee + Math.max(250, dailyDelta)
  const calories = Math.min(5000, Math.max(1200, Math.round(adjustedCalories)))
  const desiredProtein = Math.min(400, Math.round(weight * (profile.goal === 'maintain' ? 1.6 : 1.8)))
  const desiredFat = Math.min(200, Math.round(weight * 0.8))
  const minimumCarbCalories = 40 * 4
  const desiredProteinAndFatCalories = desiredProtein * 4 + desiredFat * 9
  const macroScale = Math.min(1, Math.max(0, calories - minimumCarbCalories) / desiredProteinAndFatCalories)
  const protein = Math.floor(desiredProtein * macroScale)
  const fat = Math.floor(desiredFat * macroScale)
  const carbs = Math.min(600, Math.max(40, Math.floor((calories - protein * 4 - fat * 9) / 4)))
  const calculationIssues = issues.filter((issue) => !['targetCalories', 'targetProtein', 'targetCarbs', 'targetFat'].includes(issue))
  return { bmi, bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fat, weeklyChange, macroCalories: protein * 4 + carbs * 4 + fat * 9, issues, isValid: calculationIssues.length === 0, profileIsValid: issues.length === 0, goalDirectionValid }
}

export function completedHabitCount(data: AppData, dayId: string) {
  return Object.values(data.habits[dayId] ?? {}).filter(Boolean).length
}
