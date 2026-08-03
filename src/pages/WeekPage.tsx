import { useState } from 'react'
import { Apple, ChevronDown, Dice5, Flame, Sparkles } from 'lucide-react'
import { fruits } from '../data'
import { MealThumbnail } from '../components/MealThumbnail'
import { fruitName, mealName, mealTitle, tr } from '../i18n'
import type { DayPlan, FruitMap, MealGroup, SelectionMap } from '../types'
import { formatPortion, getMealItems, getMealTotals, toArabicNumber } from '../utils'

interface Totals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface WeekPageProps {
  days: DayPlan[]
  mealGroups: MealGroup[]
  selections: SelectionMap
  fruitMap: FruitMap
  weeklyTotals: Totals[]
  onRegenerate: () => void
  onOpenDay: (dayId: string) => void
}

export function WeekPage({ days, mealGroups, selections, fruitMap, weeklyTotals, onRegenerate, onOpenDay }: WeekPageProps) {
  const [expandedDay, setExpandedDay] = useState(days[0]?.id)

  return (
    <div className="week-page">
      <section className="feature-intro">
        <div><span className="status-pill"><Sparkles size={14} /> {tr('برنامج الأسبوع', 'Weekly program')}</span><h2>{tr('أسبوع كامل بلا تكرار', 'A full week without repeats')}</h2><p>{tr('امزج عدة خيارات وحصص في كل وجبة، مع تدوير تلقائي للأصناف والفواكه.', 'Mix several options and portions in every meal, with automatic meal and fruit rotation.')}</p></div>
        <button className="primary-btn" onClick={onRegenerate}><Dice5 size={17} /> {tr('إنشاء خطة جديدة', 'Create a new plan')}</button>
      </section>

      <section className="week-list">
        {days.map((day, index) => {
          const isOpen = expandedDay === day.id
          const totals = weeklyTotals[index]
          const chosenFruits = fruits.filter((fruit) => (fruitMap[day.id] ?? []).includes(fruit.id))
          return (
            <article className={isOpen ? 'week-day card-surface open' : 'week-day card-surface'} key={day.id}>
              <button className="week-day-head" onClick={() => setExpandedDay(isOpen ? '' : day.id)} aria-expanded={isOpen}>
                <span><small>{tr(day.isToday ? 'اليوم' : day.dayName, day.isToday ? 'Today' : day.dayNameEn)}</small><b>{tr(day.date, day.dateEn)}</b></span>
                <span className="week-day-total"><Flame size={15} /> {toArabicNumber(totals.calories)} {tr('سعرة', 'kcal')}</span>
                <ChevronDown size={18} />
              </button>
              {isOpen && (
                <div className="week-day-body">
                  <div className="week-meals">
                    {mealGroups.map((meal) => {
                      const items = getMealItems(meal, selections[day.id]?.[meal.id])
                      const mealTotals = getMealTotals(meal, selections[day.id]?.[meal.id])
                      const firstOption = items[0]?.option
                      const names = items.map(({ option, portion }) => `${formatPortion(portion)}× ${mealName(option)}`).join(' + ')
                      return <div key={meal.id}><MealThumbnail option={firstOption} className="week-meal-thumb" /><p><small>{mealTitle(meal)}</small><b>{items.length ? names : tr('لم تختر وجبة', 'No meal selected')}</b></p><em>{toArabicNumber(mealTotals.calories)}</em></div>
                    })}
                  </div>
                  <div className="week-day-footer">
                    <span><Apple size={15} /> {chosenFruits.map(fruitName).join(' + ') || tr('لم تختر فاكهة', 'No fruit selected')}</span>
                    <span>{toArabicNumber(totals.protein)}g {tr('بروتين', 'protein')} · {toArabicNumber(totals.carbs)}g {tr('كارب', 'carbs')}</span>
                    <button className="soft-btn" onClick={() => onOpenDay(day.id)}>{tr('تعديل هذا اليوم', 'Edit this day')}</button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
