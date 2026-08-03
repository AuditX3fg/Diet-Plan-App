export type View = 'today' | 'plan' | 'week' | 'habits' | 'scanner' | 'workouts' | 'progress' | 'profile' | 'settings'
export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'ar' | 'en' | 'fr'
export type Gender = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
export type HealthGoal = 'lose' | 'maintain' | 'gain'
export type SportPreference = 'gym' | 'home' | 'run' | 'bike' | 'swim' | 'walk' | 'yoga' | 'football'

export interface MealOption {
  id: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  calories: number
  protein: number
  carbs: number
  fat: number
  color: string
  glyph: string
  imageUrl?: string
  isImported?: boolean
  recipeUrl?: string
  videoUrl?: string
}

export interface MealGroup {
  id: string
  title: string
  titleEn: string
  subtitle: string
  subtitleEn: string
  time: string
  timeEn: string
  options: MealOption[]
}

export interface FruitOption {
  id: string
  name: string
  nameEn: string
  nameFr: string
  amount: string
  amountEn: string
  amountFr: string
  calories: number
  glyph: string
}

export interface DayPlan {
  id: string
  date: string
  dateEn: string
  shortDate: string
  shortDateEn: string
  dayName: string
  dayNameEn: string
  isToday: boolean
}

export interface UserProfile {
  name: string
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  height: number
  weight: number
  targetWeight: number
  age: number
  gender: Gender
  activityLevel: ActivityLevel
  goal: HealthGoal
  goalWeeks: number
}

export interface WeightEntry {
  date: string
  value: number
}

export type MealSelection = Record<string, number>
export type SelectionMap = Record<string, Record<string, MealSelection>>
export type FruitMap = Record<string, string[]>

export interface PlanPreset {
  id: string
  name: string
  createdAt: string
  selections: SelectionMap
  fruits: FruitMap
}

export type HabitId = 'meal-1' | 'meal-2' | 'meal-3' | 'meal-4' | 'fruit' | 'workout'
export type HabitMap = Record<string, Partial<Record<HabitId, boolean>>>

export interface ReminderSettings {
  enabled: boolean
  waterEnabled: boolean
  mealEnabled: boolean
  waterIntervalMinutes: number
  mealTimes: string[]
}

export interface FoodProduct {
  id: string
  barcode?: string
  name: string
  nameEn?: string
  brand?: string
  brandEn?: string
  imageUrl?: string
  source?: 'open-food-facts' | 'usda-fooddata-central' | 'plan' | 'offline'
  calories: number
  protein: number
  carbs: number
  fat: number
  serving: string
  servingEn?: string
  grade?: string
}

export type DietMealId = 'breakfast' | 'snack' | 'lunch' | 'dinner'

export interface ImportedDietMeal {
  id: DietMealId
  title: string
  items: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
  videoUrl?: string
}

export interface ImportedDietPlan {
  fileName: string
  uploadedAt: string
  pageCount: number
  extractedCharacters: number
  dailyCalories: number
  protein: number
  carbs: number
  fat: number
  meals: ImportedDietMeal[]
  notes: string[]
}

export interface UserAccount {
  id: string
  username: string
  email?: string
  displayName: string
  workoutMode?: 'unselected' | 'default' | 'custom'
  createdAt: string
  dietPlan?: ImportedDietPlan
  planSkippedAt?: string
}

export interface AccountUpdateInput {
  displayName: string
  username: string
  email: string
  currentPassword?: string
  newPassword?: string
}
