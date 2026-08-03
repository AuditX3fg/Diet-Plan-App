import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowRightLeft, Cloud, Dumbbell, ExternalLink, HeartPulse, LoaderCircle, PlayCircle, ShieldCheck, Sparkles, Timer, Trash2, TrendingUp, Upload, X } from 'lucide-react'
import { aliTrainingDays, hasAssignedTrainingLibrary, type TrainingDayDefinition } from '../aliTraining'
import { sportOptions } from '../data'
import { tr } from '../i18n'
import { createCloudTrainingVideoUrl, deleteCloudTrainingVideo, listCloudTrainingVideos, moveCloudTrainingVideo, updateCloudWorkoutPreference, uploadCloudTrainingVideo, type CloudTrainingVideo } from '../services/cloud'
import type { SportPreference, UserAccount, UserProfile } from '../types'
import { calculateHealthMetrics, toArabicNumber } from '../utils'

interface WorkoutsPageProps {
  account: UserAccount
  profile: UserProfile
  preference: SportPreference
  onPreferenceChange: (preference: SportPreference) => void
  onAccountChange: (account: UserAccount) => void
}

const sportSessions: Record<SportPreference, string[][]> = {
  gym: [['سكوات — ٤ × ١٠', 'ضغط صدر — ٤ × ١٠', 'سحب أرضي — ٣ × ١٢'], ['مشي سريع — ٣٠ دقيقة', 'تمارين بطن — ٣ جولات'], ['رفعة رومانية — ٤ × ٨', 'ضغط كتف — ٣ × ١٠', 'سحب علوي — ٣ × ١٢'], ['دراجة — ٢٠ دقيقة', 'تمدد كامل — ١٠ دقائق']],
  home: [['سكوات وزن الجسم — ٤ × ١٥', 'ضغط — ٤ × ٨', 'بلانك — ٣ × ٣٠ ثانية'], ['اندفاع — ٣ × ١٢', 'جسر الورك — ٤ × ١٥'], ['متسلق الجبل — ٤ × ٢٠', 'ضغط كتف بايك — ٣ × ٨'], ['دائرة جسم كامل — ٤ جولات']],
  run: [['جري سهل — ٢٥ دقيقة'], ['تبادل سريع/هادئ — ٨ جولات'], ['جري تعافي — ٢٠ دقيقة'], ['جري طويل — ٤٥ دقيقة']],
  bike: [['دراجة هادئة — ٣٥ دقيقة'], ['فترات سرعة — ١٠ × دقيقة'], ['دراجة تعافي — ٢٥ دقيقة'], ['جولة طويلة — ٦٠ دقيقة']],
  swim: [['سباحة سهلة — ٣٠ دقيقة'], ['٨ × ٥٠م بوتيرة متوسطة'], ['تقنية وتنفس — ٢٥ دقيقة'], ['سباحة مستمرة — ٤٠ دقيقة']],
  walk: [['مشي نشط — ٣٥ دقيقة'], ['٦٠٠٠ خطوة خلال اليوم'], ['مشي مرتفع — ٣٠ دقيقة'], ['مشي طويل — ٦٠ دقيقة']],
  yoga: [['تدفق مبتدئ — ٣٠ دقيقة'], ['مرونة الورك والظهر — ٢٥ دقيقة'], ['يوغا قوة — ٣٥ دقيقة'], ['استشفاء وتنفس — ٢٠ دقيقة']],
  football: [['مهارات وتمرير — ٤٥ دقيقة'], ['سرعات قصيرة — ١٠ جولات'], ['لعب خفيف — ٤٥ دقيقة'], ['مباراة أو تدريب — ٦٠ دقيقة']],
}

const englishSportSessions: Record<SportPreference, string[][]> = {
  gym: [['Squat — 4 × 10', 'Bench press — 4 × 10', 'Seated row — 3 × 12'], ['Brisk walk — 30 minutes', 'Core training — 3 rounds'], ['Romanian deadlift — 4 × 8', 'Shoulder press — 3 × 10', 'Lat pulldown — 3 × 12'], ['Cycling — 20 minutes', 'Full-body stretch — 10 minutes']],
  home: [['Bodyweight squat — 4 × 15', 'Push-ups — 4 × 8', 'Plank — 3 × 30 seconds'], ['Lunges — 3 × 12', 'Glute bridge — 4 × 15'], ['Mountain climbers — 4 × 20', 'Pike push-ups — 3 × 8'], ['Full-body circuit — 4 rounds']],
  run: [['Easy run — 25 minutes'], ['Fast/slow intervals — 8 rounds'], ['Recovery run — 20 minutes'], ['Long run — 45 minutes']],
  bike: [['Easy ride — 35 minutes'], ['Speed intervals — 10 × 1 minute'], ['Recovery ride — 25 minutes'], ['Long ride — 60 minutes']],
  swim: [['Easy swim — 30 minutes'], ['8 × 50 m at moderate pace'], ['Technique and breathing — 25 minutes'], ['Continuous swim — 40 minutes']],
  walk: [['Brisk walk — 35 minutes'], ['6,000 steps throughout the day'], ['Incline walk — 30 minutes'], ['Long walk — 60 minutes']],
  yoga: [['Beginner flow — 30 minutes'], ['Hip and back mobility — 25 minutes'], ['Power yoga — 35 minutes'], ['Recovery and breathing — 20 minutes']],
  football: [['Skills and passing — 45 minutes'], ['Short sprints — 10 rounds'], ['Light play — 45 minutes'], ['Match or training — 60 minutes']],
}

function PersonalTrainingPlan({ onUseDefault, onUseOwnLibrary }: { onUseDefault: () => Promise<boolean>; onUseOwnLibrary: () => Promise<boolean> }) {
  const [videos, setVideos] = useState<CloudTrainingVideo[]>([])
  const [activeId, setActiveId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [uploadingDay, setUploadingDay] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [movingId, setMovingId] = useState('')
  const [videoToMove, setVideoToMove] = useState<CloudTrainingVideo | null>(null)
  const [moveTarget, setMoveTarget] = useState<CloudTrainingVideo['sessionId']>('day-1')
  const [error, setError] = useState('')
  const [editable, setEditable] = useState(true)
  const [switchingLibrary, setSwitchingLibrary] = useState(false)
  const selectedVideo = videos.find((video) => video.id === activeId) ?? videos[0]
  const selectedDay = aliTrainingDays.find((day) => day.id === selectedVideo?.sessionId)

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
    if (!selectedVideo) { setVideoUrl(''); return }
    const controller = new AbortController()
    let objectUrl = ''
    setPlayerLoading(true)
    setVideoUrl('')
    void createCloudTrainingVideoUrl(selectedVideo.id, controller.signal).then((url) => {
      objectUrl = url
      setVideoUrl(url)
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not load this video.')
    }).finally(() => { if (!controller.signal.aborted) setPlayerLoading(false) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selectedVideo?.id])

  async function uploadFiles(day: TrainingDayDefinition, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploadingDay(day.id)
    setError('')
    let lastUploadedId = ''
    try {
      for (const file of files) {
        const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || `${day.title} exercise`
        lastUploadedId = (await uploadCloudTrainingVideo(day.id, title, file)).id
      }
      await refreshVideos(lastUploadedId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload this video.')
    } finally {
      setUploadingDay('')
    }
  }

  async function removeVideo(video: CloudTrainingVideo) {
    if (!window.confirm(tr(`حذف "${video.title}" نهائياً؟`, `Permanently delete “${video.title}”?`))) return
    setDeletingId(video.id)
    setError('')
    try {
      await deleteCloudTrainingVideo(video.id)
      await refreshVideos()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this video.')
    } finally {
      setDeletingId('')
    }
  }

  function openMoveVideo(video: CloudTrainingVideo) {
    const destination = aliTrainingDays.find((day) => day.id !== video.sessionId)
    if (!destination) return
    setVideoToMove(video)
    setMoveTarget(destination.id)
  }

  async function confirmMoveVideo() {
    if (!videoToMove || moveTarget === videoToMove.sessionId) return
    setMovingId(videoToMove.id)
    setError('')
    try {
      const { video } = await moveCloudTrainingVideo(videoToMove.id, moveTarget)
      setVideos((current) => current.map((item) => item.id === video.id ? video : item))
      setActiveId(video.id)
      setVideoToMove(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not move this video.')
    } finally {
      setMovingId('')
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
    <div className="workouts-page ali-training-page">
      <section className="feature-intro ali-training-intro">
        <div><span className="status-pill"><ShieldCheck size={14} /> {editable ? tr('مكتبة خاصة', 'Private library') : tr('برنامج مخصص لك', 'Assigned program')}</span><h2>{tr('جلساتك التدريبية', 'Your training sessions')}</h2><p>{editable ? tr('ارفع الفيديوهات أو انقلها بين الأيام أو احذفها. تتم مزامنة المكتبة مع حسابك على جميع أجهزتك.', 'Upload, move between days, or delete videos. Your library stays synchronized with your account on every device.') : tr('تمت مشاركة برنامج مدربك مع حسابك للعرض على كل أجهزتك. لن تؤثر تغييراتك على مكتبة المصدر.', 'Your coach’s program is shared read-only with your account on every device. Your changes cannot affect the source library.')}</p></div>
        <div className="personal-plan-badge"><Cloud size={20} /><span><small>{tr('محفوظ في الحساب', 'Saved to your account')}</small><b>{videos.length} {tr('فيديو', 'videos')}</b></span></div>
      </section>

      <div className="workout-mode-actions card-surface"><span>{tr('نوع البرنامج', 'Workout source')}</span><div><button className="soft-btn" onClick={() => void onUseDefault()}>{tr('استخدام الخطة الافتراضية', 'Use default plan')}</button>{!editable ? <button className="primary-btn" onClick={() => void startOwnLibrary()} disabled={switchingLibrary}><Upload size={16} />{switchingLibrary ? tr('جارٍ التجهيز…', 'Preparing…') : tr('إنشاء مكتبتي الخاصة', 'Create my own library')}</button> : null}</div></div>

      <section className="ali-video-player card-surface" aria-live="polite">
        {selectedVideo ? <><div className="ali-video-heading"><span><small>{selectedDay ? tr(selectedDay.titleAr, selectedDay.title) : ''}</small><b>{selectedVideo.title}</b></span><em>{selectedDay ? tr(selectedDay.focusAr, selectedDay.focus) : ''}</em></div>{videoUrl ? <video key={videoUrl} controls playsInline preload="metadata" src={videoUrl}>{tr('متصفحك لا يدعم تشغيل الفيديو.', 'Your browser does not support video playback.')}</video> : <div className="ali-player-state"><LoaderCircle className={playerLoading ? 'spin' : ''} size={28} /><b>{playerLoading ? tr('جارٍ تحميل الفيديو الخاص…', 'Loading private video…') : tr('تعذر تشغيل الفيديو', 'Video unavailable')}</b></div>}</> : <div className="ali-player-state"><Upload size={30} /><b>{loading ? tr('جارٍ تحميل المكتبة…', 'Loading your library…') : tr('ارفع أول فيديو للبدء', 'Upload your first video to begin')}</b><span>{tr('MP4 أو MOV أو WebM — حتى ١٠٠ ميغابايت', 'MP4, MOV, or WebM — up to 100 MB')}</span></div>}
      </section>

      {error ? <div className="ali-training-error" role="alert">{error}</div> : null}

      {videoToMove ? <div className="ali-move-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !movingId) setVideoToMove(null) }}>
        <section className="ali-move-dialog card-surface" role="dialog" aria-modal="true" aria-labelledby="move-video-title">
          <header><div><small>{tr('إدارة الفيديو', 'Manage video')}</small><h3 id="move-video-title">{tr('نقل إلى فئة أخرى', 'Move to another category')}</h3></div><button onClick={() => setVideoToMove(null)} disabled={Boolean(movingId)} aria-label={tr('إغلاق', 'Close')}><X size={19} /></button></header>
          <p>{videoToMove.title}</p>
          <label><span>{tr('الفئة الجديدة', 'New category')}</span><select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value as CloudTrainingVideo['sessionId'])}>{aliTrainingDays.filter((day) => day.id !== videoToMove.sessionId).map((day) => <option key={day.id} value={day.id}>{tr(day.titleAr, day.title)} — {tr(day.focusAr, day.focus)}</option>)}</select></label>
          <div><button className="soft-btn" onClick={() => setVideoToMove(null)} disabled={Boolean(movingId)}>{tr('إلغاء', 'Cancel')}</button><button className="primary-btn" onClick={() => void confirmMoveVideo()} disabled={Boolean(movingId)}>{movingId ? <LoaderCircle className="spin" size={17} /> : <ArrowRightLeft size={17} />}{movingId ? tr('جارٍ النقل…', 'Moving…') : tr('نقل الفيديو', 'Move video')}</button></div>
        </section>
      </div> : null}

      <section className="ali-session-grid">
        {aliTrainingDays.map((day) => {
          const dayVideos = videos.filter((video) => video.sessionId === day.id)
          return <article key={day.id} className="ali-session card-surface">
            <header><span>{day.id === 'abs' ? '◎' : day.title.replace('Day ', '')}</span><div><small>{tr(day.titleAr, day.title)}</small><b>{tr(day.focusAr, day.focus)}</b></div><em>{dayVideos.length} {tr('فيديو', 'videos')}</em></header>
            <div className="ali-exercise-list">
              {dayVideos.map((video, index) => {
                const selected = selectedVideo?.id === video.id
                return <div key={video.id} className={`${selected ? 'ali-exercise-row active' : 'ali-exercise-row'}${editable ? '' : ' readonly'}`}><button onClick={() => setActiveId(video.id)} aria-current={selected ? 'true' : undefined}><span>{index + 1}</span><b>{video.title}</b><PlayCircle size={18} /></button>{editable ? <><button className="ali-move-video" onClick={() => openMoveVideo(video)} disabled={Boolean(movingId || deletingId)} aria-label={`${tr('نقل', 'Move')} ${video.title}`}><ArrowRightLeft size={16} /></button><button className="ali-delete-video" onClick={() => void removeVideo(video)} disabled={Boolean(deletingId === video.id || movingId)} aria-label={`${tr('حذف', 'Delete')} ${video.title}`}>{deletingId === video.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button></> : null}</div>
              })}
              {!dayVideos.length ? <p className="ali-empty-day">{tr('لا توجد فيديوهات لهذا اليوم بعد.', 'No videos added to this day yet.')}</p> : null}
            </div>
            {editable ? <label className={uploadingDay === day.id ? 'ali-upload-button busy' : 'ali-upload-button'}><input type="file" accept="video/mp4,video/quicktime,video/webm" multiple onChange={(event) => void uploadFiles(day, event)} disabled={Boolean(uploadingDay)} /><Upload size={16} />{uploadingDay === day.id ? tr('جارٍ الرفع…', 'Uploading…') : tr('إضافة فيديوهات', 'Add videos')}</label> : null}
          </article>
        } )}
      </section>

      <div className="health-note workout-note"><HeartPulse size={20} /><p><b>{tr('تدرب بأمان', 'Train safely')}</b>{tr('استخدم الأوزان والتكرارات التي حددها مدربك، وتوقف عند الألم أو الدوار.', 'Use the loads and repetitions prescribed by your coach, and stop if you feel pain or dizziness.')}</p></div>
    </div>
  )
}

export function WorkoutsPage({ account, profile, preference, onPreferenceChange, onAccountChange }: WorkoutsPageProps) {
  const [modeBusy, setModeBusy] = useState(false)
  const [modeError, setModeError] = useState('')
  const workoutMode = account.workoutMode ?? (hasAssignedTrainingLibrary(account.username) ? 'custom' : 'default')

  async function chooseWorkoutMode(mode: 'default' | 'custom') {
    setModeBusy(true)
    setModeError('')
    try {
      const result = await updateCloudWorkoutPreference(mode)
      onAccountChange({ ...account, ...result.account })
      return true
    } catch (caught) {
      setModeError(caught instanceof Error ? caught.message : 'Could not save your workout choice.')
      return false
    } finally {
      setModeBusy(false)
    }
  }

  if (workoutMode === 'unselected') return <div className="workouts-page"><section className="workout-choice card-surface"><span className="status-pill"><Dumbbell size={14} /> {tr('ابدأ التدريب', 'Workout setup')}</span><h2>{tr('كيف تريد أن تتدرب؟', 'How would you like to train?')}</h2><p>{tr('اختر خطة توازن الجاهزة أو أنشئ مكتبتك الخاصة وارفع فيديوهات مدربك لكل يوم.', 'Choose Tawazon’s ready-made plan, or create a private library and upload your coach’s videos for each day.')}</p><div><button onClick={() => void chooseWorkoutMode('default')} disabled={modeBusy}><Sparkles size={24} /><b>{tr('الخطة الافتراضية', 'Default workout')}</b><span>{tr('برنامج أسبوعي جاهز حسب نشاطك وهدفك', 'A ready weekly program matched to your activity and goal')}</span></button><button onClick={() => void chooseWorkoutMode('custom')} disabled={modeBusy}><Upload size={24} /><b>{tr('رفع برنامجي', 'Upload my workout')}</b><span>{tr('فيديوهات خاصة محفوظة في حسابك ومتاحة على كل جهاز', 'Private videos saved to your account and available on every device')}</span></button></div>{modeError ? <div className="ali-training-error" role="alert">{modeError}</div> : null}</section></div>

  if (workoutMode === 'custom') return <PersonalTrainingPlan onUseDefault={() => chooseWorkoutMode('default')} onUseOwnLibrary={() => chooseWorkoutMode('custom')} />

  const metrics = calculateHealthMetrics(profile)
  const sessions = sportSessions[preference]
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const bmiTone = !metrics.isValid ? tr('أكمل بيانات الملف', 'Complete your profile') : metrics.bmi < 18.5 ? tr('زيادة تدريجية', 'Build up gradually') : metrics.bmi < 25 ? tr('لياقة وتوازن', 'Fitness and balance') : tr('نزول آمن وتحسين اللياقة', 'Safe loss and better fitness')

  return (
    <div className="workouts-page">
      <section className="feature-intro">
        <div><span className="status-pill"><Dumbbell size={14} /> {tr('خطة التمرين', 'Workout plan')}</span><h2>{tr('برنامج يناسب هدفك', 'A program built for your goal')}</h2><p>{tr('أربعة أيام نشاط وثلاثة أيام استشفاء، مبنية على هدفك وقياساتك.', 'Four active days and three recovery days based on your goal and measurements.')}</p></div>
        <div className="plan-balance"><TrendingUp size={17} /><span><small>BMI {metrics.isValid ? toArabicNumber(metrics.bmi.toFixed(1)) : '—'}</small><b>{bmiTone}</b></span></div>
      </section>

      <div className="workout-mode-actions card-surface"><span>{tr('تريد برنامجك الخاص؟', 'Prefer your own program?')}</span><button className="soft-btn" onClick={() => void chooseWorkoutMode('custom')} disabled={modeBusy}><Upload size={16} /> {tr('رفع فيديوهات التمرين', 'Upload workout videos')}</button></div>
      {modeError ? <div className="ali-training-error" role="alert">{modeError}</div> : null}

      <div className="sport-picker card-surface">
        {sportOptions.map((sport) => <button key={sport.id} className={sport.id === preference ? 'active' : ''} onClick={() => onPreferenceChange(sport.id)}><span>{sport.glyph}</span>{tr(sport.label, sport.labelEn)}</button>)}
      </div>

      <section className="workout-grid">
        {days.map((day, index) => {
          const sessionIndex = [0, 1, -1, 2, -1, 3, -1][index]
          const isRest = sessionIndex === -1
          const localizedExercises = isRest ? [] : sessions[sessionIndex].map((exercise, exerciseIndex) => tr(exercise, englishSportSessions[preference][sessionIndex][exerciseIndex]))
          return (
            <article key={day} className={isRest ? 'workout-day card-surface rest' : 'workout-day card-surface'}>
              <div className="workout-day-head"><span>{isRest ? '🌿' : sportOptions.find((item) => item.id === preference)?.glyph}</span><div><small>{tr(day, daysEn[index])}</small><b>{isRest ? tr('راحة واستشفاء', 'Rest and recovery') : `${tr('الجلسة', 'Session')} ${toArabicNumber(sessionIndex + 1)}`}</b></div><em><Timer size={13} /> {isRest ? tr('نشاط خفيف', 'Light activity') : tr('٣٠–٦٠ د', '30–60 min')}</em></div>
              {isRest ? <p className="rest-copy">{tr('مشي خفيف، تمدد، ونوم كافٍ لمساعدة الجسم على التعافي.', 'Take an easy walk, stretch, and get enough sleep to support recovery.')}</p> : <ul>{localizedExercises.map((exercise) => <li key={exercise}><span><Sparkles size={13} /> {exercise}</span><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise} proper form`)}`} target="_blank" rel="noreferrer" aria-label={`${tr('شرح', 'How to perform')} ${exercise}`}><ExternalLink size={13} /></a></li>)}</ul>}
            </article>
          )
        })}
      </section>

      <div className="health-note workout-note"><HeartPulse size={20} /><p><b>{tr('ابدأ بما يناسب قدرتك', 'Start at your own level')}</b>{tr('الخطة إرشادية. توقف عند الألم واستشر طبيباً قبل بدء نشاط جديد إذا كان لديك مرض مزمن أو إصابة.', 'This plan is guidance only. Stop if you feel pain and consult a doctor before a new activity if you have a chronic condition or injury.')}</p></div>
    </div>
  )
}
