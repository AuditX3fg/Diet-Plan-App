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

interface ChartPoint {
  x: number
  y: number
  value: number
  date: string
}

function smoothLine(points: ChartPoint[]) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point
    const next = points[index + 1]
    const afterNext = points[index + 2] ?? next
    const controlOneX = point.x + (next.x - previous.x) / 6
    const controlOneY = point.y + (next.y - previous.y) / 6
    const controlTwoX = next.x - (afterNext.x - point.x) / 6
    const controlTwoY = next.y - (afterNext.y - point.y) / 6
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

export function ProgressPage({ days, weeklyTotals, profile, weightEntries, onAddWeight }: ProgressPageProps) {
  const [weight, setWeight] = useState(String(profile.weight))
  const averageCalories = Math.round(weeklyTotals.reduce((sum, day) => sum + day.calories, 0) / weeklyTotals.length)
  const latestWeight = weightEntries.at(-1)?.value ?? profile.weight
  const firstWeight = weightEntries[0]?.value ?? latestWeight
  const change = latestWeight - firstWeight
  const weeklyRate = weightEntries.length > 1 ? change / Math.max(1, (new Date(`${weightEntries.at(-1)?.date}T12:00:00`).getTime() - new Date(`${weightEntries[0]?.date}T12:00:00`).getTime()) / 604_800_000) : 0

  const chart = useMemo(() => {
    const values = weightEntries.map((entry) => entry.value)
    const rawMin = Math.min(...values, profile.weight)
    const rawMax = Math.max(...values, profile.weight)
    const padding = Math.max(0.6, (rawMax - rawMin) * 0.2)
    const min = Math.floor((rawMin - padding) * 2) / 2
    const max = Math.ceil((rawMax + padding) * 2) / 2
    const range = Math.max(1, max - min)
    const points = weightEntries.map((entry, index) => ({
      x: values.length === 1 ? 52 : 6 + (index / (values.length - 1)) * 92,
      y: 88 - ((entry.value - min) / range) * 76,
      value: entry.value,
      date: entry.date,
    }))
    const line = smoothLine(points)
    return {
      min,
      max,
      range,
      points,
      line,
      area: line && points.length > 1 ? `${line} L ${points.at(-1)?.x} 94 L ${points[0].x} 94 Z` : '',
      ticks: Array.from({ length: 4 }, (_, index) => max - (range * index) / 3),
      goalY: profile.targetWeight >= min && profile.targetWeight <= max ? 88 - ((profile.targetWeight - min) / range) * 76 : null,
    }
  }, [profile.targetWeight, profile.weight, weightEntries])

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
          <div className="weight-chart-summary">
            <div><small>{tr('التغيّر الكلي', 'Total change')}</small><b className={change <= 0 ? 'good' : 'warn'}>{change > 0 ? '+' : ''}{toArabicNumber(change.toFixed(1))} kg</b></div>
            <div><small>{tr('المعدل الأسبوعي', 'Weekly rate')}</small><b>{weeklyRate > 0 ? '+' : ''}{toArabicNumber(weeklyRate.toFixed(1))} kg</b></div>
            <div><small>{tr('إلى الهدف', 'To goal')}</small><b>{toArabicNumber(Math.abs(latestWeight - profile.targetWeight).toFixed(1))} kg</b></div>
          </div>
          <div className="line-chart">
            <div className="chart-y-axis">{chart.ticks.map((tick) => <span key={tick}>{toArabicNumber(tick.toFixed(1))}</span>)}</div>
            <div className="chart-plot">
              <div className="chart-grid">{chart.ticks.map((tick) => <i key={tick} />)}</div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={tr('مخطط تغيّر الوزن', 'Weight change chart')}>
                <defs><linearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--accent)" stopOpacity=".015" /></linearGradient><filter id="weightPointShadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="var(--accent)" floodOpacity=".3" /></filter></defs>
                {chart.goalY !== null ? <line className="goal-line" x1="1" x2="99" y1={chart.goalY} y2={chart.goalY} vectorEffect="non-scaling-stroke" /> : null}
                {chart.area ? <path d={chart.area} fill="url(#weightAreaGradient)" /> : null}
                {chart.line && chart.points.length > 1 ? <path d={chart.line} fill="none" stroke="var(--accent)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
                {chart.points.map((point, index) => <g key={`${point.date}-${point.value}`} className={index === chart.points.length - 1 ? 'latest-point' : ''}><ellipse cx={point.x} cy={point.y} rx={index === chart.points.length - 1 ? 0.82 : 0.58} ry={index === chart.points.length - 1 ? 2.4 : 1.7} fill="var(--surface)" stroke="var(--accent)" strokeWidth={index === chart.points.length - 1 ? 2 : 1.3} vectorEffect="non-scaling-stroke" filter={index === chart.points.length - 1 ? 'url(#weightPointShadow)' : undefined} /><title>{new Intl.DateTimeFormat(localeCode(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${point.date}T12:00:00`))}: ${point.value} kg</title></g>)}
              </svg>
              {chart.goalY !== null ? <span className="goal-line-label" style={{ top: `${chart.goalY}%` }}>{tr('الهدف', 'Goal')} {toArabicNumber(profile.targetWeight)}</span> : null}
              {!chart.points.length ? <div className="chart-empty">{tr('أضف أول قياس لبدء الرسم البياني.', 'Add your first entry to start the chart.')}</div> : null}
            </div>
            <div className="chart-labels">{weightEntries.map((entry, index) => { const labelEvery = Math.max(1, Math.ceil(weightEntries.length / 6)); const visible = index === 0 || index === weightEntries.length - 1 || index % labelEvery === 0; return <span className={visible ? '' : 'chart-label-hidden'} key={`${entry.date}-${entry.value}`}>{new Intl.DateTimeFormat(localeCode(), { day: 'numeric', month: 'short' }).format(new Date(`${entry.date}T12:00:00`))}</span> })}</div>
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
