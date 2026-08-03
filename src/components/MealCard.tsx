import { Check, ChevronDown, Clock3, ExternalLink, Flame, Minus, PlayCircle, Plus } from 'lucide-react'
import type { MealGroup, MealSelection } from '../types'
import { mealDescription, mealName, mealTitle, tr } from '../i18n'
import { formatPortion, getMealItems, getMealTotals, toArabicNumber } from '../utils'
import { MealThumbnail } from './MealThumbnail'

interface MealCardProps {
  meal: MealGroup
  selections?: MealSelection
  open: boolean
  onToggle: () => void
  onPortionChange: (optionId: string, portion: number) => void
}

export function MealCard({ meal, selections, open, onToggle, onPortionChange }: MealCardProps) {
  const selectedItems = getMealItems(meal, selections)
  const totals = getMealTotals(meal, selections)
  const firstSelected = selectedItems[0]?.option
  const selectedLabel = selectedItems.map(({ option, portion }) => `${formatPortion(portion)}× ${mealName(option)}`).join(' + ')

  return (
    <article className={open ? 'planner-meal open' : 'planner-meal'}>
      <button className="planner-meal-head" onClick={onToggle} aria-expanded={open}>
        <MealThumbnail option={firstSelected} className="meal-visual" badge={selectedItems.length > 1 ? `+${toArabicNumber(selectedItems.length - 1)}` : undefined} />
        <span className="meal-head-copy">
          <span className="meal-title-line"><b>{mealTitle(meal)}</b><small><Clock3 size={13} /> {tr(meal.time, meal.timeEn)}</small></span>
          <span className="selected-name">{selectedItems.length ? selectedLabel : tr('لم تختر وجبة بعد', 'No meal selected yet')}</span>
        </span>
        {selectedItems.length > 0 && <span className="meal-cal"><Flame size={15} /> {toArabicNumber(totals.calories)} <small>{tr('سعرة', 'kcal')}</small></span>}
        <ChevronDown className="meal-chevron" size={19} />
      </button>

      {open && (
        <div className="meal-options">
          <div className="options-heading">
            <div><b>{tr('امزج أصناف وجبتك', 'Build your meal mix')}</b><span>{tr('أضف عدة خيارات وعدّل كل حصة بزيادات ربع حصة', 'Add several options and adjust each in quarter portions')}</span></div>
            <span>{toArabicNumber(selectedItems.length)} {tr('محدد', 'selected')} · {toArabicNumber(meal.options.length)} {tr('خيارات', 'options')}</span>
          </div>
          <div className="option-grid">
            {meal.options.map((option) => {
              const portion = selections?.[option.id] ?? 0
              const active = portion > 0
              return (
                <div key={option.id} className={active ? 'food-option active' : 'food-option'}>
                  <button className="food-option-main" onClick={() => onPortionChange(option.id, active ? 0 : 1)} aria-pressed={active} aria-label={active ? tr(`إزالة ${mealName(option)}`, `Remove ${mealName(option)}`) : tr(`إضافة ${mealName(option)}`, `Add ${mealName(option)}`)}>
                    <MealThumbnail option={option} className="food-thumb" />
                    <span className="food-copy">
                      <b>{mealName(option)}</b>
                      <small>{mealDescription(option)}</small>
                      <span className="macro-row">
                        <span>{toArabicNumber(option.protein)}g {tr('بروتين', 'protein')}</span>
                        <i />
                        <span>{toArabicNumber(option.carbs)}g {tr('كارب', 'carbs')}</span>
                      </span>
                    </span>
                    <span className="option-cal">{toArabicNumber(option.calories * (active ? portion : 1))}<small>{active ? tr('للحصة المحددة', 'selected') : tr('للحصة الكاملة', 'full portion')}</small></span>
                    <span className="option-check">{active ? <Check size={15} /> : <Plus size={15} />}</span>
                  </button>
                  <div className="food-option-footer">
                    <span className="option-resource-links">
                      {option.videoUrl ? <a className="meal-video-link" href={option.videoUrl} target="_blank" rel="noopener noreferrer"><PlayCircle size={13} /> {tr('شاهد الفيديو', 'Watch video')}</a> : null}
                      {option.recipeUrl ? <a className="recipe-link" href={option.recipeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> {tr('الوصفة', 'Recipe')}</a> : null}
                    </span>
                    {active && (
                      <div className="portion-control" aria-label={tr(`حصة ${mealName(option)}`, `${mealName(option)} portion`)}>
                        <button onClick={() => onPortionChange(option.id, portion - 0.25)} aria-label={tr(`تقليل حصة ${mealName(option)}`, `Decrease ${mealName(option)} portion`)}><Minus size={18} /></button>
                        <strong>{formatPortion(portion)} <small>{tr('حصة', portion === 1 ? 'portion' : 'portions')}</small></strong>
                        <button disabled={portion >= 4} onClick={() => onPortionChange(option.id, portion + 0.25)} aria-label={tr(`زيادة حصة ${mealName(option)}`, `Increase ${mealName(option)} portion`)}><Plus size={18} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}
