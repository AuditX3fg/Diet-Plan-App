import AsyncStorage from '@react-native-async-storage/async-storage'
import { mealGroups } from '../data'
import type { AppData, DaySelections, DietMealId, ImportedDietPlan, MealGroup, SelectionMap, UserAccount, UserProfile } from '../types'
import { buildWeekIds } from '../utils/nutrition'

const DATA_PREFIX = 'tawazon.mobile.data.v1.'

export const defaultProfile: UserProfile = {
  name: 'User',
  targetCalories: 1900,
  targetProtein: 150,
  targetCarbs: 190,
  targetFat: 65,
  height: 178,
  weight: 82.4,
  targetWeight: 76,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
  goal: 'lose',
  goalWeeks: 16,
}

function defaultDaySelections(groups: MealGroup[], dayIndex: number): DaySelections {
  return Object.fromEntries(groups.map((group, groupIndex) => {
    const imported = group.options.find((option) => option.isImported)
    const option = imported ?? group.options[(dayIndex + groupIndex) % group.options.length]
    return [group.id, { [option.id]: 1 }]
  })) as DaySelections
}

export function createDefaultSelections(groups: MealGroup[]): SelectionMap {
  return Object.fromEntries(buildWeekIds().map((dayId, index) => [dayId, defaultDaySelections(groups, index)]))
}

function importedImageKey(mealId: DietMealId, text: string) {
  const value = text.toLowerCase()
  if (/egg|بيض/.test(value)) return 'eggs'
  if (/yogurt|زبادي|لبن/.test(value)) return 'protein-yogurt'
  if (/tuna|تونا/.test(value)) return mealId === 'dinner' ? 'tuna-pasta' : 'tuna-salad'
  if (/fish|salmon|سمك|سلمون/.test(value)) return 'grilled-fish'
  if (/shrimp|قريدس|روبيان/.test(value)) return 'shrimp-rice'
  if (/chicken|دجاج/.test(value)) return mealId === 'breakfast' ? 'turkey-toast' : 'chicken-rice'
  if (/beef|meat|لحمة|لحم/.test(value)) return 'meat-rice'
  if (/pasta|معكرونة/.test(value)) return 'healthy-pasta'
  if (/potato|بطاطا/.test(value)) return 'baked-potato'
  return mealId === 'breakfast' ? 'cottage-pancake' : mealId === 'snack' ? 'protein-yogurt' : mealId === 'lunch' ? 'chicken-rice' : 'grilled-fish'
}

export function buildMealGroups(plan?: ImportedDietPlan): MealGroup[] {
  if (!plan) return mealGroups
  return mealGroups.map((group) => {
    const imported = plan.meals.find((meal) => meal.id === group.id)
    if (!imported || imported.items.length === 0) return group
    const details = imported.items.join(' · ')
    return {
      ...group,
      options: [{
        id: `imported-${group.id}`,
        name: imported.title,
        nameEn: imported.title,
        description: details,
        descriptionEn: details,
        calories: imported.calories,
        protein: imported.protein,
        carbs: imported.carbs,
        fat: imported.fat,
        color: group.options[0].color,
        glyph: group.options[0].glyph,
        imageKey: importedImageKey(group.id, details),
        isImported: true,
      }, ...group.options],
    }
  })
}

function initialData(account: UserAccount): AppData {
  return {
    profile: { ...defaultProfile, name: account.displayName },
    selections: createDefaultSelections(mealGroups),
    waterByDay: { [buildWeekIds()[0]]: 5 },
    habits: {},
    weights: [
      { date: daysAgo(28), value: 84.6 },
      { date: daysAgo(21), value: 84.0 },
      { date: daysAgo(14), value: 83.3 },
      { date: daysAgo(7), value: 82.9 },
      { date: daysAgo(0), value: 82.4 },
    ],
    sport: 'gym',
    language: 'en',
    theme: 'system',
    scanHistory: [],
  }
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export async function loadAppData(account: UserAccount) {
  try {
    const stored = await AsyncStorage.getItem(`${DATA_PREFIX}${account.id}`)
    if (!stored) return initialData(account)
    const parsed = JSON.parse(stored) as Partial<AppData>
    const defaults = initialData(account)
    const currentWeekSelections = createDefaultSelections(buildMealGroups(parsed.dietPlan))
    return {
      ...defaults,
      ...parsed,
      profile: { ...defaults.profile, ...parsed.profile },
      selections: { ...currentWeekSelections, ...(parsed.selections ?? {}) },
      waterByDay: parsed.waterByDay ?? defaults.waterByDay,
      habits: parsed.habits ?? {},
      weights: parsed.weights ?? defaults.weights,
      scanHistory: parsed.scanHistory ?? [],
    } as AppData
  } catch {
    return initialData(account)
  }
}

export async function saveAppData(accountId: string, data: AppData) {
  await AsyncStorage.setItem(`${DATA_PREFIX}${accountId}`, JSON.stringify(data))
}

export function applyDietPlan(data: AppData, plan: ImportedDietPlan): AppData {
  const groups = buildMealGroups(plan)
  return {
    ...data,
    dietPlan: plan,
    planSkippedAt: undefined,
    profile: {
      ...data.profile,
      targetCalories: plan.dailyCalories,
      targetProtein: plan.protein,
      targetCarbs: plan.carbs,
      targetFat: plan.fat,
    },
    selections: createDefaultSelections(groups),
  }
}

export function skipDietPlan(data: AppData): AppData {
  return { ...data, planSkippedAt: new Date().toISOString() }
}
