export type Language = 'en' | 'ar' | 'fr'
export type ThemeMode = 'light' | 'dark' | 'system'
export type MainTab = 'today' | 'plan' | 'progress' | 'profile' | 'more'
export type MoreSection = 'habits' | 'workouts' | 'scanner' | 'settings'
export type DietMealId = 'breakfast' | 'snack' | 'lunch' | 'dinner'
export type Gender = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
export type HealthGoal = 'lose' | 'maintain' | 'gain'
export type SportPreference = 'gym' | 'home' | 'run' | 'bike' | 'swim' | 'walk' | 'yoga' | 'football'
export type HabitId = 'meal-1' | 'meal-2' | 'meal-3' | 'meal-4' | 'fruit' | 'workout'

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
  imageKey?: string
  recipeUrl?: string
  videoUrl?: string
  isImported?: boolean
}

export interface MealGroup {
  id: DietMealId
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
  warning?: string
}

export interface UserAccount {
  id: string
  username: string
  email?: string
  displayName: string
  createdAt: string
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
export type DaySelections = Record<DietMealId, MealSelection>
export type SelectionMap = Record<string, DaySelections>
export type FruitMap = Record<string, string[]>
export type HabitMap = Record<string, Partial<Record<HabitId, boolean>>>

export interface FoodProduct {
  id: string
  barcode?: string
  name: string
  brand?: string
  imageUrl?: string
  source?: 'open-food-facts' | 'usda-fooddata-central' | 'plan' | 'offline'
  calories: number
  protein: number
  carbs: number
  fat: number
  serving: string
  grade?: string
}

export interface AppData {
  profile: UserProfile
  dietPlan?: ImportedDietPlan
  planSkippedAt?: string
  selections: SelectionMap
  fruitMap: FruitMap
  waterByDay: Record<string, number>
  habits: HabitMap
  weights: WeightEntry[]
  sport: SportPreference
  language: Language
  theme: ThemeMode
  scanHistory: FoodProduct[]
}

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}
