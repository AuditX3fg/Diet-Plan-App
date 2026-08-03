import { FormEvent, useMemo, useState } from 'react'
import { ArrowDownLeft, CalendarCheck2, CheckCircle2, Scale, Target, TrendingDown } from 'lucide-react'
import type { DayPlan, UserProfile, WeightEntry } from '../types'
import { localeCode, tr } from '../i18n'
import { toArabicNumber } from '../utils'

interface Totals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface ProgressPageProps {
  days: DayPlan[]
  weeklyTotals: Totals[]
  profile: UserProfile
  weightEntries: WeightEntry[]
  onAddWeight: (weight: number) => void
}

export function ProgressPage({ days, weeklyTotals, profile, weightEntries, onAddWeight }: ProgressPageProps) {
  const [weight, setWeight] = useState(String(profile.weight))
  const averageCalories = Math.round(weeklyTotals.reduce((sum, day) => sum + day.calories, 0) / weeklyTotals.length)
  const latestWeight = weightEntries.at(-1)?.value ?? profile.weight
  const firstWeight = weightEntries[0]?.value ?? latestWeight
  const change = latestWeight - firstWeight

  const points = useMemo(() => {
    const values = weightEntries.map((entry) => entry.value)
    const min = Math.min(...values) - 0.5
    const max = Math.max(...values) + 0.5
    const range = Math.max(1, max - min)
    return values.map((value, index) => ({ x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100, y: 88 - ((value - min) / range) * 70 }))
  }, [weightEntries])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = Number(weight)
    if (next > 30 && next < 300) onAddWeight(next)
  }

  return (
    <div className="progress-page">
      <section className="progress-intro">
        <div><span className="status-pill"><TrendingDown size={14} /> {tr('تقدّم ثابت', 'Steady progress')}</span><h2>{tr('أرقامك تحكي قصة نجاحك', 'Your numbers tell your success story')}</h2><p>{tr('راقب العادات، لا الرقم فقط. الاستمرارية هي المؤشر الأهم.', 'Track the habits, not only the number. Consistency is what matters most.')}</p></div>
        <div className="date-range"><CalendarCheck2 size={17} /> {tr('آخر ٧ أيام', 'Last 7 days')}</div>
      </section>

      <section className="stat-row">
        <div className="progress-stat card-surface"><span className="stat-icon green"><Scale size={21} /></span><div><small>{tr('الوزن الحالي', 'Current weight')}</small><b>{toArabicNumber(latestWeight)} <em>kg</em></b><span className={change <= 0 ? 'good' : 'warn'}><ArrowDownLeft size={13} /> {toArabicNumber(Math.abs(change))} kg {tr('منذ البداية', 'since the start')}</span></div></div>
        <div className="progress-stat card-surface"><span className="stat-icon sand"><Target size={21} /></span><div><small>{tr('الوزن المستهدف', 'Target weight')}</small><b>{toArabicNumber(profile.targetWeight)} <em>kg</em></b><span>{tr('متبقي', 'Remaining')} {toArabicNumber(Math.max(0, latestWeight - profile.targetWeight))} kg</span></div></div>
        <div className="progress-stat card-surface"><span className="stat-icon coral"><CheckCircle2 size={21} /></span><div><small>{tr('متوسط السعرات', 'Average calories')}</small><b>{toArabicNumber(averageCalories)} <em>{tr('سعرة', 'kcal')}</em></b><span className="good">{tr('ضمن النطاق المناسب', 'Within your target range')}</span></div></div>
      </section>

      <section className="charts-grid">
        <div className="weight-chart card-surface">
          <div className="section-heading"><div><p className="eyebrow">{tr('رحلة الوزن', 'Weight journey')}</p><h2>{tr('تغيّر الوزن', 'Weight change')}</h2></div><span className="chart-badge">{tr('آخر', 'Last')} {toArabicNumber(weightEntries.length)} {tr('قياسات', 'entries')}</span></div>
          <div className="line-chart">
            <div className="chart-grid"><i /><i /><i /><i /></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={tr('مخطط تغيّر الوزن', 'Weight change chart')}>
              <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
              {points.length > 1 && <polygon points={`0,100 ${points.map((point) => `${point.x},${point.y}`).join(' ')} 100,100`} fill="url(#areaGradient)" />}
              {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />}
              {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />)}
            </svg>
            <div className="chart-labels">{weightEntries.map((entry) => <span key={`${entry.date}-${entry.value}`}>{new Intl.DateTimeFormat(localeCode(), { day: 'numeric', month: 'short' }).format(new Date(`${entry.date}T12:00:00`))}</span>)}</div>
          </div>
          <form className="weight-form" onSubmit={handleSubmit}>
            <label><span>{tr('سجّل وزنك اليوم', 'Log today’s weight')}</span><div><input type="number" min="30" max="300" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /><small>kg</small></div></label>
            <button className="primary-btn" type="submit">{tr('إضافة القياس', 'Add entry')}</button>
          </form>
        </div>

        <div className="calorie-chart card-surface">
          <div className="section-heading"><div><p className="eyebrow">{tr('السعرات', 'Calories')}</p><h2>{tr('الالتزام الأسبوعي', 'Weekly adherence')}</h2></div><span className="target-key"><i /> {tr('هدفك', 'Your target')}</span></div>
          <div className="large-week-bars">
            {weeklyTotals.map((day, index) => {
              const ratio = Math.min(120, Math.round((day.calories / profile.targetCalories) * 100))
              const near = ratio >= 85 && ratio <= 110
              return (
                <div key={days[index]?.id ?? index}>
                  <span className="bar-value">{toArabicNumber(day.calories)}</span>
                  <span className="bar-track"><i className={near ? 'near' : ''} style={{ height: `${Math.max(10, ratio / 1.2)}%` }} /></span>
                  <small>{tr(days[index]?.dayName ?? '', days[index]?.dayNameEn ?? '')}</small>
                </div>
              )
            })}
          </div>
          <div className="chart-insight"><span>✦</span><p><b>{tr('أفضل من الأسبوع الماضي', 'Better than last week')}</b>{tr('حافظت على نطاق هدفك في معظم الأيام.', 'You stayed near your target on most days.')}</p></div>
        </div>
      </section>
    </div>
  )
}
