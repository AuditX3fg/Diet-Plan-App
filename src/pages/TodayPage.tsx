import {
  ArrowLeft,
  Beef,
  ChevronLeft,
  CircleGauge,
  Droplets,
  Flame,
  GlassWater,
  Sparkles,
  Wheat,
} from 'lucide-react'
import { MealThumbnail } from '../components/MealThumbnail'
import { mealName, mealTitle, tr } from '../i18n'
import type { MealGroup, SelectionMap, UserProfile } from '../types'
import { formatPortion, getMealItems, getMealTotals, toArabicNumber } from '../utils'

interface Totals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface TodayPageProps {
  dayId: string
  mealGroups: MealGroup[]
  selections: SelectionMap
  totals: Totals
  weeklyTotals: Totals[]
  profile: UserProfile
  water: number
  habitStreak: number
  onWaterChange: (value: number) => void
  onOpenPlan: () => void
  onOpenProgress: () => void
}

function MacroCard({ icon, value, target, label, tone }: { icon: React.ReactNode; value: number; target: number; label: string; tone: string }) {
  const progress = Math.min(100, Math.round((value / target) * 100))
  return (
    <div className="macro-card">
      <span className="macro-icon" style={{ background: tone }}>{icon}</span>
      <span className="macro-copy"><small>{label}</small><b>{toArabicNumber(value)}<em>g</em></b></span>
      <span className="mini-progress"><i style={{ width: `${progress}%`, background: tone }} /></span>
      <span className="macro-target">{tr('من', 'of')} {toArabicNumber(target)}g</span>
    </div>
  )
}

export function TodayPage({
  dayId,
  mealGroups,
  selections,
  totals,
  weeklyTotals,
  profile,
  water,
  habitStreak,
  onWaterChange,
  onOpenPlan,
  onOpenProgress,
}: TodayPageProps) {
  const caloriePercent = Math.min(100, Math.round((totals.calories / profile.targetCalories) * 100))
  const remaining = Math.max(0, profile.targetCalories - totals.calories)

  return (
    <div className="today-page">
      <section className="hero-grid">
        <div className="calorie-hero card-surface">
          <div className="section-copy">
            <span className="status-pill"><Sparkles size={14} /> {tr('تسير بشكل رائع اليوم', 'You’re doing great today')}</span>
            <h2>{tr('ملخصك الغذائي', 'Your nutrition summary')}</h2>
            <p>{tr('كل اختيار صغير يقربك من هدفك. استمر بهذا الإيقاع.', 'Every small choice brings you closer to your goal. Keep going.')}</p>
            <button className="text-action" onClick={onOpenProgress}>{tr('عرض تفاصيل التقدم', 'View progress details')} <ArrowLeft size={16} /></button>
          </div>
          <div className="calorie-ring-wrap">
            <div className="calorie-ring" style={{ background: `conic-gradient(var(--accent) ${caloriePercent * 3.6}deg, var(--track) 0deg)` }}>
              <div className="ring-core">
                <Flame size={21} />
                <strong>{toArabicNumber(totals.calories)}</strong>
                <span>{tr('من', 'of')} {toArabicNumber(profile.targetCalories)} {tr('سعرة', 'kcal')}</span>
              </div>
            </div>
            <span className="remaining-chip">{tr('متبقي', 'Remaining')} {toArabicNumber(remaining)} {tr('سعرة', 'kcal')}</span>
          </div>
        </div>

        <div className="water-card card-surface">
          <div className="water-head">
            <span className="water-icon"><Droplets size={22} /></span>
            <div><small>{tr('ترطيبك اليوم', 'Today’s hydration')}</small><b>{toArabicNumber(water)} {tr('من ٨ أكواب', 'of 8 glasses')}</b></div>
          </div>
          <div className="water-glasses" aria-label={tr('متابعة الماء', 'Water tracker')}>
            {Array.from({ length: 8 }, (_, index) => (
              <button key={index} className={index < water ? 'filled' : ''} onClick={() => onWaterChange(index + 1 === water ? index : index + 1)} aria-label={tr(`ضبط الماء على ${index + 1} أكواب`, `Set water to ${index + 1} glasses`)}>
                <GlassWater size={19} />
              </button>
            ))}
          </div>
          <p>{water >= 6 ? tr('ممتاز! اقتربت من هدف الترطيب.', 'Excellent! You’re close to your hydration goal.') : tr('حافظ على كوب ماء قريب منك.', 'Keep a glass of water nearby.')}</p>
        </div>
      </section>

      <section className="macro-grid">
        <MacroCard icon={<Beef size={19} />} value={totals.protein} target={profile.targetProtein} label={tr('البروتين', 'Protein')} tone="#e49a72" />
        <MacroCard icon={<Wheat size={19} />} value={totals.carbs} target={profile.targetCarbs} label={tr('الكربوهيدرات', 'Carbohydrates')} tone="#d1a84f" />
        <MacroCard icon={<CircleGauge size={19} />} value={totals.fat} target={profile.targetFat} label={tr('الدهون', 'Fat')} tone="#7da28c" />
      </section>

      <section className="dashboard-grid">
        <div className="meals-panel card-surface">
          <div className="section-heading">
            <div><p className="eyebrow">{tr('جدول اليوم', 'Today’s schedule')}</p><h2>{tr('وجباتك المخططة', 'Your planned meals')}</h2></div>
            <button className="soft-btn" onClick={onOpenPlan}>{tr('تعديل الخطة', 'Edit plan')} <ChevronLeft size={16} /></button>
          </div>

          <div className="meal-timeline">
            {mealGroups.map((meal, index) => {
              const items = getMealItems(meal, selections[dayId]?.[meal.id])
              const mealTotals = getMealTotals(meal, selections[dayId]?.[meal.id])
              const firstOption = items[0]?.option
              const selectedNames = items.map(({ option, portion }) => `${formatPortion(portion)}× ${mealName(option)}`).join(' + ')
              const portions = items.reduce((sum, item) => sum + item.portion, 0)
              return (
                <button className="timeline-row" key={meal.id} onClick={onOpenPlan}>
                  <span className="timeline-line"><i />{index < mealGroups.length - 1 && <em />}</span>
                  <span className="timeline-time">{tr(meal.time, meal.timeEn)}</span>
                  <MealThumbnail option={firstOption} className="timeline-thumb" />
                  <span className="timeline-copy"><small>{mealTitle(meal)}</small><b>{items.length ? selectedNames : tr('لم تختر وجبة بعد', 'No meal selected yet')}</b><span>{items.length ? tr(`${items.length} أصناف · ${formatPortion(portions)} حصة`, `${items.length} options · ${formatPortion(portions)} portions`) : tr('افتح الخطة لاختيار وجبتك', 'Open the plan to choose a meal')}</span></span>
                  <span className="timeline-cal">{toArabicNumber(mealTotals.calories)}<small>{tr('سعرة', 'kcal')}</small></span>
                  <ChevronLeft size={18} />
                </button>
              )
            })}
          </div>
        </div>

        <aside className="side-stack">
          <div className="week-card card-surface">
            <div className="section-heading compact">
              <div><p className="eyebrow">{tr('هذا الأسبوع', 'This week')}</p><h3>{tr('التزامك بالخطة', 'Plan adherence')}</h3></div>
              <span className="streak">🔥 {toArabicNumber(habitStreak)} {tr('أيام', 'days')}</span>
            </div>
            <div className="week-bars">
              {weeklyTotals.map((item, index) => {
                const height = Math.max(18, Math.min(100, Math.round((item.calories / profile.targetCalories) * 100)))
                return (
                  <div className={index === 0 ? 'today' : ''} key={index}>
                    <span><i style={{ height: `${height}%` }} /></span>
                    <small>{tr(['اليوم', 'ث', 'أر', 'خ', 'ج', 'س', 'أح'][index], ['Today', 'M', 'T', 'W', 'T', 'F', 'S'][index])}</small>
                  </div>
                )
              })}
            </div>
            <button className="week-link" onClick={onOpenProgress}>{tr('شاهد التقرير الكامل', 'View full report')} <ArrowLeft size={15} /></button>
          </div>

          <div className="coach-card">
            <span className="coach-orbit">✦</span>
            <div className="coach-icon">🥑</div>
            <p className="eyebrow">{tr('ملاحظة ذكية', 'Smart note')}</p>
            <h3>{tr('بروتينك اليوم ممتاز', 'Your protein looks great today')}</h3>
            <p>{tr('أنت قريب من هدف البروتين. اجعل وجبتك الأخيرة خفيفة وغنية بالخضار.', 'You’re close to your protein goal. Keep your final meal light and rich in vegetables.')}</p>
          </div>
        </aside>
      </section>
    </div>
  )
}
