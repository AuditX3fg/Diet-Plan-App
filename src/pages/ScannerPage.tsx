import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { Barcode, Camera, Check, Flashlight, Image, LoaderCircle, PackageSearch, Search, ShoppingBasket, Trash2, Video, VideoOff } from 'lucide-react'
import { mealGroups } from '../data'
import { getActiveLanguage, tr } from '../i18n'
import type { FoodProduct } from '../types'
import { toArabicNumber } from '../utils'
import { lookupProductBarcode, searchProductsLive } from '../services/products'

interface ScannerPageProps {
  history: FoodProduct[]
  shoppingList: FoodProduct[]
  onResult: (product: FoodProduct) => void
  onToggleShopping: (product: FoodProduct) => void
  onClearHistory: () => void
}

const demoProducts: FoodProduct[] = [
  { id: 'demo-yogurt', barcode: '5285000550014', name: 'زبادي يوناني', nameEn: 'Greek yogurt', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 97, protein: 9, carbs: 4, fat: 5, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
  { id: 'demo-oats', barcode: '7613034626844', name: 'شوفان كامل', nameEn: 'Whole oats', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 370, protein: 13, carbs: 60, fat: 7, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
  { id: 'demo-tuna', barcode: '6281007021339', name: 'تونا بالماء', nameEn: 'Tuna in water', brand: 'منتج تجريبي', brandEn: 'Demo product', calories: 116, protein: 26, carbs: 0, fat: 1, serving: 'لكل ١٠٠غ', servingEn: 'Per 100 g', grade: 'a' },
]

export function ScannerPage({ history, shoppingList, onResult, onToggleShopping, onClearHistory }: ScannerPageProps) {
  const [mode, setMode] = useState<'scan' | 'list'>('scan')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<FoodProduct | null>(history[0] ?? null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [liveResults, setLiveResults] = useState<FoodProduct[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null)
  const [torch, setTorch] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectingRef = useRef(false)
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

  useEffect(() => {
    if (!cameraOpen) return
    let cancelled = false
    let timer = 0
    async function startCamera() {
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput')
        setCameraDevices(devices)
        const track = stream.getVideoTracks()[0]
        if (!selectedDeviceId) {
          const closeLens = devices.find((device) => /macro|ultra.?wide|0[.,]5|back.*ultra/i.test(device.label))
          setSelectedDeviceId(closeLens?.deviceId || track.getSettings().deviceId || '')
        }
        const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number }; torch?: boolean }
        setZoomRange(capabilities.zoom ?? null)
        setTorchAvailable(Boolean(capabilities.torch))
        if (capabilities.zoom) setZoom((track.getSettings() as MediaTrackSettings & { zoom?: number }).zoom ?? capabilities.zoom.min)
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector
        if (!Detector) return
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        const detect = async () => {
          if (cancelled || !videoRef.current || detectingRef.current) return
          detectingRef.current = true
          try {
            const matches = await detector.detect(videoRef.current)
            if (matches[0]?.rawValue) {
              setBarcode(matches[0].rawValue)
              setCameraOpen(false)
              await runSearch('barcode', matches[0].rawValue)
              return
            }
          } catch { /* The video can be between frames while lenses change. */ }
          finally { detectingRef.current = false }
          timer = window.setTimeout(detect, 280)
        }
        timer = window.setTimeout(detect, 400)
      } catch {
        setMessage(tr('تعذر فتح الكاميرا. اسمح بالوصول أو استخدم صورة من المعرض.', 'Camera could not open. Allow camera access or choose a gallery image.'))
        setCameraOpen(false)
      }
    }
    void startCamera()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [cameraOpen, selectedDeviceId])

  useEffect(() => {
    const query = name.trim()
    if (query.length < 3) { setLiveResults([]); setLiveLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLiveLoading(true)
      try {
        const remote = await searchProductsLive(query, controller.signal)
        setLiveResults(remote.products)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLiveResults([])
      } finally {
        if (!controller.signal.aborted) setLiveLoading(false)
      }
    }, 900)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [name])

  async function applyCameraConstraint(constraint: Record<string, unknown>) {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints)
  }

  function chooseLiveResult(product: FoodProduct) {
    setResult(product)
    setLiveResults([])
    setName(localizedProductName(product))
    onResult(product)
  }

  async function fetchBarcode(code: string) {
    const local = demoProducts.find((item) => item.barcode === code)
    if (local) return local
    return lookupProductBarcode(code)
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
    const remote = await searchProductsLive(query)
    if (!remote.products[0]) throw new Error('not-found')
    return remote.products[0]
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
            {cameraOpen ? <div className="live-camera">
              <div className="camera-preview"><video ref={videoRef} playsInline muted /><div className="camera-reticle"><span /><small>{tr('قرّب الباركود وثبّت الهاتف', 'Move close and hold the barcode steady')}</small></div></div>
              <div className="camera-controls">
                {cameraDevices.length > 1 && <label><span>{tr('العدسة', 'Lens')}</span><select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>{cameraDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${tr('كاميرا', 'Camera')} ${index + 1}`}</option>)}</select></label>}
                {zoomRange && <label className="zoom-control"><span>{tr('تكبير قريب', 'Close zoom')} {zoom.toFixed(1)}×</span><input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step || .1} value={zoom} onChange={(event) => { const next = Number(event.target.value); setZoom(next); void applyCameraConstraint({ zoom: next }) }} /></label>}
                {torchAvailable && <button className={torch ? 'soft-btn active' : 'soft-btn'} onClick={() => { const next = !torch; setTorch(next); void applyCameraConstraint({ torch: next }) }}><Flashlight size={15} /> {tr('إضاءة', 'Light')}</button>}
                <button className="soft-btn" onClick={() => setCameraOpen(false)}><VideoOff size={15} /> {tr('إغلاق', 'Close')}</button>
              </div>
            </div> : <div className="camera-zone">
              <span><Camera size={28} /></span><div><b>{tr('ماسح قريب مباشر', 'Live close-focus scanner')}</b><p>{tr('يستخدم أفضل عدسة خلفية يتيحها المتصفح مع التركيز والتكبير.', 'Uses the best rear lens exposed by your browser, with focus and zoom assistance.')}</p></div>
              <div className="camera-actions"><button className="primary-btn" onClick={() => setCameraOpen(true)}><Video size={16} /> {tr('فتح الماسح', 'Open scanner')}</button><button className="soft-btn" onClick={() => fileRef.current?.click()}><Image size={16} /> {tr('صورة', 'Photo')}</button></div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} hidden />
            </div>}
            <div className="scan-separator"><span>{tr('أو', 'OR')}</span></div>
            <form className="search-form" onSubmit={submitBarcode}><label><Barcode size={17} /><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder={tr('أدخل رقم الباركود', 'Enter barcode number')} /></label><button className="primary-btn" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} {tr('بحث', 'Search')}</button></form>
            <form className="search-form live-search-form" onSubmit={submitName}><label><PackageSearch size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr('ابحث مباشرة باسم المنتج', 'Live search by product name')} />{liveLoading && <LoaderCircle className="spin" size={15} />}</label><button className="soft-btn" disabled={loading}>{tr('بحث بالاسم', 'Search by name')}</button></form>
            {liveResults.length > 0 && <div className="live-product-results" role="listbox" aria-label={tr('نتائج المنتجات المباشرة', 'Live product results')}>{liveResults.map((product) => <button type="button" key={product.id} onClick={() => chooseLiveResult(product)}><span>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : '🥫'}</span><p><b>{localizedProductName(product)}</b><small>{localizedBrand(product) || localizedServing(product)}</small></p><em>{toArabicNumber(product.calories)} {tr('سعرة', 'kcal')}</em></button>)}</div>}
            <p className="search-source"><span />{tr('نتائج مباشرة من قاعدة USDA FoodData Central', 'Live results from USDA FoodData Central')}</p>
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
