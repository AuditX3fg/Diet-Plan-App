import type { FoodProduct } from '../types'

export interface ProductSearchSource {
  products: FoodProduct[]
  source: 'usda-fooddata-central'
}

interface OffProduct {
  code?: string
  product_name_ar?: string
  product_name_en?: string
  product_name?: string
  brands?: string | string[]
  image_front_small_url?: string
  nutrition_grades?: string
  nutriscore_grade?: string
  serving_size?: string
  nutriments?: Record<string, number>
}

const fields = 'code,product_name,product_name_en,product_name_ar,brands,image_front_small_url,nutrition_grades,nutriscore_grade,serving_size,nutriments'
const searchCache = new Map<string, FoodProduct[]>()

interface UsdaFood {
  fdcId: number
  description?: string
  brandName?: string
  brandOwner?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients?: Array<{ nutrientName?: string; unitName?: string; value?: number }>
}

function mapUsdaFood(food: UsdaFood): FoodProduct {
  const nutrient = (names: string[]) => food.foodNutrients?.find((item) => names.includes(item.nutrientName ?? ''))?.value ?? 0
  return {
    id: `usda-${food.fdcId}`,
    barcode: food.gtinUpc,
    name: food.description || 'Unnamed food',
    nameEn: food.description || 'Unnamed food',
    brand: food.brandName || food.brandOwner,
    brandEn: food.brandName || food.brandOwner,
    calories: Math.round(nutrient(['Energy', 'Energy (Atwater General Factors)', 'Energy (Atwater Specific Factors)'])),
    protein: Math.round(nutrient(['Protein']) * 10) / 10,
    carbs: Math.round(nutrient(['Carbohydrate, by difference']) * 10) / 10,
    fat: Math.round(nutrient(['Total lipid (fat)']) * 10) / 10,
    serving: food.servingSize ? `الحصة ${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : 'لكل ١٠٠غ',
    servingEn: food.servingSize ? `Serving ${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : 'Per 100 g',
    source: 'usda-fooddata-central',
  }
}

export function mapOpenFoodFactsProduct(product: OffProduct): FoodProduct {
  const nutrients = product.nutriments ?? {}
  const calories = nutrients['energy-kcal_100g'] ?? nutrients['energy-kcal_serving'] ?? nutrients['energy-kcal'] ?? 0
  const fallbackName = product.product_name_en || product.product_name || product.product_name_ar || 'Unnamed product'
  return {
    id: product.code || `off-${fallbackName}`,
    barcode: product.code,
    name: product.product_name_ar || product.product_name || fallbackName,
    nameEn: product.product_name_en || product.product_name || fallbackName,
    brand: Array.isArray(product.brands) ? product.brands.join(', ') : product.brands,
    brandEn: Array.isArray(product.brands) ? product.brands.join(', ') : product.brands,
    imageUrl: product.image_front_small_url,
    calories: Math.round(calories),
    protein: Math.round((nutrients.proteins_100g ?? 0) * 10) / 10,
    carbs: Math.round((nutrients.carbohydrates_100g ?? 0) * 10) / 10,
    fat: Math.round((nutrients.fat_100g ?? 0) * 10) / 10,
    serving: product.serving_size ? `الحصة ${product.serving_size}` : 'لكل ١٠٠غ',
    servingEn: product.serving_size ? `Serving ${product.serving_size}` : 'Per 100 g',
    grade: product.nutrition_grades || product.nutriscore_grade,
    source: 'open-food-facts',
  }
}

export async function lookupProductBarcode(code: string, signal?: AbortSignal) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal })
  if (!response.ok) throw new Error('network')
  const payload = await response.json() as { status?: string; product?: OffProduct }
  if (!payload.product) throw new Error('not-found')
  return mapOpenFoodFactsProduct(payload.product)
}

export async function searchProductsLive(query: string, signal?: AbortSignal): Promise<ProductSearchSource> {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized.length < 3) return { products: [], source: 'usda-fooddata-central' }
  const cached = searchCache.get(normalized)
  if (cached) return { products: cached, source: 'usda-fooddata-central' }
  const apiKey = import.meta.env.VITE_USDA_API_KEY?.trim() || 'DEMO_KEY'
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(normalized)}&pageSize=6`, { signal })
  if (!response.ok) throw new Error('network')
  const payload = await response.json() as { foods?: UsdaFood[] }
  const products = (payload.foods ?? []).map(mapUsdaFood)
  searchCache.set(normalized, products)
  return { products, source: 'usda-fooddata-central' }
}
