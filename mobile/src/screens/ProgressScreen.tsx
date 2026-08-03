import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppTheme } from '../theme'
import type { AppData, MealGroup } from '../types'
import { Card, FormField, PrimaryButton, ProgressBar, ScreenScroll, SectionHeader } from '../components/ui'
import { buildWeekIds, completedHabitCount, getNutritionTotals, shortDayLabel } from '../utils/nutrition'
import { tr } from '../i18n'
import { palette } from '../theme'

export function ProgressScreen({ data, groups, theme, onChangeData }: { data: AppData; groups: MealGroup[]; theme: AppTheme; onChangeData: (next: AppData) => void }) {
  const [weight, setWeight] = useState(String(data.profile.weight))
  const language = data.language
  const days = buildWeekIds()
  const totals = days.map((day) => ({ day, totals: getNutritionTotals(data.selections[day], groups, data.fruitMap[day]), habits: completedHabitCount(data, day) }))
  const adherentDays = totals.filter((entry) => entry.totals.calories > 0 && Math.abs(entry.totals.calories - data.profile.targetCalories) <= data.profile.targetCalories * 0.12).length
  const average = Math.round(totals.reduce((sum, entry) => sum + entry.totals.calories, 0) / totals.length)
  const completedHabits = totals.reduce((sum, entry) => sum + entry.habits, 0)
  const weights = data.weights.slice(-8)
  const values = weights.map((entry) => entry.value)
  const minWeight = Math.min(...values, data.profile.weight) - 0.5
  const maxWeight = Math.max(...values, data.profile.weight) + 0.5

  function addWeight() {
    const value = Number(weight)
    if (!Number.isFinite(value) || value < 30 || value > 300) return
    const today = new Date().toISOString().slice(0, 10)
    const weightsNext = [...data.weights.filter((entry) => entry.date !== today), { date: today, value }].slice(-20)
    onChangeData({ ...data, profile: { ...data.profile, weight: value }, weights: weightsNext })
  }

  return (
    <ScreenScroll theme={theme}>
      <SectionHeader eyebrow={tr(language, 'YOUR PROGRESS', 'تقدمك')} title={tr(language, 'Small wins add up', 'الخطوات الصغيرة تصنع الفرق')} caption={tr(language, 'Nutrition, habits, and weight in one weekly view.', 'التغذية والعادات والوزن في نظرة أسبوعية واحدة.')} theme={theme} />
      <View style={styles.overviewRow}>
        <Card theme={theme} style={styles.overviewCard}><Text style={styles.overviewGlyph}>◎</Text><Text style={[styles.overviewValue, { color: theme.text }]}>{adherentDays}/7</Text><Text style={[styles.overviewLabel, { color: theme.muted }]}>{tr(language, 'days on target', 'أيام ضمن الهدف')}</Text></Card>
        <Card theme={theme} style={styles.overviewCard}><Text style={styles.overviewGlyph}>⌁</Text><Text style={[styles.overviewValue, { color: theme.text }]}>{average}</Text><Text style={[styles.overviewLabel, { color: theme.muted }]}>{tr(language, 'avg kcal', 'متوسط السعرات')}</Text></Card>
        <Card theme={theme} style={styles.overviewCard}><Text style={styles.overviewGlyph}>✓</Text><Text style={[styles.overviewValue, { color: theme.text }]}>{completedHabits}</Text><Text style={[styles.overviewLabel, { color: theme.muted }]}>{tr(language, 'habits done', 'عادة مكتملة')}</Text></Card>
      </View>

      <Card theme={theme} style={styles.chartCard}>
        <View style={styles.cardHeading}><View><Text style={[styles.cardTitle, { color: theme.text }]}>{tr(language, 'Calorie consistency', 'ثبات السعرات')}</Text><Text style={[styles.cardCaption, { color: theme.muted }]}>{tr(language, 'Compared with your daily target', 'مقارنة بهدفك اليومي')}</Text></View><View style={[styles.targetPill, { backgroundColor: theme.primarySoft }]}><Text style={[styles.targetPillText, { color: theme.primary }]}>{data.profile.targetCalories} kcal</Text></View></View>
        <View style={styles.weekList}>{totals.map((entry, index) => { const ratio = data.profile.targetCalories ? entry.totals.calories / data.profile.targetCalories * 100 : 0; return <View key={entry.day} style={styles.weekRow}><Text style={[styles.weekLabel, { color: theme.muted }]}>{index === 0 ? tr(language, 'Today', 'اليوم') : shortDayLabel(entry.day, language)}</Text><View style={styles.weekProgress}><ProgressBar value={ratio} theme={theme} color={ratio > 112 ? palette.coral : theme.primary} height={9} /></View><Text style={[styles.weekValue, { color: theme.text }]}>{Math.round(entry.totals.calories)}</Text></View> })}</View>
      </Card>

      <Card theme={theme} style={styles.chartCard}>
        <View style={styles.cardHeading}><View><Text style={[styles.cardTitle, { color: theme.text }]}>{tr(language, 'Weight trend', 'تطور الوزن')}</Text><Text style={[styles.cardCaption, { color: theme.muted }]}>{tr(language, `Goal ${data.profile.targetWeight} kg`, `الهدف ${data.profile.targetWeight} كغ`)}</Text></View><Text style={[styles.currentWeight, { color: theme.primary }]}>{data.profile.weight} kg</Text></View>
        <View style={styles.weightChart}>{weights.map((entry, index) => { const height = 30 + (entry.value - minWeight) / Math.max(1, maxWeight - minWeight) * 90; return <View key={`${entry.date}-${index}`} style={styles.weightColumn}><Text style={[styles.weightValue, { color: theme.muted }]}>{entry.value}</Text><View style={[styles.weightBar, { height, backgroundColor: index === weights.length - 1 ? theme.primary : theme.primarySoft }]} /><Text style={[styles.weightDate, { color: theme.muted }]}>{entry.date.slice(5)}</Text></View> })}</View>
        <View style={styles.weightForm}><View style={styles.weightInput}><FormField label={tr(language, 'Current weight (kg)', 'الوزن الحالي (كغ)')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" theme={theme} /></View><View style={styles.weightButton}><PrimaryButton label={tr(language, 'Add', 'إضافة')} onPress={addWeight} theme={theme} /></View></View>
      </Card>

      <SectionHeader eyebrow={tr(language, 'MOMENTUM', 'الاستمرارية')} title={tr(language, 'This week’s habits', 'عادات هذا الأسبوع')} theme={theme} />
      <View style={styles.habitDays}>{days.map((day, index) => <Pressable key={day} style={[styles.habitDay, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.habitCircle, { backgroundColor: completedHabitCount(data, day) === 6 ? theme.primary : theme.surfaceAlt }]}><Text style={{ color: completedHabitCount(data, day) === 6 ? '#fff' : theme.muted, fontWeight: '900' }}>{completedHabitCount(data, day)}</Text></View><Text style={[styles.habitDayLabel, { color: theme.muted }]}>{index === 0 ? tr(language, 'Today', 'اليوم') : shortDayLabel(day, language)}</Text></Pressable>)}</View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  overviewRow: { flexDirection: 'row', gap: 9 },
  overviewCard: { flex: 1, minHeight: 120, padding: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  overviewGlyph: { color: palette.green700, fontSize: 20, fontWeight: '900' },
  overviewValue: { fontSize: 22, fontWeight: '900' },
  overviewLabel: { textAlign: 'center', fontSize: 9, lineHeight: 13, fontWeight: '700' },
  chartCard: { gap: 19 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardCaption: { marginTop: 3, fontSize: 10 },
  targetPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  targetPillText: { fontSize: 9, fontWeight: '900' },
  weekList: { gap: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekLabel: { width: 48, fontSize: 9, fontWeight: '700' },
  weekProgress: { flex: 1 },
  weekValue: { width: 36, textAlign: 'right', fontSize: 10, fontWeight: '900' },
  currentWeight: { fontSize: 19, fontWeight: '900' },
  weightChart: { height: 164, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  weightColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  weightValue: { fontSize: 8, fontWeight: '800' },
  weightBar: { width: '68%', minHeight: 24, borderRadius: 8 },
  weightDate: { fontSize: 7, fontWeight: '700' },
  weightForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  weightInput: { flex: 1 },
  weightButton: { width: 100 },
  habitDays: { flexDirection: 'row', gap: 7 },
  habitDay: { flex: 1, paddingVertical: 11, borderRadius: 15, borderWidth: 1, alignItems: 'center', gap: 5 },
  habitCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  habitDayLabel: { fontSize: 7, fontWeight: '800' },
})
