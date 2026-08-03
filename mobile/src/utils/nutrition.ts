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

export function getNutritionTotals(selections: DaySelections | undefined, groups: MealGroup[]): NutritionTotals {
  const initial: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  if (!selections) return initial
  return groups.reduce((totals, group) => {
    Object.entries(selections[group.id] ?? {}).forEach(([optionId, portion]) => {
      const option = group.options.find((item) => item.id === optionId)
      if (!option) return
      totals.calories += option.calories * portion
      totals.protein += option.protein * portion
      totals.carbs += option.carbs * portion
      totals.fat += option.fat * portion
    })
    return totals
  }, initial)
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

export function calculateHealthMetrics(profile: UserProfile) {
  const heightM = profile.height / 100
  const bmi = profile.weight / Math.pow(heightM, 2)
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'male' ? 5 : -161)
  const tdee = bmr * activityFactors[profile.activityLevel]
  const dailyDelta = profile.goalWeeks > 0 ? Math.min(750, Math.max(0, Math.abs(profile.weight - profile.targetWeight) * 7700 / (profile.goalWeeks * 7))) : 0
  const calories = Math.max(1200, Math.round(profile.goal === 'lose' ? tdee - dailyDelta : profile.goal === 'gain' ? tdee + Math.max(250, dailyDelta) : tdee))
  const protein = Math.round(profile.weight * (profile.goal === 'maintain' ? 1.6 : 1.8))
  const fat = Math.round(profile.weight * 0.8)
  const carbs = Math.max(40, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { bmi, bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fat }
}

export function completedHabitCount(data: AppData, dayId: string) {
  return Object.values(data.habits[dayId] ?? {}).filter(Boolean).length
}
