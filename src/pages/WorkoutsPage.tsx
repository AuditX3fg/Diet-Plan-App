import { Dumbbell, ExternalLink, HeartPulse, Sparkles, Timer, TrendingUp } from 'lucide-react'
import { sportOptions } from '../data'
import { tr } from '../i18n'
import type { SportPreference, UserProfile } from '../types'
import { calculateHealthMetrics, toArabicNumber } from '../utils'

interface WorkoutsPageProps {
  profile: UserProfile
  preference: SportPreference
  onPreferenceChange: (preference: SportPreference) => void
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

export function WorkoutsPage({ profile, preference, onPreferenceChange }: WorkoutsPageProps) {
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
