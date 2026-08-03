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
  const [chartWidth, setChartWidth] = useState(0)
  const language = data.language
  const days = buildWeekIds()
  const totals = days.map((day) => ({ day, totals: getNutritionTotals(data.selections[day], groups, data.fruitMap[day]), habits: completedHabitCount(data, day) }))
  const adherentDays = totals.filter((entry) => entry.totals.calories > 0 && Math.abs(entry.totals.calories - data.profile.targetCalories) <= data.profile.targetCalories * 0.12).length
  const average = Math.round(totals.reduce((sum, entry) => sum + entry.totals.calories, 0) / totals.length)
  const completedHabits = totals.reduce((sum, entry) => sum + entry.habits, 0)
  const weights = data.weights.slice(-8)
  const values = weights.map((entry) => entry.value)
  const rawMinWeight = Math.min(...values, data.profile.weight)
  const rawMaxWeight = Math.max(...values, data.profile.weight)
  const chartPadding = Math.max(0.6, (rawMaxWeight - rawMinWeight) * 0.2)
  const minWeight = Math.floor((rawMinWeight - chartPadding) * 2) / 2
  const maxWeight = Math.ceil((rawMaxWeight + chartPadding) * 2) / 2
  const weightRange = Math.max(1, maxWeight - minWeight)
  const chartHeight = 190
  const plot = { left: 38, right: 14, top: 18, bottom: 37 }
  const plotWidth = Math.max(1, chartWidth - plot.left - plot.right)
  const plotHeight = chartHeight - plot.top - plot.bottom
  const weightPoints = weights.map((entry, index) => ({
    ...entry,
    x: plot.left + (weights.length === 1 ? plotWidth / 2 : (index / (weights.length - 1)) * plotWidth),
    y: plot.top + (1 - (entry.value - minWeight) / weightRange) * plotHeight,
  }))
  const weightTicks = Array.from({ length: 4 }, (_, index) => ({ value: maxWeight - weightRange * index / 3, y: plot.top + plotHeight * index / 3 }))
  const goalY = data.profile.targetWeight >= minWeight && data.profile.targetWeight <= maxWeight ? plot.top + (1 - (data.profile.targetWeight - minWeight) / weightRange) * plotHeight : null
  const weightChange = (weights.at(-1)?.value ?? data.profile.weight) - (weights[0]?.value ?? data.profile.weight)

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
        <View style={styles.weightMetrics}><View style={[styles.weightMetric, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={[styles.weightMetricLabel, { color: theme.muted }]}>{tr(language, 'Total change', 'التغيّر الكلي')}</Text><Text style={[styles.weightMetricValue, { color: weightChange <= 0 ? theme.primary : palette.coral }]}>{weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg</Text></View><View style={[styles.weightMetric, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={[styles.weightMetricLabel, { color: theme.muted }]}>{tr(language, 'To goal', 'إلى الهدف')}</Text><Text style={[styles.weightMetricValue, { color: theme.text }]}>{Math.abs(data.profile.weight - data.profile.targetWeight).toFixed(1)} kg</Text></View></View>
        <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} style={[styles.weightLineChart, { height: chartHeight, backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
          {weightTicks.map((tick) => <View key={tick.value} style={StyleSheet.absoluteFill} pointerEvents="none"><Text style={[styles.weightAxisLabel, { top: tick.y - 6, color: theme.muted }]}>{tick.value.toFixed(1)}</Text><View style={[styles.weightGridLine, { top: tick.y, left: plot.left, right: plot.right, backgroundColor: theme.line }]} /></View>)}
          {goalY !== null ? <><View style={[styles.weightGoalLine, { top: goalY, left: plot.left, right: plot.right, borderColor: palette.amber }]} /><Text style={[styles.weightGoalLabel, { top: goalY - 9, right: plot.right, color: palette.amber, backgroundColor: theme.surface }]}>{tr(language, 'GOAL', 'الهدف')} {data.profile.targetWeight}</Text></> : null}
          {weightPoints.slice(0, -1).map((point, index) => { const next = weightPoints[index + 1]; const length = Math.hypot(next.x - point.x, next.y - point.y); const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI; return <View key={`line-${point.date}`} style={[styles.weightLineSegment, { left: (point.x + next.x) / 2 - length / 2, top: (point.y + next.y) / 2 - 1.5, width: length, backgroundColor: theme.primary, transform: [{ rotate: `${angle}deg` }] }]} /> })}
          {weightPoints.map((point, index) => { const latest = index === weightPoints.length - 1; return <View key={`${point.date}-${point.value}`} pointerEvents="none"><View style={[styles.weightPointHalo, { left: point.x - 8, top: point.y - 8, backgroundColor: latest ? theme.primarySoft : 'transparent' }]} /><View style={[styles.weightPoint, { left: point.x - 5, top: point.y - 5, borderColor: theme.primary, backgroundColor: theme.surface }]} />{latest ? <Text style={[styles.weightPointValue, { left: Math.max(plot.left, Math.min(chartWidth - 70, point.x - 28)), top: Math.max(2, point.y - 30), color: theme.primary, backgroundColor: theme.surface }]}>{point.value} kg</Text> : null}<Text style={[styles.weightDate, { left: point.x - 24, color: theme.muted }]}>{point.date.slice(5)}</Text></View> })}
          {!weights.length ? <Text style={[styles.weightEmpty, { color: theme.muted }]}>{tr(language, 'Add your first entry to start the chart.', 'أضف أول قياس لبدء الرسم البياني.')}</Text> : null}
        </View>
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
  weightMetrics: { flexDirection: 'row', gap: 8 },
  weightMetric: { flex: 1, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 12, gap: 3 },
  weightMetricLabel: { fontSize: 9, fontWeight: '700' },
  weightMetricValue: { fontSize: 13, fontWeight: '900' },
  weightLineChart: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: 16 },
  weightAxisLabel: { position: 'absolute', left: 6, width: 28, fontSize: 7, fontWeight: '700', textAlign: 'right' },
  weightGridLine: { position: 'absolute', height: StyleSheet.hairlineWidth },
  weightGoalLine: { position: 'absolute', borderTopWidth: 1, borderStyle: 'dashed' },
  weightGoalLabel: { position: 'absolute', overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, fontSize: 7, fontWeight: '900' },
  weightLineSegment: { position: 'absolute', height: 3, borderRadius: 3 },
  weightPointHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  weightPoint: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  weightPointValue: { position: 'absolute', width: 58, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 7, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  weightDate: { position: 'absolute', bottom: 6, width: 48, fontSize: 7, fontWeight: '700', textAlign: 'center' },
  weightEmpty: { position: 'absolute', right: 34, bottom: 56, left: 45, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  weightForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  weightInput: { flex: 1 },
  weightButton: { width: 100 },
  habitDays: { flexDirection: 'row', gap: 7 },
  habitDay: { flex: 1, paddingVertical: 11, borderRadius: 15, borderWidth: 1, alignItems: 'center', gap: 5 },
  habitCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  habitDayLabel: { fontSize: 7, fontWeight: '800' },
})
