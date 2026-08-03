import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import type { AppTheme } from '../../theme'
import { palette } from '../../theme'
import type { AppData, FoodProduct } from '../../types'
import { Card, EmptyState, FormField, PrimaryButton, SecondaryButton, SectionHeader } from '../../components/ui'
import { tr } from '../../i18n'
import { lookupProductBarcode, searchProductsLive } from '../../services/products'

interface ScannerPanelProps {
  data: AppData
  theme: AppTheme
  onChangeData: (next: AppData) => void
}

export function ScannerPanel({ data, theme, onChangeData }: ScannerPanelProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lenses, setLenses] = useState<string[]>([])
  const [selectedLens, setSelectedLens] = useState<string | undefined>()
  const [zoom, setZoom] = useState(0)
  const [torch, setTorch] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [liveResults, setLiveResults] = useState<FoodProduct[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const query = nameQuery.trim()
    if (query.length < 3) { setLiveResults([]); setSearching(false); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try { setLiveResults(await searchProductsLive(query, controller.signal)) }
      catch (caught) { if (!(caught instanceof Error && caught.name === 'AbortError')) setError('Live product search is temporarily unavailable.') }
      finally { if (!controller.signal.aborted) setSearching(false) }
    }, 900)
    return () => { clearTimeout(timer); controller.abort() }
  }, [nameQuery])

  function saveProduct(item: FoodProduct) {
    onChangeData({ ...data, scanHistory: [item, ...data.scanHistory.filter((entry) => entry.id !== item.id)].slice(0, 10) })
    setLiveResults([])
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  async function lookup(code: string) {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    setLocked(true)
    try {
      const item = await lookupProductBarcode(code.trim())
      saveProduct(item)
      setCameraOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not look up this product.')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setBusy(false)
      setTimeout(() => setLocked(false), 900)
    }
  }

  function scanned(result: BarcodeScanningResult) {
    if (locked) return
    setBarcode(result.data)
    void lookup(result.data)
  }

  async function openCamera() {
    if (!permission?.granted) {
      const next = await requestPermission()
      if (!next.granted) return
    }
    setCameraOpen(true)
    setLocked(false)
  }

  function updateLenses(next: string[]) {
    setLenses(next)
    if (selectedLens || !next.length) return
    const preferred = next.find((lens) => /triple/i.test(lens))
      ?? next.find((lens) => /dualwide/i.test(lens))
      ?? next.find((lens) => /ultrawide|macro/i.test(lens))
      ?? next.find((lens) => /wide/i.test(lens))
      ?? next[0]
    setSelectedLens(preferred)
  }

  return <View style={styles.panel}><SectionHeader eyebrow={tr(data.language, 'FOOD SCANNER', 'ماسح الطعام')} title={tr(data.language, 'Know what you’re eating', 'اعرف ما تأكله')} caption={tr(data.language, 'Use a close-focus lens, scan a barcode, or search the live food database.', 'استخدم عدسة التركيز القريب أو امسح الباركود أو ابحث مباشرة.')} theme={theme} />{cameraOpen ? <Card theme={theme} style={styles.cameraCard}><View style={styles.cameraFrame}><CameraView style={StyleSheet.absoluteFill} facing="back" selectedLens={selectedLens} autofocus="on" zoom={zoom} enableTorch={torch} onAvailableLensesChanged={({ lenses: next }) => updateLenses(next)} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }} onBarcodeScanned={locked ? undefined : scanned} /><View pointerEvents="none" style={styles.scanOverlay}><View style={styles.scanBox} /><Text style={styles.scanHint}>{busy ? 'Looking up product…' : 'Move close and hold the barcode steady'}</Text></View></View>{lenses.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lensRow}>{lenses.map((lens) => <Pressable key={lens} onPress={() => { setSelectedLens(lens); setZoom(0) }} style={[styles.lensChip, { backgroundColor: selectedLens === lens ? theme.primary : theme.surfaceAlt, borderColor: selectedLens === lens ? theme.primary : theme.line }]}><Text style={{ color: selectedLens === lens ? '#fff' : theme.text, fontSize: 9, fontWeight: '900' }}>{lensLabel(lens)}</Text></Pressable>)}</ScrollView> : null}<View style={styles.cameraToolRow}><Pressable onPress={() => setZoom(zoom === 0 ? .12 : zoom === .12 ? .28 : 0)} style={[styles.cameraTool, { borderColor: theme.line, backgroundColor: theme.surfaceAlt }]}><Text style={[styles.cameraToolText, { color: theme.text }]}>{zoom === 0 ? '1×' : zoom === .12 ? 'Close' : 'Zoom'}</Text></Pressable><Pressable onPress={() => setTorch((value) => !value)} style={[styles.cameraTool, { borderColor: torch ? '#d7aa45' : theme.line, backgroundColor: torch ? '#f8e9bc' : theme.surfaceAlt }]}><Text style={[styles.cameraToolText, { color: torch ? '#725615' : theme.text }]}>☀ {torch ? 'On' : 'Light'}</Text></Pressable></View><SecondaryButton label="Close camera" onPress={() => { setCameraOpen(false); setTorch(false) }} theme={theme} /></Card> : <Pressable onPress={openCamera} style={[styles.scannerHero, { backgroundColor: theme.primary }]}><Text style={styles.scannerGlyph}>⌗</Text><Text style={styles.scannerTitle}>{tr(data.language, 'Open close-focus scanner', 'فتح ماسح التركيز القريب')}</Text><Text style={styles.scannerBody}>{tr(data.language, 'Auto-selects the best macro-capable rear lens available', 'يختار أفضل عدسة خلفية متاحة للتركيز القريب')}</Text></Pressable>}<Card theme={theme} style={styles.manualCard}><FormField label={tr(data.language, 'Barcode number', 'رقم الباركود')} value={barcode} onChangeText={setBarcode} placeholder="e.g. 3017620422003" keyboardType="number-pad" theme={theme} /><PrimaryButton label={busy ? 'Looking up…' : tr(data.language, 'Look up product', 'بحث عن المنتج')} onPress={() => lookup(barcode)} busy={busy} theme={theme} />{error ? <Text style={styles.scanError}>{error}</Text> : null}</Card><Card theme={theme} style={styles.manualCard}><FormField label={tr(data.language, 'Live product search', 'بحث مباشر عن المنتج')} value={nameQuery} onChangeText={(value) => { setNameQuery(value); setError('') }} placeholder={tr(data.language, 'Type at least 3 letters…', 'اكتب ٣ أحرف على الأقل…')} theme={theme} />{searching ? <View style={styles.searchingRow}><ActivityIndicator color={theme.primary} size="small" /><Text style={{ color: theme.muted, fontSize: 10 }}>Searching live food data…</Text></View> : null}{liveResults.map((product) => <Pressable key={product.id} onPress={() => { saveProduct(product); setNameQuery(product.name) }}><View style={[styles.liveProduct, { borderColor: theme.line }]}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.liveProductImage} /> : <View style={[styles.liveProductImage, { backgroundColor: theme.surfaceAlt }]}><Text>🥫</Text></View>}<View style={styles.flex}><Text numberOfLines={1} style={[styles.productName, { color: theme.text }]}>{product.name}</Text><Text numberOfLines={1} style={[styles.productBrand, { color: theme.muted }]}>{product.brand || product.serving}</Text></View><Text style={[styles.productCalories, { color: theme.primary }]}>{product.calories}{'\n'}<Text style={styles.productUnit}>kcal</Text></Text></View></Pressable>)}<Text style={[styles.liveSource, { color: theme.muted }]}>● Live results from USDA FoodData Central</Text></Card><SectionHeader eyebrow={tr(data.language, 'RECENT', 'الأخيرة')} title={tr(data.language, 'Scan history', 'سجل المسح')} theme={theme} />{data.scanHistory.length ? <View style={styles.scanList}>{data.scanHistory.map((product) => <Card key={product.id} theme={theme} style={styles.productCard}><View style={[styles.productGrade, { backgroundColor: gradeColor(product.grade) }]}><Text style={styles.productGradeText}>{product.grade?.toUpperCase() ?? '—'}</Text></View><View style={styles.flex}><Text style={[styles.productName, { color: theme.text }]}>{product.name}</Text><Text style={[styles.productBrand, { color: theme.muted }]}>{product.brand || product.serving}</Text><Text style={[styles.productMacros, { color: theme.muted }]}>{product.protein}g P · {product.carbs}g C · {product.fat}g F</Text></View><Text style={[styles.productCalories, { color: theme.primary }]}>{product.calories}{'\n'}<Text style={styles.productUnit}>kcal</Text></Text></Card>)}</View> : <EmptyState glyph="⌗" title={tr(data.language, 'No scans yet', 'لا يوجد مسح بعد')} body={tr(data.language, 'Your latest products will appear here.', 'ستظهر المنتجات الأخيرة هنا.')} theme={theme} />}</View>
}

function lensLabel(lens: string) {
  if (/triple|dualwide/i.test(lens)) return 'Auto macro'
  if (/ultrawide|macro/i.test(lens)) return '0.5× close'
  if (/telephoto/i.test(lens)) return 'Telephoto'
  if (/wide/i.test(lens)) return '1× wide'
  return lens.replace(/^builtIn/, '').replace(/Camera$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

function gradeColor(grade?: string) {
  if (grade === 'A') return '#3d8f60'
  if (grade === 'B') return '#74a84c'
  if (grade === 'C') return '#d1a742'
  if (grade === 'D') return '#d47d40'
  if (grade === 'E') return '#bf4f4f'
  return '#8b9691'
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: 17 },
  scannerHero: { minHeight: 170, borderRadius: 25, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 6 },
  scannerGlyph: { color: '#fff', fontSize: 42, fontWeight: '300' },
  scannerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  scannerBody: { color: '#d2e8df', fontSize: 10 },
  cameraCard: { gap: 12 },
  cameraFrame: { height: 360, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111' },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.18)', gap: 16 },
  scanBox: { width: '80%', height: 135, borderWidth: 2, borderColor: '#fff', borderRadius: 18 },
  scanHint: { color: '#fff', fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(0,0,0,.45)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  lensRow: { gap: 7, paddingVertical: 2 },
  lensChip: { minHeight: 35, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cameraToolRow: { flexDirection: 'row', gap: 8 },
  cameraTool: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cameraToolText: { fontSize: 10, fontWeight: '900' },
  manualCard: { gap: 12 },
  scanError: { color: palette.danger, fontSize: 11, fontWeight: '700' },
  searchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveProduct: { minHeight: 62, paddingVertical: 7, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveProductImage: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  liveSource: { fontSize: 8, marginTop: 1 },
  scanList: { gap: 9 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productGrade: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  productGradeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  productName: { fontSize: 13, fontWeight: '900' },
  productBrand: { marginTop: 2, fontSize: 9 },
  productMacros: { marginTop: 4, fontSize: 9 },
  productCalories: { textAlign: 'right', fontSize: 16, fontWeight: '900' },
  productUnit: { fontSize: 8, fontWeight: '700' },
})
