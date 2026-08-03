import { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { Barcode, Camera, Check, Image, LoaderCircle, PackageSearch, Search, ShoppingBasket, Trash2 } from 'lucide-react'
import { mealGroups } from '../data'
import { getActiveLanguage, tr } from '../i18n'
import type { FoodProduct } from '../types'
import { toArabicNumber } from '../utils'

interface ScannerPageProps {
  history: FoodProduct[]
  shoppingList: FoodProduct[]
  onResult: (product: FoodProduct) => void
  onToggleShopping: (product: FoodProduct) => void
  onClearHistory: () => void
}

interface OffProduct {
  code?: string
  product_name_ar?: string
  product_name?: string
  brands?: string
  image_front_small_url?: string
  nutrition_grades?: string
  serving_size?: string
  nutriments?: Record<string, number>
}

const demoProducts: FoodProduct[] = [
  { id: 'demo-yogurt', barcode: '5285000550014', name: 'زبادي يوناني', nameEn: 'Greek yogurt', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 97, protein: 9, carbs: 4, fat: 5, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
  { id: 'demo-oats', barcode: '7613034626844', name: 'شوفان كامل', nameEn: 'Whole oats', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 370, protein: 13, carbs: 60, fat: 7, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
  { id: 'demo-tuna', barcode: '6281007021339', name: 'تونا بالماء', nameEn: 'Tuna in water', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 116, protein: 26, carbs: 0, fat: 1, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
]

function mapProduct(product: OffProduct): FoodProduct {
  const nutrients = product.nutriments ?? {}
  const calories = nutrients['energy-kcal_100g'] ?? nutrients['energy-kcal_serving'] ?? 0
  return {
    id: product.code || `${product.product_name}-${Date.now()}`,
    barcode: product.code,
    name: product.product_name_ar || product.product_name || 'منتج غير مسمى',
    nameEn: product.product_name || product.product_name_ar || 'Unnamed product',
    brand: product.brands,
    imageUrl: product.image_front_small_url,
    calories: Math.round(calories),
    protein: Math.round((nutrients.proteins_100g ?? 0) * 10) / 10,
    carbs: Math.round((nutrients.carbohydrates_100g ?? 0) * 10) / 10,
    fat: Math.round((nutrients.fat_100g ?? 0) * 10) / 10,
    serving: product.serving_size ? `الحصة ${product.serving_size}` : 'لكل ١٠٠غ',
    servingEn: product.serving_size ? `Serving ${product.serving_size}` : 'Per 100 g',
    grade: product.nutrition_grades,
  }
}

export function ScannerPage({ history, shoppingList, onResult, onToggleShopping, onClearHistory }: ScannerPageProps) {
  const [mode, setMode] = useState<'scan' | 'list'>('scan')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<FoodProduct | null>(history[0] ?? null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const localizedProductName = (product: FoodProduct) => {
    if (getActiveLanguage() === 'ar') return product.name
    const migrated = demoProducts.find((item) => item.id === product.id)
    return product.nameEn ?? migrated?.nameEn ?? (/[؀-ۿ]/.test(product.name) ? 'Saved product' : product.name)
  }
  const localizedBrand = (product: FoodProduct) => {
    if (getActiveLanguage() === 'ar') return product.brand
    const migrated = demoProducts.find((item) => item.id === product.id)
    return product.brandEn ?? migrated?.brandEn ?? (product.brand && !/[؀-ۿ]/.test(product.brand) ? product.brand : undefined)
  }
  const localizedServing = (product: FoodProduct) => {
    if (getActiveLanguage() === 'ar') return product.serving
    const migrated = demoProducts.find((item) => item.id === product.id)
    return product.servingEn ?? migrated?.servingEn ?? 'Per 100 g'
  }

  async function fetchBarcode(code: string) {
    const local = demoProducts.find((item) => item.barcode === code)
    if (local) return local
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ar,brands,image_front_small_url,nutrition_grades,serving_size,nutriments`)
    if (!response.ok) throw new Error('network')
    const payload = await response.json() as { status: number; product?: OffProduct }
    if (!payload.product || payload.status !== 1) throw new Error('not-found')
    return mapProduct(payload.product)
  }

  async function searchByName(query: string) {
    const lowerQuery = query.toLocaleLowerCase()
    const localMeals = mealGroups.flatMap((meal) => meal.options).filter((item) => item.name.includes(query) || item.nameEn.toLocaleLowerCase().includes(lowerQuery)).slice(0, 1)
    if (localMeals[0]) {
      const meal = localMeals[0]
      return { id: `meal-${meal.id}`, name: meal.name, nameEn: meal.nameEn, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, serving: 'حصة من الخطة', servingEn: 'One plan portion' } satisfies FoodProduct
    }
    const local = demoProducts.find((item) => item.name.includes(query) || item.nameEn?.toLocaleLowerCase().includes(lowerQuery))
    if (local) return local
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1&fields=code,product_name,product_name_ar,brands,image_front_small_url,nutrition_grades,serving_size,nutriments`)
    if (!response.ok) throw new Error('network')
    const payload = await response.json() as { products?: OffProduct[] }
    if (!payload.products?.[0]) throw new Error('not-found')
    return mapProduct(payload.products[0])
  }

  async function runSearch(kind: 'barcode' | 'name', value: string) {
    if (!value.trim()) return
    setLoading(true)
    setMessage('')
    try {
      const product = kind === 'barcode' ? await fetchBarcode(value.trim()) : await searchByName(value.trim())
      setResult(product)
      onResult(product)
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'not-found' ? tr('لم نعثر على هذا المنتج. جرّب الاسم أو باركوداً آخر.', 'We couldn’t find this product. Try another name or barcode.') : tr('تعذر الوصول إلى قاعدة المنتجات. ما زال بإمكانك البحث في وجبات الخطة المحلية.', 'The product database is unavailable. You can still search the local meal catalogue.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: ImageBitmap): Promise<{ rawValue: string }[]> } }).BarcodeDetector
      if (!Detector) throw new Error('unsupported')
      const bitmap = await createImageBitmap(file)
      const detected = await new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(bitmap)
      bitmap.close()
      if (!detected[0]?.rawValue) throw new Error('not-found')
      setBarcode(detected[0].rawValue)
      await runSearch('barcode', detected[0].rawValue)
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'unsupported' ? tr('المسح التلقائي غير مدعوم في هذا المتصفح. أدخل الباركود يدوياً.', 'Automatic scanning is not supported in this browser. Enter the barcode manually.') : tr('لم يظهر باركود واضح في الصورة. جرّب صورة أقرب أو أدخله يدوياً.', 'No clear barcode was detected. Try a closer image or enter it manually.'))
      setLoading(false)
    }
    event.target.value = ''
  }

  function submitBarcode(event: FormEvent) { event.preventDefault(); void runSearch('barcode', barcode) }
  function submitName(event: FormEvent) { event.preventDefault(); void runSearch('name', name) }
  const inList = result ? shoppingList.some((item) => item.id === result.id) : false

  return (
    <div className="scanner-page">
      <section className="feature-intro">
        <div><span className="status-pill"><Barcode size={14} /> {tr('مسح طعام', 'Food scanner')}</span><h2>{tr('اعرف ما في عبوتك', 'Know what’s in your package')}</h2><p>{tr('امسح الباركود أو ابحث باسم المنتج لرؤية القيم لكل ١٠٠غ.', 'Scan a barcode or search by product name to view nutrition per 100 g.')}</p></div>
        <button className="soft-btn feature-switch" onClick={() => setMode(mode === 'scan' ? 'list' : 'scan')}><ShoppingBasket size={17} /> {mode === 'scan' ? `${tr('قائمتي', 'My list')} (${toArabicNumber(shoppingList.length)})` : tr('العودة للمسح', 'Back to scanner')}</button>
      </section>

      {mode === 'list' ? (
        <section className="shopping-panel card-surface">
          <div className="section-heading"><div><p className="eyebrow">{tr('قائمة التسوق', 'Shopping list')}</p><h2>{tr('منتجاتي المحفوظة', 'Saved products')}</h2></div></div>
          {shoppingList.length === 0 ? <div className="empty-state"><ShoppingBasket size={30} /><b>{tr('قائمتك فارغة', 'Your list is empty')}</b><p>{tr('أضف منتجاً من نتيجة البحث ليظهر هنا.', 'Add a product from a search result and it will appear here.')}</p></div> : <div className="shopping-list">{shoppingList.map((product) => <div key={product.id}><span><Check size={15} /></span><p><b>{localizedProductName(product)}</b><small>{localizedBrand(product) || localizedServing(product)}</small></p><em>{toArabicNumber(product.calories)} {tr('سعرة', 'kcal')}</em><button onClick={() => onToggleShopping(product)} aria-label={`${tr('حذف', 'Delete')} ${localizedProductName(product)}`}><Trash2 size={15} /></button></div>)}</div>}
        </section>
      ) : (
        <section className="scanner-layout">
          <div className="scan-tools card-surface">
            <div className="camera-zone">
              <span><Camera size={28} /></span><div><b>{tr('التقط صورة للباركود', 'Take a barcode photo')}</b><p>{tr('تعمل المعالجة على جهازك، ثم نبحث عن المنتج.', 'The image is processed on your device before product lookup.')}</p></div>
              <button className="primary-btn" onClick={() => fileRef.current?.click()}><Image size={16} /> {tr('الكاميرا أو المعرض', 'Camera or gallery')}</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} hidden />
            </div>
            <div className="scan-separator"><span>{tr('أو', 'OR')}</span></div>
            <form className="search-form" onSubmit={submitBarcode}><label><Barcode size={17} /><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder={tr('أدخل رقم الباركود', 'Enter barcode number')} /></label><button className="primary-btn" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} {tr('بحث', 'Search')}</button></form>
            <form className="search-form" onSubmit={submitName}><label><PackageSearch size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr('أو ابحث باسم المنتج', 'Or search by product name')} /></label><button className="soft-btn" disabled={loading}>{tr('بحث بالاسم', 'Search by name')}</button></form>
            {message && <p className="form-message">{message}</p>}
          </div>

          <aside className="scan-result card-surface">
            {!result ? <div className="empty-state"><PackageSearch size={32} /><b>{tr('ستظهر النتيجة هنا', 'Your result will appear here')}</b><p>{tr('جرّب الرمز 5285000550014 لعرض مثال يعمل دون اتصال.', 'Try 5285000550014 for an offline example.')}</p></div> : <><div className="product-head">{result.imageUrl ? <img src={result.imageUrl} alt="" /> : <span>🥫</span>}<div><small>{localizedBrand(result) || tr('منتج غذائي', 'Food product')}</small><h3>{localizedProductName(result)}</h3><p>{localizedServing(result)}</p></div>{result.grade && <i className={`grade grade-${result.grade}`}>{result.grade.toUpperCase()}</i>}</div><div className="product-calories"><b>{toArabicNumber(result.calories)}</b><span>{tr('سعرة حرارية', 'kcal')}</span></div><div className="product-macros"><div><small>{tr('بروتين', 'Protein')}</small><b>{toArabicNumber(result.protein)}g</b></div><div><small>{tr('كربوهيدرات', 'Carbohydrates')}</small><b>{toArabicNumber(result.carbs)}g</b></div><div><small>{tr('دهون', 'Fat')}</small><b>{toArabicNumber(result.fat)}g</b></div></div><button className={inList ? 'soft-btn product-save saved' : 'primary-btn product-save'} onClick={() => onToggleShopping(result)}>{inList ? <><Check size={16} /> {tr('تمت الإضافة', 'Added')}</> : <><ShoppingBasket size={16} /> {tr('أضف لقائمتي', 'Add to my list')}</>}</button></>}
          </aside>
        </section>
      )}

      {history.length > 0 && mode === 'scan' && <section className="scan-history card-surface"><div className="section-heading compact"><div><p className="eyebrow">{tr('آخر عمليات البحث', 'Recent searches')}</p><h3>{tr('السجل', 'History')}</h3></div><button className="text-action danger" onClick={onClearHistory}>{tr('مسح السجل', 'Clear history')}</button></div><div>{history.map((product) => <button key={`${product.id}-${product.name}`} onClick={() => setResult(product)}><span>🥫</span><p><b>{localizedProductName(product)}</b><small>{localizedBrand(product) || product.barcode}</small></p><em>{toArabicNumber(product.calories)} {tr('سعرة', 'kcal')}</em></button>)}</div></section>}
    </div>
  )
}
