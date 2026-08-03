import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AppTheme } from '../theme'
import type { AppData, DietMealId, MealGroup } from '../types'
import { Card, ProgressBar, ScreenScroll, SecondaryButton, SectionHeader } from '../components/ui'
import { MealImage } from '../components/MealImage'
import { buildWeekIds, formatPortion, getNutritionTotals, shortDayLabel } from '../utils/nutrition'
import { tr } from '../i18n'

export function PlanScreen({ data, groups, theme, onChangeData }: { data: AppData; groups: MealGroup[]; theme: AppTheme; onChangeData: (next: AppData) => void }) {
  const days = buildWeekIds()
  const [selectedDay, setSelectedDay] = useState(days[0])
  const language = data.language
  const daySelections = data.selections[selectedDay]
  const totals = getNutritionTotals(daySelections, groups)
  const percentage = data.profile.targetCalories ? totals.calories / data.profile.targetCalories * 100 : 0

  function setPortion(mealId: DietMealId, optionId: string, nextValue: number) {
    const value = Math.max(0, Math.min(4, Math.round(nextValue * 4) / 4))
    const currentDay = data.selections[selectedDay] ?? { breakfast: {}, snack: {}, lunch: {}, dinner: {} }
    const currentMeal = { ...(currentDay[mealId] ?? {}) }
    if (value === 0) delete currentMeal[optionId]
    else currentMeal[optionId] = value
    onChangeData({ ...data, selections: { ...data.selections, [selectedDay]: { ...currentDay, [mealId]: currentMeal } } })
    void Haptics.selectionAsync()
  }

  function resetDay() {
    onChangeData({ ...data, selections: { ...data.selections, [selectedDay]: { breakfast: {}, snack: {}, lunch: {}, dinner: {} } } })
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  return (
    <ScreenScroll theme={theme}>
      <SectionHeader eyebrow={tr(language, 'WEEKLY PLAN', 'الخطة الأسبوعية')} title={tr(language, 'Build your day', 'رتّب يومك')} caption={tr(language, 'Combine multiple choices and adjust each portion in quarter steps.', 'اجمع خيارات متعددة وعدّل كل حصة بخطوات ربع حصة.')} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((day, index) => <Pressable key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, { backgroundColor: day === selectedDay ? theme.primary : theme.surface, borderColor: day === selectedDay ? theme.primary : theme.line }]}><Text style={[styles.dayIndex, { color: day === selectedDay ? '#d8eee6' : theme.muted }]}>{index === 0 ? tr(language, 'TODAY', 'اليوم') : `DAY ${index + 1}`}</Text><Text style={[styles.dayLabel, { color: day === selectedDay ? '#fff' : theme.text }]}>{shortDayLabel(day, language)}</Text></Pressable>)}
      </ScrollView>

      <Card theme={theme} style={styles.summary}>
        <View style={styles.summaryNumbers}><View><Text style={[styles.summaryLabel, { color: theme.muted }]}>{tr(language, 'SELECTED TOTAL', 'المجموع المختار')}</Text><Text style={[styles.summaryValue, { color: theme.text }]}>{Math.round(totals.calories).toLocaleString()} <Text style={[styles.summaryUnit, { color: theme.muted }]}>kcal</Text></Text></View><View style={styles.targetSide}><Text style={[styles.targetLabel, { color: theme.muted }]}>{tr(language, 'Target', 'الهدف')}</Text><Text style={[styles.targetValue, { color: theme.primary }]}>{data.profile.targetCalories.toLocaleString()}</Text></View></View>
        <ProgressBar value={percentage} theme={theme} height={10} />
        <View style={styles.summaryMacros}><Text style={{ color: theme.muted }}>P <Text style={{ color: theme.text, fontWeight: '900' }}>{Math.round(totals.protein)}g</Text></Text><Text style={{ color: theme.muted }}>C <Text style={{ color: theme.text, fontWeight: '900' }}>{Math.round(totals.carbs)}g</Text></Text><Text style={{ color: theme.muted }}>F <Text style={{ color: theme.text, fontWeight: '900' }}>{Math.round(totals.fat)}g</Text></Text></View>
      </Card>

      {groups.map((group) => (
        <View key={group.id} style={styles.groupSection}>
          <View style={styles.groupHeading}><View><Text style={[styles.groupTitle, { color: theme.text }]}>{language === 'ar' ? group.title : group.titleEn}</Text><Text style={[styles.groupSubtitle, { color: theme.muted }]}>{language === 'ar' ? group.subtitle : group.subtitleEn}</Text></View><View style={[styles.groupTime, { backgroundColor: theme.primarySoft }]}><Text style={[styles.groupTimeLabel, { color: theme.primary }]}>{language === 'ar' ? group.time : group.timeEn}</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {group.options.map((option) => {
              const portion = daySelections?.[group.id]?.[option.id] ?? 0
              const selected = portion > 0
              return <Card key={option.id} theme={theme} style={[styles.optionCard, selected && { borderColor: theme.primary, borderWidth: 1.5 }]}>
                <View style={styles.optionTop}><MealImage imageKey={option.imageKey} glyph={option.glyph} size={88} radius={21} />{option.isImported ? <View style={[styles.pdfBadge, { backgroundColor: theme.primary }]}><Text style={styles.pdfBadgeText}>PDF</Text></View> : null}<Text style={[styles.optionCalories, { color: theme.primary }]}>{option.calories} kcal</Text></View>
                <Text numberOfLines={2} style={[styles.optionName, { color: theme.text }]}>{language === 'ar' ? option.name : option.nameEn}</Text>
                <Text numberOfLines={2} style={[styles.optionDescription, { color: theme.muted }]}>{language === 'ar' ? option.description : option.descriptionEn}</Text>
                <View style={styles.optionMacros}><Text style={{ color: theme.muted }}>P {option.protein}g</Text><Text style={{ color: theme.muted }}>C {option.carbs}g</Text><Text style={{ color: theme.muted }}>F {option.fat}g</Text></View>
                {option.videoUrl || option.recipeUrl ? <View style={styles.resourceLinks}>
                  {option.videoUrl ? <Pressable onPress={() => void Linking.openURL(option.videoUrl!)} style={[styles.videoLink, { backgroundColor: theme.primary }]}><Text style={styles.videoLinkText}>{tr(language, '▶ Watch meal video', '▶ شاهد فيديو الوجبة')}</Text></Pressable> : null}
                  {option.recipeUrl ? <Pressable onPress={() => void Linking.openURL(option.recipeUrl!)}><Text style={[styles.recipeLink, { color: theme.primary }]}>{tr(language, 'Open recipe ↗', 'فتح الوصفة ↗')}</Text></Pressable> : null}
                </View> : <View style={styles.recipeSpacer} />}
                <View style={[styles.portionControl, { backgroundColor: selected ? theme.primarySoft : theme.surfaceAlt }]}>
                  <Pressable onPress={() => setPortion(group.id, option.id, portion - 0.25)} style={styles.portionButton}><Text style={[styles.portionButtonText, { color: selected ? theme.primary : theme.muted }]}>−</Text></Pressable>
                  <View style={styles.portionValue}><Text style={[styles.portionNumber, { color: theme.text }]}>{formatPortion(portion)}</Text><Text style={[styles.portionLabel, { color: theme.muted }]}>{tr(language, 'portion', 'حصة')}</Text></View>
                  <Pressable onPress={() => setPortion(group.id, option.id, portion + 0.25)} style={styles.portionButton}><Text style={[styles.portionButtonText, { color: theme.primary }]}>＋</Text></Pressable>
                </View>
              </Card>
            })}
          </ScrollView>
        </View>
      ))}

      <SectionHeader eyebrow={tr(language, 'DAY ACTIONS', 'إجراءات اليوم')} title={tr(language, 'Start again', 'ابدأ من جديد')} caption={tr(language, 'Reset removes every selected meal and immediately resets calories to zero.', 'إعادة الضبط تحذف كل الوجبات وتعيد السعرات إلى صفر فوراً.')} theme={theme} />
      <SecondaryButton label={tr(language, 'Reset selected day', 'إعادة ضبط اليوم المحدد')} onPress={resetDay} danger theme={theme} />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  dayRow: { paddingVertical: 2, gap: 9 },
  dayChip: { minWidth: 92, minHeight: 64, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayIndex: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  dayLabel: { fontSize: 12, fontWeight: '900' },
  summary: { gap: 13 },
  summaryNumbers: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  summaryValue: { marginTop: 2, fontSize: 27, fontWeight: '900', letterSpacing: -0.8 },
  summaryUnit: { fontSize: 11, fontWeight: '700' },
  targetSide: { alignItems: 'flex-end' },
  targetLabel: { fontSize: 10, fontWeight: '700' },
  targetValue: { fontSize: 18, fontWeight: '900' },
  summaryMacros: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 11 },
  groupSection: { gap: 11 },
  groupHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontSize: 20, fontWeight: '900' },
  groupSubtitle: { marginTop: 2, fontSize: 11 },
  groupTime: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11 },
  groupTimeLabel: { fontSize: 10, fontWeight: '900' },
  optionRow: { gap: 11, paddingVertical: 2, paddingRight: 20 },
  optionCard: { width: 254, minHeight: 382, padding: 13, gap: 9 },
  optionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  optionCalories: { fontSize: 11, fontWeight: '900' },
  pdfBadge: { position: 'absolute', left: 65, top: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  pdfBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  optionName: { minHeight: 40, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  optionDescription: { minHeight: 34, fontSize: 11, lineHeight: 17 },
  optionMacros: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 10 },
  resourceLinks: { minHeight: 30, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  videoLink: { minHeight: 29, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  videoLinkText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  recipeLink: { fontSize: 10, fontWeight: '900' },
  recipeSpacer: { height: 13 },
  portionControl: { marginTop: 'auto', height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  portionButton: { width: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  portionButtonText: { fontSize: 24, fontWeight: '700' },
  portionValue: { alignItems: 'center' },
  portionNumber: { fontSize: 16, fontWeight: '900' },
  portionLabel: { fontSize: 8, fontWeight: '700' },
})
