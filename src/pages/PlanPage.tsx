import { useState } from 'react'
import { Apple, Check, ChevronLeft, Dice5, Leaf, Printer, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { fruits } from '../data'
import { fruitAmount, fruitName, localeCode, tr } from '../i18n'
import { MealCard } from '../components/MealCard'
import type { DayPlan, FruitMap, MealGroup, PlanPreset, SelectionMap, UserProfile } from '../types'
import { toArabicNumber } from '../utils'

interface Totals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface PlanPageProps {
  days: DayPlan[]
  mealGroups: MealGroup[]
  selectedDayId: string
  selections: SelectionMap
  fruitMap: FruitMap
  totals: Totals
  profile: UserProfile
  openMeal: string | null
  onOpenMeal: (mealId: string | null) => void
  onDayChange: (dayId: string) => void
  onMealPortionChange: (mealId: string, optionId: string, portion: number) => void
  onFruitToggle: (fruitId: string) => void
  presets: PlanPreset[]
  onSavePreset: (name: string) => void
  onLoadPreset: (preset: PlanPreset) => void
  onDeletePreset: (presetId: string) => void
  onResetDay: () => void
  onRegenerateWeek: () => void
}

export function PlanPage({
  days,
  mealGroups,
  selectedDayId,
  selections,
  fruitMap,
  totals,
  profile,
  openMeal,
  onOpenMeal,
  onDayChange,
  onMealPortionChange,
  onFruitToggle,
  presets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onResetDay,
  onRegenerateWeek,
}: PlanPageProps) {
  const [presetName, setPresetName] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0]
  const selectedFruits = fruitMap[selectedDayId] ?? []
  const percent = Math.min(100, Math.round((totals.calories / profile.targetCalories) * 100))

  return (
    <div className="plan-page">
      <section className="plan-intro">
        <div><span className="status-pill"><Leaf size={14} /> {tr('خطتك الأسبوعية', 'Your weekly plan')}</span><h2>{tr('ماذا ستأكل اليوم؟', 'What will you eat today?')}</h2><p>{tr('امزج أكثر من خيار داخل كل وجبة وحدد حصة كل صنف، وسنحسب لك القيم تلقائياً.', 'Mix multiple options in each meal, adjust every portion, and we’ll calculate the totals automatically.')}</p></div>
        <div className="intro-actions"><button className="soft-btn" onClick={onRegenerateWeek}><Dice5 size={16} /> {tr('خطة أسبوع جديدة', 'New weekly plan')}</button><div className="plan-balance"><Sparkles size={17} /><span><small>{tr('توازن اليوم', 'Today’s balance')}</small><b>{percent >= 90 && percent <= 110 ? tr('ممتاز', 'Excellent') : percent < 90 ? tr('بحاجة إلى وجبة', 'Needs another meal') : tr('فوق الهدف', 'Above target')}</b></span></div></div>
      </section>

      <div className="day-strip card-surface">
        {days.map((day) => (
          <button key={day.id} className={day.id === selectedDayId ? 'active' : ''} onClick={() => onDayChange(day.id)}>
            <span>{tr(day.dayName, day.dayNameEn)}</span><b>{tr(day.shortDate.split(' ')[0], day.shortDateEn)}</b>{day.isToday && <i />}
          </button>
        ))}
      </div>

      <section className="plan-layout">
        <div className="planner-list">
          <div className="section-heading plan-heading">
            <div><p className="eyebrow">{tr(selectedDay.date, selectedDay.dateEn)}</p><h2>{tr('وجبات اليوم', 'Today’s meals')}</h2></div>
            <span className="meal-count">{toArabicNumber(mealGroups.length)} {tr('وجبات', 'meals')}</span>
          </div>
          {mealGroups.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              selections={selections[selectedDayId]?.[meal.id]}
              open={openMeal === meal.id}
              onToggle={() => onOpenMeal(openMeal === meal.id ? null : meal.id)}
              onPortionChange={(optionId, portion) => onMealPortionChange(meal.id, optionId, portion)}
            />
          ))}

          <article className="fruit-picker planner-meal">
            <div className="fruit-head">
              <span className="fruit-icon"><Apple size={21} /></span>
              <div><b>{tr('حصتك من الفاكهة', 'Your fruit portions')}</b><span>{tr('اختر نوعين كحد أقصى', 'Choose up to two')}</span></div>
              <span className="fruit-count">{toArabicNumber(selectedFruits.length)} / {toArabicNumber(2)}</span>
            </div>
            <div className="fruit-grid">
              {fruits.map((fruit) => {
                const active = selectedFruits.includes(fruit.id)
                const disabled = !active && selectedFruits.length >= 2
                return (
                  <button key={fruit.id} disabled={disabled} className={active ? 'active' : ''} onClick={() => onFruitToggle(fruit.id)} aria-label={`${fruitName(fruit)}, ${fruitAmount(fruit)}`} title={fruitName(fruit)}>
                    <span role="img" aria-hidden="true">{fruit.glyph}</span><b>{fruitName(fruit)}</b><small>{fruitAmount(fruit)}</small>{active && <i><Check size={12} /></i>}
                  </button>
                )
              })}
            </div>
          </article>
        </div>

        <aside className="plan-summary card-surface">
          <p className="eyebrow">{tr(`ملخص ${selectedDay.dayName}`, `${selectedDay.dayNameEn} summary`)}</p>
          <h3>{tr('القيم الغذائية', 'Nutrition totals')}</h3>
          <div className="summary-ring" style={{ background: `conic-gradient(var(--accent) ${percent * 3.6}deg, var(--track) 0)` }}>
            <div><b>{toArabicNumber(totals.calories)}</b><span>{tr('سعرة حرارية', 'kcal')}</span></div>
          </div>
          <div className="summary-target"><span>{tr('الهدف اليومي', 'Daily target')}</span><b>{toArabicNumber(profile.targetCalories)} {tr('سعرة', 'kcal')}</b></div>
          <div className="summary-macros">
            <div><i className="protein" /><span><small>{tr('بروتين', 'Protein')}</small><b>{toArabicNumber(totals.protein)}g</b></span></div>
            <div><i className="carbs" /><span><small>{tr('كارب', 'Carbs')}</small><b>{toArabicNumber(totals.carbs)}g</b></span></div>
            <div><i className="fat" /><span><small>{tr('دهون', 'Fat')}</small><b>{toArabicNumber(totals.fat)}g</b></span></div>
          </div>
          <div className="summary-note"><Sparkles size={16} /><p>{percent < 90 ? tr('لديك مساحة لإضافة وجبة خفيفة أو حصة فاكهة.', 'You have room for a snack or fruit portion.') : percent <= 110 ? tr('خطة اليوم قريبة جداً من هدفك. اختيار موفق!', 'Today’s plan is very close to your target. Great choice!') : tr('جرّب اختيار وجبة أخف لتقترب من هدفك.', 'Try a lighter meal to move closer to your target.')}</p></div>
          <div className="plan-tools">
            <label><span>{tr('اسم الخطة المحفوظة', 'Saved plan name')}</span><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder={tr('مثلاً: أسبوع العمل', 'e.g. Work week')} /></label>
            <button className="primary-btn" onClick={() => { onSavePreset(presetName.trim() || tr(`خطة ${selectedDay.dayName}`, `${selectedDay.dayNameEn} plan`)); setSavedMessage(tr('تم حفظ الخطة', 'Plan saved')); setPresetName('') }}><Save size={16} /> {tr('حفظ نسخة', 'Save copy')} <ChevronLeft size={16} /></button>
            {savedMessage && <p className="saved-message"><Check size={13} /> {savedMessage}</p>}
            <div className="plan-tool-row"><button onClick={() => window.print()}><Printer size={15} /> {tr('طباعة', 'Print')}</button><button onClick={onResetDay}><RotateCcw size={15} /> {tr('إعادة اليوم', 'Reset day')}</button></div>
          </div>
          {presets.length > 0 && <div className="preset-list"><p className="eyebrow">{tr('الخطط المحفوظة', 'Saved plans')}</p>{presets.slice(0, 4).map((preset) => <div key={preset.id}><button onClick={() => onLoadPreset(preset)}><b>{preset.name}</b><small>{new Intl.DateTimeFormat(localeCode(), { day: 'numeric', month: 'short' }).format(new Date(preset.createdAt))}</small></button><button onClick={() => onDeletePreset(preset.id)} aria-label={tr(`حذف ${preset.name}`, `Delete ${preset.name}`)}><Trash2 size={14} /></button></div>)}</div>}
        </aside>
      </section>
    </div>
  )
}
