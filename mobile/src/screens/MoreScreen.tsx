import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video'
import { aliTrainingDays, isAliSaadeAccount, type TrainingDayDefinition } from '../aliTraining'
import type { AppTheme } from '../theme'
import { palette } from '../theme'
import type { AppData, FoodProduct, Language, MoreSection, SportPreference, ThemeMode, UserAccount } from '../types'
import { habitTasks, sportOptions, workoutPlans } from '../data'
import { Card, EmptyState, FormField, PrimaryButton, ScreenScroll, SecondaryButton, SectionHeader } from '../components/ui'
import { completedHabitCount } from '../utils/nutrition'
import { tr } from '../i18n'
import { addRecoveryEmail } from '../services/auth'
import { cloudTrainingVideoSource, deleteCloudTrainingVideo, listCloudTrainingVideos, moveCloudTrainingVideo, uploadCloudTrainingVideo, type CloudTrainingVideo } from '../services/cloud'
import { lookupProductBarcode, searchProductsLive } from '../services/products'

const sections: Array<{ id: MoreSection; glyph: string; en: string; ar: string }> = [
  { id: 'habits', glyph: '✓', en: 'Habits', ar: 'العادات' },
  { id: 'workouts', glyph: '↟', en: 'Workout', ar: 'التمرين' },
  { id: 'scanner', glyph: '⌗', en: 'Scanner', ar: 'الماسح' },
  { id: 'settings', glyph: '⚙', en: 'Settings', ar: 'الإعدادات' },
]

export function MoreScreen({ account, data, theme, onChangeAccount, onChangeData, onReplacePlan, onLogout }: {
  account: UserAccount
  data: AppData
  theme: AppTheme
  onChangeAccount: (next: UserAccount) => void
  onChangeData: (next: AppData) => void
  onReplacePlan: () => void
  onLogout: () => void
}) {
  const [section, setSection] = useState<MoreSection>('habits')
  return (
    <ScreenScroll theme={theme}>
      <SectionHeader eyebrow={tr(data.language, 'MORE TOOLS', 'أدوات إضافية')} title={tr(data.language, 'Your wellness hub', 'مركز صحتك')} caption={tr(data.language, 'Habits, workouts, food scan, and app preferences.', 'العادات والتمرين ومسح الطعام وإعدادات التطبيق.')} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>{sections.map((item) => <Pressable key={item.id} onPress={() => setSection(item.id)} style={[styles.sectionTab, { backgroundColor: section === item.id ? theme.primary : theme.surface, borderColor: section === item.id ? theme.primary : theme.line }]}><Text style={[styles.sectionGlyph, { color: section === item.id ? '#fff' : theme.primary }]}>{item.glyph}</Text><Text style={[styles.sectionLabel, { color: section === item.id ? '#fff' : theme.text }]}>{data.language === 'ar' ? item.ar : item.en}</Text></Pressable>)}</ScrollView>
      {section === 'habits' ? <HabitsPanel data={data} theme={theme} onChangeData={onChangeData} /> : null}
      {section === 'workouts' ? <WorkoutsPanel account={account} data={data} theme={theme} onChangeData={onChangeData} /> : null}
      {section === 'scanner' ? <ScannerPanel data={data} theme={theme} onChangeData={onChangeData} /> : null}
      {section === 'settings' ? <SettingsPanel account={account} data={data} theme={theme} onChangeAccount={onChangeAccount} onChangeData={onChangeData} onReplacePlan={onReplacePlan} onLogout={onLogout} /> : null}
    </ScreenScroll>
  )
}

function HabitsPanel({ data, theme, onChangeData }: { data: AppData; theme: AppTheme; onChangeData: (next: AppData) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const completed = completedHabitCount(data, today)
  function toggle(id: typeof habitTasks[number]['id']) {
    const todayHabits = data.habits[today] ?? {}
    onChangeData({ ...data, habits: { ...data.habits, [today]: { ...todayHabits, [id]: !todayHabits[id] } } })
    void Haptics.selectionAsync()
  }
  return <View style={styles.panel}><SectionHeader eyebrow={tr(data.language, 'DAILY CHECK-IN', 'المتابعة اليومية')} title={tr(data.language, `${completed} of 6 complete`, `${completed} من ٦ مكتملة`)} caption={tr(data.language, 'Complete all six to extend your adherence streak.', 'أكمل الستة لزيادة سلسلة الالتزام.')} theme={theme} /><Card theme={theme} style={styles.habitProgress}><View style={[styles.habitRing, { borderColor: completed === 6 ? theme.primary : theme.line }]}><Text style={[styles.habitRingValue, { color: theme.text }]}>{completed}</Text><Text style={[styles.habitRingUnit, { color: theme.muted }]}>/ 6</Text></View><View style={styles.flex}><Text style={[styles.habitProgressTitle, { color: theme.text }]}>{completed === 6 ? tr(data.language, 'Perfect day!', 'يوم مثالي!') : tr(data.language, 'Keep the rhythm going', 'استمر على هذا الإيقاع')}</Text><Text style={[styles.habitProgressBody, { color: theme.muted }]}>{tr(data.language, 'Each check-in keeps your plan visible and intentional.', 'كل متابعة تبقي خطتك واضحة ومقصودة.')}</Text></View></Card><View style={styles.habitList}>{habitTasks.map((task) => { const checked = Boolean(data.habits[today]?.[task.id]); return <Pressable key={task.id} onPress={() => toggle(task.id)}><Card theme={theme} style={[styles.habitItem, checked && { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}><Text style={styles.habitGlyph}>{task.glyph}</Text><Text style={[styles.habitText, { color: theme.text }]}>{data.language === 'ar' ? task.label : task.labelEn}</Text><View style={[styles.check, { backgroundColor: checked ? theme.primary : theme.surfaceAlt, borderColor: checked ? theme.primary : theme.line }]}><Text style={styles.checkText}>{checked ? '✓' : ''}</Text></View></Card></Pressable> })}</View></View>
}

function AliWorkoutsPanel({ data, theme }: { data: AppData; theme: AppTheme }) {
  const [videos, setVideos] = useState<CloudTrainingVideo[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [uploadingDay, setUploadingDay] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [movingId, setMovingId] = useState('')
  const [movingDestinationId, setMovingDestinationId] = useState('')
  const [videoToMove, setVideoToMove] = useState<CloudTrainingVideo | null>(null)
  const [error, setError] = useState('')
  const selectedVideo = videos.find((video) => video.id === activeId) ?? videos[0]
  const selectedDay = aliTrainingDays.find((day) => day.id === selectedVideo?.sessionId)
  const player = useVideoPlayer(null)

  async function refreshVideos(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const result = await listCloudTrainingVideos()
      setVideos(result.videos)
      setActiveId((current) => preferredId || (result.videos.some((video) => video.id === current) ? current : result.videos[0]?.id || ''))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load training videos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshVideos() }, [])
  useEffect(() => {
    let active = true
    if (!selectedVideo) { player.pause(); void player.replaceAsync(null); return }
    setPlayerLoading(true)
    void cloudTrainingVideoSource(selectedVideo.id, selectedVideo.title).then(async (source: VideoSource) => {
      if (!active) return
      player.pause()
      await player.replaceAsync(source)
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Could not load this training video.')
    }).finally(() => { if (active) setPlayerLoading(false) })
    return () => { active = false }
  }, [player, selectedVideo?.id])

  async function pickVideos(day: TrainingDayDefinition) {
    const result = await DocumentPicker.getDocumentAsync({ type: ['video/mp4', 'video/quicktime', 'video/webm'], multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return
    setUploadingDay(day.id)
    setError('')
    let lastUploadedId = ''
    try {
      for (const asset of result.assets) {
        const title = asset.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || `${day.title} exercise`
        lastUploadedId = (await uploadCloudTrainingVideo(day.id, title, asset)).id
      }
      await refreshVideos(lastUploadedId)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload this video.')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingDay('')
    }
  }

  function confirmDelete(video: CloudTrainingVideo) {
    Alert.alert(tr(data.language, 'Delete video?', 'حذف الفيديو؟'), tr(data.language, `“${video.title}” will be permanently removed from every device.`, `سيتم حذف “${video.title}” نهائياً من جميع الأجهزة.`), [
      { text: tr(data.language, 'Cancel', 'إلغاء'), style: 'cancel' },
      { text: tr(data.language, 'Delete', 'حذف'), style: 'destructive', onPress: async () => {
        setDeletingId(video.id)
        setError('')
        try { await deleteCloudTrainingVideo(video.id); await refreshVideos(); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this video.') }
        finally { setDeletingId('') }
      } },
    ])
  }

  async function moveVideoTo(destination: TrainingDayDefinition) {
    if (!videoToMove || destination.id === videoToMove.sessionId) return
    const videoId = videoToMove.id
    setMovingId(videoId)
    setMovingDestinationId(destination.id)
    setError('')
    try {
      const result = await moveCloudTrainingVideo(videoId, destination.id)
      setVideos((current) => current.map((video) => video.id === videoId ? result.video : video))
      setActiveId(videoId)
      setVideoToMove(null)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not move this video.')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setMovingId('')
      setMovingDestinationId('')
    }
  }

  return (
    <View style={styles.panel}>
      <SectionHeader eyebrow={tr(data.language, 'PRIVATE CLOUD LIBRARY', 'مكتبة سحابية خاصة')} title={tr(data.language, 'Ali’s training sessions', 'جلسات علي التدريبية')} caption={tr(data.language, 'Upload, move, or delete videos for each day. Changes appear on every device signed into your account.', 'ارفع أو انقل أو احذف فيديوهات كل يوم. تظهر التغييرات على كل جهاز مسجل بحسابك.')} theme={theme} />
      <Card theme={theme} style={styles.personalVideoCard}>
        {selectedVideo ? <><View style={styles.personalVideoHeading}><View style={styles.flex}><Text style={[styles.personalVideoDay, { color: theme.primary }]}>{selectedDay ? (data.language === 'ar' ? selectedDay.titleAr : selectedDay.title) : ''}</Text><Text style={[styles.personalVideoTitle, { color: theme.text }]}>{selectedVideo.title}</Text></View><View style={[styles.assignedBadge, { backgroundColor: theme.primarySoft }]}><Text style={[styles.assignedBadgeText, { color: theme.primary }]}>{tr(data.language, 'SYNCED', 'متزامن')}</Text></View></View><VideoView player={player} style={styles.personalVideo} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />{playerLoading ? <View style={styles.personalPlayerLoading}><ActivityIndicator color="#fff" /><Text style={styles.personalPlayerLoadingText}>{tr(data.language, 'Loading private video…', 'جارٍ تحميل الفيديو الخاص…')}</Text></View> : null}</> : <View style={[styles.personalEmptyPlayer, { backgroundColor: theme.surfaceAlt }]}><Text style={styles.personalEmptyGlyph}>↥</Text><Text style={[styles.personalEmptyTitle, { color: theme.text }]}>{loading ? tr(data.language, 'Loading your library…', 'جارٍ تحميل المكتبة…') : tr(data.language, 'Upload your first video', 'ارفع أول فيديو')}</Text><Text style={[styles.personalEmptyBody, { color: theme.muted }]}>{tr(data.language, 'MP4, MOV, or WebM · up to 100 MB', 'MP4 أو MOV أو WebM · حتى ١٠٠ ميغابايت')}</Text></View>}
      </Card>
      {error ? <Card theme={theme} style={styles.personalErrorCard}><Text style={styles.personalErrorText}>{error}</Text></Card> : null}
      {videoToMove ? <Card theme={theme} style={styles.personalMoveCard}><View style={styles.personalMoveHeading}><View style={styles.flex}><Text style={[styles.personalMoveEyebrow, { color: theme.primary }]}>{tr(data.language, 'MOVE VIDEO', 'نقل الفيديو')}</Text><Text numberOfLines={2} style={[styles.personalMoveTitle, { color: theme.text }]}>{videoToMove.title}</Text></View><Pressable onPress={() => setVideoToMove(null)} disabled={Boolean(movingId)} style={[styles.personalMoveClose, { borderColor: theme.line }]}><Text style={[styles.personalMoveCloseText, { color: theme.muted }]}>×</Text></Pressable></View><Text style={[styles.personalMovePrompt, { color: theme.muted }]}>{tr(data.language, 'Choose the destination training category:', 'اختر فئة التدريب الجديدة:')}</Text><View style={styles.personalMoveOptions}>{aliTrainingDays.filter((day) => day.id !== videoToMove.sessionId).map((day) => <Pressable key={day.id} onPress={() => void moveVideoTo(day)} disabled={Boolean(movingId)} style={[styles.personalMoveOption, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>{movingDestinationId === day.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalMoveOptionGlyph, { color: theme.primary }]}>⇄</Text>}<View style={styles.flex}><Text style={[styles.personalMoveOptionDay, { color: theme.text }]}>{data.language === 'ar' ? day.titleAr : day.title}</Text><Text style={[styles.personalMoveOptionFocus, { color: theme.muted }]}>{data.language === 'ar' ? day.focusAr : day.focus}</Text></View><Text style={[styles.personalMoveOptionArrow, { color: theme.primary }]}>›</Text></Pressable>)}</View></Card> : null}
      <View style={styles.personalSessionList}>
        {aliTrainingDays.map((day) => { const dayVideos = videos.filter((video) => video.sessionId === day.id); return <Card key={day.id} theme={theme} style={styles.personalSessionCard}><View style={styles.personalSessionHeading}><View style={[styles.personalSessionNumber, { backgroundColor: theme.primarySoft }]}><Text style={[styles.personalSessionNumberText, { color: theme.primary }]}>{day.id === 'abs' ? '◎' : day.title.replace('Day ', '')}</Text></View><View style={styles.flex}><Text style={[styles.personalSessionDay, { color: theme.muted }]}>{data.language === 'ar' ? day.titleAr : day.title}</Text><Text style={[styles.personalSessionFocus, { color: theme.text }]}>{data.language === 'ar' ? day.focusAr : day.focus}</Text></View><Text style={[styles.personalSessionCount, { color: theme.muted }]}>{dayVideos.length} {tr(data.language, 'videos', 'فيديو')}</Text></View><View style={styles.personalExerciseList}>{dayVideos.map((video, index) => { const selected = video.id === selectedVideo?.id; return <View key={video.id} style={[styles.personalExercise, { backgroundColor: selected ? theme.primarySoft : theme.surfaceAlt, borderColor: selected ? theme.primary : theme.line }]}><Pressable onPress={() => { setActiveId(video.id); void Haptics.selectionAsync() }} style={styles.personalExerciseMain}><View style={[styles.personalExerciseNumber, { backgroundColor: theme.surface }]}><Text style={[styles.personalExerciseNumberText, { color: selected ? theme.primary : theme.muted }]}>{index + 1}</Text></View><Text numberOfLines={1} style={[styles.personalExerciseTitle, { color: selected ? theme.primary : theme.text }]}>{video.title}</Text><Text style={[styles.personalExercisePlay, { color: theme.primary }]}>▶</Text></Pressable><Pressable onPress={() => setVideoToMove(video)} disabled={Boolean(movingId || deletingId)} style={[styles.personalMoveButton, { borderLeftColor: theme.line }]}>{movingId === video.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalMoveButtonText, { color: theme.primary }]}>⇄</Text>}</Pressable><Pressable onPress={() => confirmDelete(video)} disabled={Boolean(deletingId || movingId)} style={[styles.personalDeleteButton, { borderLeftColor: theme.line }]}>{deletingId === video.id ? <ActivityIndicator size="small" color="#bf4f4f" /> : <Text style={styles.personalDeleteText}>×</Text>}</Pressable></View> })}{!dayVideos.length ? <Text style={[styles.personalEmptyDay, { color: theme.muted, backgroundColor: theme.surfaceAlt }]}>{tr(data.language, 'No videos added yet.', 'لم تتم إضافة فيديوهات بعد.')}</Text> : null}</View><Pressable onPress={() => void pickVideos(day)} disabled={Boolean(uploadingDay)} style={[styles.personalUploadButton, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>{uploadingDay === day.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalUploadGlyph, { color: theme.primary }]}>＋</Text>}<Text style={[styles.personalUploadText, { color: theme.primary }]}>{uploadingDay === day.id ? tr(data.language, 'Uploading…', 'جارٍ الرفع…') : tr(data.language, 'Add videos', 'إضافة فيديوهات')}</Text></Pressable></Card> })}
      </View>
      <Card theme={theme} style={styles.workoutNote}><Text style={styles.workoutNoteGlyph}>💡</Text><Text style={[styles.workoutNoteText, { color: theme.muted }]}>{tr(data.language, 'Use the loads and repetitions prescribed by your coach. Stop if you feel pain or dizziness.', 'استخدم الأوزان والتكرارات التي حددها مدربك، وتوقف عند الألم أو الدوار.')}</Text></Card>
    </View>
  )
}

function WorkoutsPanel({ account, data, theme, onChangeData }: { account: UserAccount; data: AppData; theme: AppTheme; onChangeData: (next: AppData) => void }) {
  if (isAliSaadeAccount(account.username)) return <AliWorkoutsPanel data={data} theme={theme} />

  const plan = workoutPlans[data.sport]
  return <View style={styles.panel}><SectionHeader eyebrow={tr(data.language, 'MOVEMENT PLAN', 'خطة الحركة')} title={tr(data.language, 'Choose your activity', 'اختر نشاطك')} caption={tr(data.language, 'A practical weekly schedule matched to your preference.', 'جدول أسبوعي عملي يناسب تفضيلك.')} theme={theme} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRow}>{sportOptions.map((sport) => <Pressable key={sport.id} onPress={() => onChangeData({ ...data, sport: sport.id })} style={[styles.sportChip, { backgroundColor: data.sport === sport.id ? theme.primary : theme.surface, borderColor: data.sport === sport.id ? theme.primary : theme.line }]}><Text style={styles.sportGlyph}>{sport.glyph}</Text><Text style={[styles.sportLabel, { color: data.sport === sport.id ? '#fff' : theme.text }]}>{data.language === 'ar' ? sport.label : sport.labelEn}</Text></Pressable>)}</ScrollView><View style={styles.workoutList}>{plan.map((workout, index) => <Card key={`${workout.day}-${index}`} theme={theme} style={styles.workoutCard}><View style={[styles.workoutIndex, { backgroundColor: theme.primarySoft }]}><Text style={[styles.workoutIndexText, { color: theme.primary }]}>{index + 1}</Text></View><View style={styles.flex}><Text style={[styles.workoutDay, { color: theme.primary }]}>{workout.day}</Text><Text style={[styles.workoutTitle, { color: theme.text }]}>{workout.title}</Text><Text style={[styles.workoutDetail, { color: theme.muted }]}>{workout.detail}</Text></View><Text style={[styles.workoutArrow, { color: theme.muted }]}>›</Text></Card>)}</View><Card theme={theme} style={styles.workoutNote}><Text style={styles.workoutNoteGlyph}>💡</Text><Text style={[styles.workoutNoteText, { color: theme.muted }]}>{tr(data.language, 'Leave at least two hours between a full meal and training. Adjust intensity if you feel pain or dizziness.', 'اترك ساعتين على الأقل بين الوجبة الكاملة والتمرين، وخفف الشدة عند الألم أو الدوار.')}</Text></Card></View>
}

function ScannerPanel({ data, theme, onChangeData }: { data: AppData; theme: AppTheme; onChangeData: (next: AppData) => void }) {
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

function SettingsPanel({ account, data, theme, onChangeAccount, onChangeData, onReplacePlan, onLogout }: { account: UserAccount; data: AppData; theme: AppTheme; onChangeAccount: (next: UserAccount) => void; onChangeData: (next: AppData) => void; onReplacePlan: () => void; onLogout: () => void }) {
  const languages: Array<{ id: Language; label: string }> = [{ id: 'en', label: 'English' }, { id: 'ar', label: 'العربية' }, { id: 'fr', label: 'Français' }]
  const themes: Array<{ id: ThemeMode; label: string; glyph: string }> = [{ id: 'light', label: 'Light', glyph: '☀' }, { id: 'dark', label: 'Dark', glyph: '☾' }, { id: 'system', label: 'System', glyph: '◐' }]
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState('')
  async function connectRecoveryEmail() {
    setEmailBusy(true)
    setEmailStatus('')
    try {
      onChangeAccount(await addRecoveryEmail(account.id, recoveryEmail))
      setEmailStatus('Recovery email connected. You can now request a reset code from the sign-in screen.')
    } catch (caught) {
      setEmailStatus(caught instanceof Error ? caught.message : 'Could not connect this recovery email.')
    } finally {
      setEmailBusy(false)
    }
  }
  return <View style={styles.panel}><SectionHeader eyebrow={tr(data.language, 'ACCOUNT', 'الحساب')} title={tr(data.language, 'Settings', 'الإعدادات')} caption={tr(data.language, 'Your preferences are saved automatically on this device.', 'يتم حفظ تفضيلاتك تلقائياً على هذا الجهاز.')} theme={theme} /><Card theme={theme} style={styles.accountCard}><View style={[styles.accountAvatar, { backgroundColor: theme.primarySoft }]}><Text style={[styles.accountAvatarText, { color: theme.primary }]}>{account.displayName[0]?.toUpperCase()}</Text></View><View style={styles.flex}><Text style={[styles.accountName, { color: theme.text }]}>{account.displayName}</Text><Text style={[styles.accountUsername, { color: theme.muted }]}>@{account.username}</Text>{account.email ? <Text style={[styles.accountEmail, { color: theme.muted }]}>{account.email}</Text> : null}</View><View style={[styles.secureBadge, { backgroundColor: theme.primarySoft }]}><Text style={[styles.secureBadgeText, { color: theme.primary }]}>{account.email ? 'EMAIL ON' : 'CODE ONLY'}</Text></View></Card>{!account.email ? <Card theme={theme} style={styles.emailRecoveryCard}><FormField label={tr(data.language, 'Recovery email', 'بريد الاسترداد')} value={recoveryEmail} onChangeText={setRecoveryEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" theme={theme} /><PrimaryButton label={tr(data.language, 'Enable email recovery', 'تفعيل الاسترداد بالبريد')} onPress={() => void connectRecoveryEmail()} busy={emailBusy} theme={theme} />{emailStatus ? <Text style={[styles.emailStatus, { color: theme.muted }]}>{emailStatus}</Text> : null}</Card> : null}<SectionHeader eyebrow={tr(data.language, 'DIET PLAN', 'الخطة الغذائية')} title={data.dietPlan ? tr(data.language, 'PDF plan connected', 'ملف PDF متصل') : tr(data.language, 'Standard catalogue', 'الكتالوج القياسي')} theme={theme} /><Card theme={theme} style={styles.planCard}><View style={styles.planFileIcon}><Text style={styles.planFileText}>PDF</Text></View><View style={styles.flex}><Text numberOfLines={1} style={[styles.planFileName, { color: theme.text }]}>{data.dietPlan?.fileName ?? tr(data.language, 'No PDF uploaded', 'لم يتم رفع ملف')}</Text><Text style={[styles.planFileMeta, { color: theme.muted }]}>{data.dietPlan ? `${data.dietPlan.dailyCalories} kcal · ${new Date(data.dietPlan.uploadedAt).toLocaleDateString()}` : tr(data.language, 'Upload your dietitian’s plan any time.', 'ارفع خطة اختصاصي التغذية في أي وقت.')}</Text></View></Card><SecondaryButton label={data.dietPlan ? tr(data.language, 'Replace PDF plan', 'استبدال ملف PDF') : tr(data.language, 'Upload PDF plan', 'رفع ملف PDF')} onPress={onReplacePlan} theme={theme} /><SectionHeader eyebrow={tr(data.language, 'LANGUAGE', 'اللغة')} title={tr(data.language, 'Interface language', 'لغة الواجهة')} theme={theme} /><View style={styles.settingChoiceRow}>{languages.map((item) => <Pressable key={item.id} onPress={() => onChangeData({ ...data, language: item.id })} style={[styles.settingChoice, { backgroundColor: data.language === item.id ? theme.primary : theme.surface, borderColor: data.language === item.id ? theme.primary : theme.line }]}><Text style={{ color: data.language === item.id ? '#fff' : theme.text, fontSize: 11, fontWeight: '900' }}>{item.label}</Text></Pressable>)}</View><SectionHeader eyebrow={tr(data.language, 'APPEARANCE', 'المظهر')} title={tr(data.language, 'Choose a theme', 'اختر السمة')} theme={theme} /><View style={styles.settingChoiceRow}>{themes.map((item) => <Pressable key={item.id} onPress={() => onChangeData({ ...data, theme: item.id })} style={[styles.themeChoice, { backgroundColor: data.theme === item.id ? theme.primarySoft : theme.surface, borderColor: data.theme === item.id ? theme.primary : theme.line }]}><Text style={[styles.themeGlyph, { color: data.theme === item.id ? theme.primary : theme.muted }]}>{item.glyph}</Text><Text style={{ color: theme.text, fontSize: 10, fontWeight: '800' }}>{item.label}</Text></Pressable>)}</View><Card theme={theme} style={styles.securityCard}><Text style={styles.securityIcon}>⌾</Text><View style={styles.flex}><Text style={[styles.securityTitle, { color: theme.text }]}>{tr(data.language, 'Password and recovery', 'كلمة المرور والاسترداد')}</Text><Text style={[styles.securityBody, { color: theme.muted }]}>{tr(data.language, account.email ? 'Use a 15-minute email code or your offline recovery code. Passwords remain hashed in platform-secured storage.' : 'This older account uses its offline recovery code. Passwords remain hashed in platform-secured storage.', 'استخدم رمز البريد المؤقت أو رمز الاسترداد المحفوظ. تبقى كلمة المرور مشفرة في مخزن النظام الآمن.')}</Text></View></Card><SecondaryButton label={tr(data.language, 'Sign out', 'تسجيل الخروج')} onPress={() => Alert.alert(tr(data.language, 'Sign out?', 'تسجيل الخروج؟'), tr(data.language, 'Your account data stays on this device.', 'ستبقى بيانات حسابك على هذا الجهاز.'), [{ text: tr(data.language, 'Cancel', 'إلغاء'), style: 'cancel' }, { text: tr(data.language, 'Sign out', 'خروج'), style: 'destructive', onPress: onLogout }])} danger theme={theme} /></View>
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
  sectionTabs: { gap: 8 },
  sectionTab: { minWidth: 96, minHeight: 66, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sectionGlyph: { fontSize: 18, fontWeight: '900' },
  sectionLabel: { fontSize: 10, fontWeight: '900' },
  habitProgress: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  habitRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  habitRingValue: { fontSize: 22, fontWeight: '900' },
  habitRingUnit: { fontSize: 9, fontWeight: '700' },
  habitProgressTitle: { fontSize: 16, fontWeight: '900' },
  habitProgressBody: { marginTop: 4, fontSize: 11, lineHeight: 17 },
  habitList: { gap: 9 },
  habitItem: { minHeight: 68, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitGlyph: { width: 36, fontSize: 23, textAlign: 'center' },
  habitText: { flex: 1, fontSize: 13, fontWeight: '800' },
  check: { width: 29, height: 29, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  sportRow: { gap: 8 },
  sportChip: { minWidth: 88, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 17, borderWidth: 1, alignItems: 'center', gap: 4 },
  sportGlyph: { fontSize: 22 },
  sportLabel: { fontSize: 9, fontWeight: '800' },
  workoutList: { gap: 9 },
  workoutCard: { minHeight: 90, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  workoutIndex: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  workoutIndexText: { fontSize: 17, fontWeight: '900' },
  workoutDay: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  workoutTitle: { marginTop: 2, fontSize: 14, fontWeight: '900' },
  workoutDetail: { marginTop: 3, fontSize: 10 },
  workoutArrow: { fontSize: 24 },
  workoutNote: { flexDirection: 'row', gap: 11, backgroundColor: '#fff8e8', borderColor: '#f0deb7' },
  workoutNoteGlyph: { fontSize: 22 },
  workoutNoteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  personalVideoCard: { position: 'relative', padding: 12, gap: 12 },
  personalVideoHeading: { paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personalVideoDay: { fontSize: 11, fontWeight: '900' },
  personalVideoTitle: { marginTop: 2, fontSize: 16, fontWeight: '900' },
  assignedBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  assignedBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  personalVideo: { width: '100%', height: 470, borderRadius: 16, backgroundColor: '#0d1512' },
  personalPlayerLoading: { position: 'absolute', left: 24, right: 24, bottom: 24, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: 'rgba(8,18,15,.78)' },
  personalPlayerLoadingText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  personalEmptyPlayer: { minHeight: 230, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 20 },
  personalEmptyGlyph: { color: palette.green700, fontSize: 36, fontWeight: '500' },
  personalEmptyTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  personalEmptyBody: { fontSize: 10, textAlign: 'center' },
  personalErrorCard: { paddingVertical: 12, borderColor: '#e5b9b6', backgroundColor: '#fff3f2' },
  personalErrorText: { color: '#a64e48', fontSize: 10, lineHeight: 16, fontWeight: '700' },
  personalMoveCard: { padding: 14, gap: 12 },
  personalMoveHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  personalMoveEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  personalMoveTitle: { marginTop: 3, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  personalMovePrompt: { fontSize: 11, lineHeight: 16 },
  personalMoveClose: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  personalMoveCloseText: { fontSize: 23, lineHeight: 25, fontWeight: '500' },
  personalMoveOptions: { gap: 7 },
  personalMoveOption: { minHeight: 56, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  personalMoveOptionGlyph: { width: 24, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  personalMoveOptionDay: { fontSize: 12, fontWeight: '900' },
  personalMoveOptionFocus: { marginTop: 2, fontSize: 10 },
  personalMoveOptionArrow: { fontSize: 24, fontWeight: '500' },
  personalSessionList: { gap: 11 },
  personalSessionCard: { padding: 14, gap: 12 },
  personalSessionHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  personalSessionNumber: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  personalSessionNumberText: { fontSize: 16, fontWeight: '900' },
  personalSessionDay: { fontSize: 11, fontWeight: '800' },
  personalSessionFocus: { marginTop: 2, fontSize: 14, fontWeight: '900' },
  personalSessionCount: { fontSize: 10, fontWeight: '700' },
  personalExerciseList: { gap: 7 },
  personalExercise: { minHeight: 48, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderWidth: 1, borderRadius: 13 },
  personalExerciseMain: { minWidth: 0, flex: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  personalExerciseNumber: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  personalExerciseNumberText: { fontSize: 11, fontWeight: '900' },
  personalExerciseTitle: { flex: 1, fontSize: 12, fontWeight: '800' },
  personalExercisePlay: { fontSize: 13 },
  personalMoveButton: { width: 44, borderLeftWidth: 1, alignItems: 'center', justifyContent: 'center' },
  personalMoveButtonText: { fontSize: 19, fontWeight: '800' },
  personalDeleteButton: { width: 44, borderLeftWidth: 1, alignItems: 'center', justifyContent: 'center' },
  personalDeleteText: { color: '#bf4f4f', fontSize: 25, lineHeight: 27, fontWeight: '500' },
  personalEmptyDay: { padding: 12, borderRadius: 12, fontSize: 10, textAlign: 'center' },
  personalUploadButton: { minHeight: 44, borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  personalUploadGlyph: { fontSize: 20, fontWeight: '700' },
  personalUploadText: { fontSize: 11, fontWeight: '900' },
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
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountAvatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 20, fontWeight: '900' },
  accountName: { fontSize: 15, fontWeight: '900' },
  accountUsername: { marginTop: 2, fontSize: 10 },
  accountEmail: { marginTop: 2, fontSize: 10 },
  emailRecoveryCard: { gap: 12 },
  emailStatus: { fontSize: 11, lineHeight: 17 },
  secureBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  secureBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planFileIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: palette.green100, alignItems: 'center', justifyContent: 'center' },
  planFileText: { color: palette.green800, fontSize: 10, fontWeight: '900' },
  planFileName: { fontSize: 13, fontWeight: '900' },
  planFileMeta: { marginTop: 3, fontSize: 9 },
  settingChoiceRow: { flexDirection: 'row', gap: 8 },
  settingChoice: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeChoice: { flex: 1, minHeight: 70, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  themeGlyph: { fontSize: 22 },
  securityCard: { flexDirection: 'row', gap: 12 },
  securityIcon: { color: palette.green700, fontSize: 23 },
  securityTitle: { fontSize: 13, fontWeight: '900' },
  securityBody: { marginTop: 4, fontSize: 10, lineHeight: 16 },
})
