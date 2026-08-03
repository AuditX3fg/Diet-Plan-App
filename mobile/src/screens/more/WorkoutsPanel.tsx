import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video'
import { aliTrainingDays, hasAssignedTrainingLibrary, type TrainingDayDefinition } from '../../aliTraining'
import { sportOptions, workoutPlans } from '../../data'
import type { AppTheme } from '../../theme'
import { palette } from '../../theme'
import type { AppData, UserAccount } from '../../types'
import { Card, PrimaryButton, SecondaryButton, SectionHeader } from '../../components/ui'
import { tr } from '../../i18n'
import {
  cloudTrainingVideoSource,
  deleteCloudTrainingVideo,
  listCloudTrainingVideos,
  moveCloudTrainingVideo,
  updateCloudWorkoutPreference,
  uploadCloudTrainingVideo,
  type CloudTrainingVideo,
} from '../../services/cloud'

interface WorkoutsPanelProps {
  account: UserAccount
  data: AppData
  theme: AppTheme
  onChangeAccount: (next: UserAccount) => void
  onChangeData: (next: AppData) => void
}

interface PersonalWorkoutsPanelProps {
  data: AppData
  theme: AppTheme
  onUseDefault: () => Promise<boolean>
  onUseOwnLibrary: () => Promise<boolean>
}

function PersonalWorkoutsPanel({ data, theme, onUseDefault, onUseOwnLibrary }: PersonalWorkoutsPanelProps) {
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
  const [editable, setEditable] = useState(true)
  const [switchingLibrary, setSwitchingLibrary] = useState(false)
  const selectedVideo = videos.find((video) => video.id === activeId) ?? videos[0]
  const selectedDay = aliTrainingDays.find((day) => day.id === selectedVideo?.sessionId)
  const player = useVideoPlayer(null)

  async function refreshVideos(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const result = await listCloudTrainingVideos()
      setVideos(result.videos)
      setEditable(result.editable)
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
    if (!editable) return
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
    if (!editable) return
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
    if (!editable || !videoToMove || destination.id === videoToMove.sessionId) return
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

  async function startOwnLibrary() {
    setSwitchingLibrary(true)
    setError('')
    try {
      if (await onUseOwnLibrary()) await refreshVideos()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start your private library.')
    } finally {
      setSwitchingLibrary(false)
    }
  }

  return (
    <View style={styles.panel}>
      <SectionHeader eyebrow={editable ? tr(data.language, 'PRIVATE CLOUD LIBRARY', 'مكتبة سحابية خاصة') : tr(data.language, 'ASSIGNED PROGRAM', 'برنامج مخصص لك')} title={tr(data.language, 'Your training sessions', 'جلساتك التدريبية')} caption={editable ? tr(data.language, 'Upload, move, or delete videos for each day. Changes appear on every device signed into your account.', 'ارفع أو انقل أو احذف فيديوهات كل يوم. تظهر التغييرات على كل جهاز مسجل بحسابك.') : tr(data.language, 'Your coach’s program is shared read-only on every device. Your changes cannot affect the source library.', 'برنامج مدربك مشترك للعرض فقط على كل جهاز، ولن تؤثر تغييراتك على مكتبة المصدر.')} theme={theme} />
      <Card theme={theme} style={styles.workoutModeCard}><Text style={[styles.workoutModeLabel, { color: theme.text }]}>{tr(data.language, 'Workout source', 'مصدر التمرين')}</Text><SecondaryButton label={tr(data.language, 'Use default plan', 'استخدام الخطة الافتراضية')} onPress={() => void onUseDefault()} theme={theme} />{!editable ? <PrimaryButton label={switchingLibrary ? tr(data.language, 'Preparing…', 'جارٍ التجهيز…') : tr(data.language, 'Create my own library', 'إنشاء مكتبتي الخاصة')} onPress={() => void startOwnLibrary()} busy={switchingLibrary} theme={theme} /> : null}</Card>
      <Card theme={theme} style={styles.personalVideoCard}>
        {selectedVideo ? <><View style={styles.personalVideoHeading}><View style={styles.flex}><Text style={[styles.personalVideoDay, { color: theme.primary }]}>{selectedDay ? (data.language === 'ar' ? selectedDay.titleAr : selectedDay.title) : ''}</Text><Text style={[styles.personalVideoTitle, { color: theme.text }]}>{selectedVideo.title}</Text></View><View style={[styles.assignedBadge, { backgroundColor: theme.primarySoft }]}><Text style={[styles.assignedBadgeText, { color: theme.primary }]}>{tr(data.language, 'SYNCED', 'متزامن')}</Text></View></View><VideoView player={player} style={styles.personalVideo} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />{playerLoading ? <View style={styles.personalPlayerLoading}><ActivityIndicator color="#fff" /><Text style={styles.personalPlayerLoadingText}>{tr(data.language, 'Loading private video…', 'جارٍ تحميل الفيديو الخاص…')}</Text></View> : null}</> : <View style={[styles.personalEmptyPlayer, { backgroundColor: theme.surfaceAlt }]}><Text style={styles.personalEmptyGlyph}>↥</Text><Text style={[styles.personalEmptyTitle, { color: theme.text }]}>{loading ? tr(data.language, 'Loading your library…', 'جارٍ تحميل المكتبة…') : tr(data.language, 'Upload your first video', 'ارفع أول فيديو')}</Text><Text style={[styles.personalEmptyBody, { color: theme.muted }]}>{tr(data.language, 'MP4, MOV, or WebM · up to 100 MB', 'MP4 أو MOV أو WebM · حتى ١٠٠ ميغابايت')}</Text></View>}
      </Card>
      {error ? <Card theme={theme} style={styles.personalErrorCard}><Text style={styles.personalErrorText}>{error}</Text></Card> : null}
      {videoToMove ? <Card theme={theme} style={styles.personalMoveCard}><View style={styles.personalMoveHeading}><View style={styles.flex}><Text style={[styles.personalMoveEyebrow, { color: theme.primary }]}>{tr(data.language, 'MOVE VIDEO', 'نقل الفيديو')}</Text><Text numberOfLines={2} style={[styles.personalMoveTitle, { color: theme.text }]}>{videoToMove.title}</Text></View><Pressable onPress={() => setVideoToMove(null)} disabled={Boolean(movingId)} style={[styles.personalMoveClose, { borderColor: theme.line }]}><Text style={[styles.personalMoveCloseText, { color: theme.muted }]}>×</Text></Pressable></View><Text style={[styles.personalMovePrompt, { color: theme.muted }]}>{tr(data.language, 'Choose the destination training category:', 'اختر فئة التدريب الجديدة:')}</Text><View style={styles.personalMoveOptions}>{aliTrainingDays.filter((day) => day.id !== videoToMove.sessionId).map((day) => <Pressable key={day.id} onPress={() => void moveVideoTo(day)} disabled={Boolean(movingId)} style={[styles.personalMoveOption, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>{movingDestinationId === day.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalMoveOptionGlyph, { color: theme.primary }]}>⇄</Text>}<View style={styles.flex}><Text style={[styles.personalMoveOptionDay, { color: theme.text }]}>{data.language === 'ar' ? day.titleAr : day.title}</Text><Text style={[styles.personalMoveOptionFocus, { color: theme.muted }]}>{data.language === 'ar' ? day.focusAr : day.focus}</Text></View><Text style={[styles.personalMoveOptionArrow, { color: theme.primary }]}>›</Text></Pressable>)}</View></Card> : null}
      <View style={styles.personalSessionList}>
        {aliTrainingDays.map((day) => {
          const dayVideos = videos.filter((video) => video.sessionId === day.id)
          return <Card key={day.id} theme={theme} style={styles.personalSessionCard}>
            <View style={styles.personalSessionHeading}><View style={[styles.personalSessionNumber, { backgroundColor: theme.primarySoft }]}><Text style={[styles.personalSessionNumberText, { color: theme.primary }]}>{day.id === 'abs' ? '◎' : day.title.replace('Day ', '')}</Text></View><View style={styles.flex}><Text style={[styles.personalSessionDay, { color: theme.muted }]}>{data.language === 'ar' ? day.titleAr : day.title}</Text><Text style={[styles.personalSessionFocus, { color: theme.text }]}>{data.language === 'ar' ? day.focusAr : day.focus}</Text></View><Text style={[styles.personalSessionCount, { color: theme.muted }]}>{dayVideos.length} {tr(data.language, 'videos', 'فيديو')}</Text></View>
            <View style={styles.personalExerciseList}>{dayVideos.map((video, index) => {
              const selected = video.id === selectedVideo?.id
              return <View key={video.id} style={[styles.personalExercise, { backgroundColor: selected ? theme.primarySoft : theme.surfaceAlt, borderColor: selected ? theme.primary : theme.line }]}>
                <Pressable onPress={() => { setActiveId(video.id); void Haptics.selectionAsync() }} style={styles.personalExerciseMain}><View style={[styles.personalExerciseNumber, { backgroundColor: theme.surface }]}><Text style={[styles.personalExerciseNumberText, { color: selected ? theme.primary : theme.muted }]}>{index + 1}</Text></View><Text numberOfLines={1} style={[styles.personalExerciseTitle, { color: selected ? theme.primary : theme.text }]}>{video.title}</Text><Text style={[styles.personalExercisePlay, { color: theme.primary }]}>▶</Text></Pressable>
                {editable ? <><Pressable onPress={() => setVideoToMove(video)} disabled={Boolean(movingId || deletingId)} style={[styles.personalMoveButton, { borderLeftColor: theme.line }]}>{movingId === video.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalMoveButtonText, { color: theme.primary }]}>⇄</Text>}</Pressable><Pressable onPress={() => confirmDelete(video)} disabled={Boolean(deletingId || movingId)} style={[styles.personalDeleteButton, { borderLeftColor: theme.line }]}>{deletingId === video.id ? <ActivityIndicator size="small" color="#bf4f4f" /> : <Text style={styles.personalDeleteText}>×</Text>}</Pressable></> : null}
              </View>
            })}{!dayVideos.length ? <Text style={[styles.personalEmptyDay, { color: theme.muted, backgroundColor: theme.surfaceAlt }]}>{tr(data.language, 'No videos added yet.', 'لم تتم إضافة فيديوهات بعد.')}</Text> : null}</View>
            {editable ? <Pressable onPress={() => void pickVideos(day)} disabled={Boolean(uploadingDay)} style={[styles.personalUploadButton, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>{uploadingDay === day.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.personalUploadGlyph, { color: theme.primary }]}>＋</Text>}<Text style={[styles.personalUploadText, { color: theme.primary }]}>{uploadingDay === day.id ? tr(data.language, 'Uploading…', 'جارٍ الرفع…') : tr(data.language, 'Add videos', 'إضافة فيديوهات')}</Text></Pressable> : null}
          </Card>
        })}
      </View>
      <Card theme={theme} style={styles.workoutNote}><Text style={styles.workoutNoteGlyph}>💡</Text><Text style={[styles.workoutNoteText, { color: theme.muted }]}>{tr(data.language, 'Use the loads and repetitions prescribed by your coach. Stop if you feel pain or dizziness.', 'استخدم الأوزان والتكرارات التي حددها مدربك، وتوقف عند الألم أو الدوار.')}</Text></Card>
    </View>
  )
}

export function WorkoutsPanel({ account, data, theme, onChangeAccount, onChangeData }: WorkoutsPanelProps) {
  const [modeBusy, setModeBusy] = useState(false)
  const [modeError, setModeError] = useState('')
  const workoutMode = account.workoutMode ?? (hasAssignedTrainingLibrary(account.username) ? 'custom' : 'default')

  async function chooseWorkoutMode(mode: 'default' | 'custom') {
    setModeBusy(true)
    setModeError('')
    try {
      const result = await updateCloudWorkoutPreference(mode)
      onChangeAccount({ ...account, ...result.account })
      return true
    } catch (caught) {
      setModeError(caught instanceof Error ? caught.message : 'Could not save your workout choice.')
      return false
    } finally {
      setModeBusy(false)
    }
  }

  if (workoutMode === 'unselected') return <View style={styles.panel}><Card theme={theme} style={styles.workoutChoiceCard}><Text style={[styles.workoutChoiceEyebrow, { color: theme.primary }]}>{tr(data.language, 'WORKOUT SETUP', 'إعداد التمرين')}</Text><Text style={[styles.workoutChoiceTitle, { color: theme.text }]}>{tr(data.language, 'How would you like to train?', 'كيف تريد أن تتدرب؟')}</Text><Text style={[styles.workoutChoiceBody, { color: theme.muted }]}>{tr(data.language, 'Choose Tawazon’s ready-made plan, or create a private library and upload your coach’s videos.', 'اختر خطة توازن الجاهزة أو أنشئ مكتبة خاصة وارفع فيديوهات مدربك.')}</Text><View style={styles.workoutChoiceOptions}><Pressable disabled={modeBusy} onPress={() => void chooseWorkoutMode('default')} style={[styles.workoutChoiceOption, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={styles.workoutChoiceGlyph}>✨</Text><View style={styles.flex}><Text style={[styles.workoutChoiceOptionTitle, { color: theme.text }]}>{tr(data.language, 'Default workout', 'الخطة الافتراضية')}</Text><Text style={[styles.workoutChoiceOptionBody, { color: theme.muted }]}>{tr(data.language, 'A ready weekly program matched to your activity.', 'برنامج أسبوعي جاهز يناسب نشاطك.')}</Text></View><Text style={[styles.workoutChoiceArrow, { color: theme.primary }]}>›</Text></Pressable><Pressable disabled={modeBusy} onPress={() => void chooseWorkoutMode('custom')} style={[styles.workoutChoiceOption, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={styles.workoutChoiceGlyph}>↥</Text><View style={styles.flex}><Text style={[styles.workoutChoiceOptionTitle, { color: theme.text }]}>{tr(data.language, 'Upload my workout', 'رفع برنامجي')}</Text><Text style={[styles.workoutChoiceOptionBody, { color: theme.muted }]}>{tr(data.language, 'Private videos saved to your account on every device.', 'فيديوهات خاصة محفوظة في حسابك على كل جهاز.')}</Text></View><Text style={[styles.workoutChoiceArrow, { color: theme.primary }]}>›</Text></Pressable></View>{modeBusy ? <ActivityIndicator color={theme.primary} /> : null}{modeError ? <Text style={styles.personalErrorText}>{modeError}</Text> : null}</Card></View>

  if (workoutMode === 'custom') return <PersonalWorkoutsPanel data={data} theme={theme} onUseDefault={() => chooseWorkoutMode('default')} onUseOwnLibrary={() => chooseWorkoutMode('custom')} />

  const plan = workoutPlans[data.sport]
  return <View style={styles.panel}><SectionHeader eyebrow={tr(data.language, 'MOVEMENT PLAN', 'خطة الحركة')} title={tr(data.language, 'Choose your activity', 'اختر نشاطك')} caption={tr(data.language, 'A practical weekly schedule matched to your preference.', 'جدول أسبوعي عملي يناسب تفضيلك.')} theme={theme} /><Card theme={theme} style={styles.workoutModeCard}><Text style={[styles.workoutModeLabel, { color: theme.text }]}>{tr(data.language, 'Prefer your own program?', 'تريد برنامجك الخاص؟')}</Text><SecondaryButton label={tr(data.language, 'Upload workout videos', 'رفع فيديوهات التمرين')} onPress={() => void chooseWorkoutMode('custom')} disabled={modeBusy} theme={theme} />{modeError ? <Text style={styles.personalErrorText}>{modeError}</Text> : null}</Card><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRow}>{sportOptions.map((sport) => <Pressable key={sport.id} onPress={() => onChangeData({ ...data, sport: sport.id })} style={[styles.sportChip, { backgroundColor: data.sport === sport.id ? theme.primary : theme.surface, borderColor: data.sport === sport.id ? theme.primary : theme.line }]}><Text style={styles.sportGlyph}>{sport.glyph}</Text><Text style={[styles.sportLabel, { color: data.sport === sport.id ? '#fff' : theme.text }]}>{data.language === 'ar' ? sport.label : sport.labelEn}</Text></Pressable>)}</ScrollView><View style={styles.workoutList}>{plan.map((workout, index) => <Card key={`${workout.day}-${index}`} theme={theme} style={styles.workoutCard}><View style={[styles.workoutIndex, { backgroundColor: theme.primarySoft }]}><Text style={[styles.workoutIndexText, { color: theme.primary }]}>{index + 1}</Text></View><View style={styles.flex}><Text style={[styles.workoutDay, { color: theme.primary }]}>{workout.day}</Text><Text style={[styles.workoutTitle, { color: theme.text }]}>{workout.title}</Text><Text style={[styles.workoutDetail, { color: theme.muted }]}>{workout.detail}</Text></View><Text style={[styles.workoutArrow, { color: theme.muted }]}>›</Text></Card>)}</View><Card theme={theme} style={styles.workoutNote}><Text style={styles.workoutNoteGlyph}>💡</Text><Text style={[styles.workoutNoteText, { color: theme.muted }]}>{tr(data.language, 'Leave at least two hours between a full meal and training. Adjust intensity if you feel pain or dizziness.', 'اترك ساعتين على الأقل بين الوجبة الكاملة والتمرين، وخفف الشدة عند الألم أو الدوار.')}</Text></Card></View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: 17 },
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
  workoutModeCard: { gap: 10 },
  workoutModeLabel: { fontSize: 13, fontWeight: '900' },
  workoutChoiceCard: { padding: 18, gap: 13 },
  workoutChoiceEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  workoutChoiceTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  workoutChoiceBody: { fontSize: 12, lineHeight: 19 },
  workoutChoiceOptions: { gap: 9 },
  workoutChoiceOption: { minHeight: 86, padding: 13, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  workoutChoiceGlyph: { width: 30, fontSize: 23, textAlign: 'center' },
  workoutChoiceOptionTitle: { fontSize: 14, fontWeight: '900' },
  workoutChoiceOptionBody: { marginTop: 3, fontSize: 10, lineHeight: 15 },
  workoutChoiceArrow: { fontSize: 27, fontWeight: '500' },
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
})
