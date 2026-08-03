import { FormEvent, useMemo, useState } from 'react'
import { CalendarCheck2, Check, Circle, Flame, Scale, Target } from 'lucide-react'
import { habitTasks } from '../data'
import { tr } from '../i18n'
import type { HabitId, HabitMap, UserProfile } from '../types'
import { toArabicNumber } from '../utils'

interface HabitsPageProps {
  todayId: string
  habits: HabitMap
  profile: UserProfile
  onToggle: (taskId: HabitId) => void
  onAddWeight: (value: number) => void
}

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export function HabitsPage({ todayId, habits, profile, onToggle, onAddWeight }: HabitsPageProps) {
  const [weight, setWeight] = useState(String(profile.weight))
  const today = habits[todayId] ?? {}
  const completed = habitTasks.filter((task) => today[task.id]).length
  const todayPercent = Math.round((completed / habitTasks.length) * 100)
  const history = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const id = isoDaysAgo(13 - index)
    const done = habitTasks.filter((task) => habits[id]?.[task.id]).length
    return { id, done, percent: Math.round((done / habitTasks.length) * 100) }
  }), [habits])
  const weekPercent = Math.round(history.slice(-7).reduce((sum, day) => sum + day.percent, 0) / 7)
  let streak = 0
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].percent < 100) break
    streak += 1
  }

  function saveWeight(event: FormEvent) {
    event.preventDefault()
    const value = Number(weight)
    if (value >= 30 && value <= 300) onAddWeight(value)
  }

  return (
    <div className="habits-page">
      <section className="feature-intro">
        <div><span className="status-pill"><CalendarCheck2 size={14} /> {tr('برنامج المتابعة', 'Daily tracker')}</span><h2>{tr('التزم باليوم، يتغيّر الأسبوع', 'Own the day, transform the week')}</h2><p>{tr('ضع علامة على كل وجبة وتمرين، وسنحسب الاستمرارية تلقائياً.', 'Check off every meal and workout and we’ll calculate your consistency automatically.')}</p></div>
      </section>

      <section className="tracker-stats">
        <div className="progress-stat card-surface"><span className="stat-icon coral"><Flame size={21} /></span><div><small>{tr('أيام متتالية', 'Current streak')}</small><b>{toArabicNumber(streak)}</b><span>{tr('يوم مكتمل', 'complete days')}</span></div></div>
        <div className="progress-stat card-surface"><span className="stat-icon green"><Target size={21} /></span><div><small>{tr('الالتزام (٧ أيام)', 'Adherence (7 days)')}</small><b>{toArabicNumber(weekPercent)}%</b><span className="good">{tr('يتحدث مع كل مهمة', 'Updates with every task')}</span></div></div>
        <div className="progress-stat card-surface"><span className="stat-icon sand"><Scale size={21} /></span><div><small>{tr('وزنك الحالي', 'Current weight')}</small><b>{toArabicNumber(profile.weight)} <em>kg</em></b><span>{tr('الهدف', 'Target')} {toArabicNumber(profile.targetWeight)} kg</span></div></div>
      </section>

      <section className="tracker-layout">
        <div className="task-panel card-surface">
          <div className="section-heading"><div><p className="eyebrow">{tr('مهام اليوم', 'Today’s tasks')}</p><h2>{toArabicNumber(todayPercent)}% {tr('مكتمل', 'complete')}</h2></div><span className="tracker-count">{toArabicNumber(completed)} / {toArabicNumber(habitTasks.length)}</span></div>
          <div className="completion-track"><i style={{ width: `${todayPercent}%` }} /></div>
          <div className="task-grid-app">
            {habitTasks.map((task) => {
              const active = Boolean(today[task.id])
              return <button className={active ? 'task-button active' : 'task-button'} key={task.id} onClick={() => onToggle(task.id)}>{active ? <Check size={18} /> : <Circle size={18} />}<span>{task.glyph} {tr(task.label, task.labelEn)}</span></button>
            })}
          </div>
          {todayPercent === 100 && <div className="all-done">🎉 {tr('أحسنت! أكملت كل مهام اليوم.', 'Great work! You completed every task today.')}</div>}
        </div>

        <aside className="tracker-side">
          <form className="quick-weight card-surface" onSubmit={saveWeight}>
            <div><Scale size={19} /><span><small>{tr('تسجيل سريع', 'Quick entry')}</small><b>{tr('وزن اليوم', 'Today’s weight')}</b></span></div>
            <label><input type="number" min="30" max="300" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /><small>{tr('كغ', 'kg')}</small></label>
            <button className="primary-btn" type="submit">{tr('حفظ القياس', 'Save weight')}</button>
          </form>
          <div className="history-card card-surface">
            <div className="section-heading compact"><div><p className="eyebrow">{tr('آخر ١٤ يوماً', 'Last 14 days')}</p><h3>{tr('سجل الالتزام', 'Adherence history')}</h3></div></div>
            <div className="history-strip">{history.map((day) => <span key={day.id} title={`${day.id}: ${day.percent}%`} className={day.percent === 100 ? 'full' : day.percent >= 50 ? 'part' : day.percent > 0 ? 'some' : ''} />)}</div>
            <div className="history-legend"><span><i className="full" /> {tr('مكتمل', 'Complete')}</span><span><i className="part" /> {tr('جزئي', 'Partial')}</span><span><i /> {tr('بلا تسجيل', 'No entry')}</span></div>
          </div>
        </aside>
      </section>
    </div>
  )
}
