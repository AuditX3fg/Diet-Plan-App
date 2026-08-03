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
  const [selectedWeightIndex, setSelectedWeightIndex] = useState<number | null>(null)
  const language = data.language
  const days = buildWeekIds()
  const totals = days.map((day) => ({ day, totals: getNutritionTotals(data.selections[day], groups, data.fruitMap[day]), habits: completedHabitCount(data, day) }))
  const adherentDays = totals.filter((entry) => entry.totals.calories > 0 && Math.abs(entry.totals.calories - data.profile.targetCalories) <= data.profile.targetCalories * 0.12).length
  const average = Math.round(totals.reduce((sum, entry) => sum + entry.totals.calories, 0) / totals.length)
  const completedHabits = totals.reduce((sum, entry) => sum + entry.habits, 0)
  const weights = data.weights.slice(-8)
  const values = weights.map((entry) => entry.value)
  const domainValues = values.length ? values : [data.profile.weight]
  const rawMinWeight = Math.min(...domainValues)
  const rawMaxWeight = Math.max(...domainValues)
  const chartPadding = Math.max(0.5, (rawMaxWeight - rawMinWeight) * 0.3)
  const minWeight = Math.floor((rawMinWeight - chartPadding) * 2) / 2
  const maxWeight = Math.ceil((rawMaxWeight + chartPadding) * 2) / 2
  const weightRange = Math.max(1, maxWeight - minWeight)
  const chartHeight = 220
  const plot = { left: 44, right: 18, top: 30, bottom: 42 }
  const plotWidth = Math.max(1, chartWidth - plot.left - plot.right)
  const plotHeight = chartHeight - plot.top - plot.bottom
  const weightPoints = weights.map((entry, index) => ({
    ...entry,
    x: plot.left + (weights.length === 1 ? plotWidth / 2 : (index / (weights.length - 1)) * plotWidth),
    y: plot.top + (1 - (entry.value - minWeight) / weightRange) * plotHeight,
  }))
  const weightTicks = Array.from({ length: 4 }, (_, index) => ({ value: maxWeight - weightRange * index / 3, y: plot.top + plotHeight * index / 3 }))
  const goalY = data.profile.targetWeight >= minWeight && data.profile.targetWeight <= maxWeight ? plot.top + (1 - (data.profile.targetWeight - minWeight) / weightRange) * plotHeight : null
  const latestWeight = weights.at(-1)?.value ?? data.profile.weight
  const firstWeight = weights[0]?.value ?? latestWeight
  const weightChange = latestWeight - firstWeight
  const highlightedWeightIndex = selectedWeightIndex ?? weightPoints.length - 1
  const highlightedWeight = weightPoints[highlightedWeightIndex]
  const highlightedWeightDelta = highlightedWeight && highlightedWeightIndex > 0 ? highlightedWeight.value - weightPoints[highlightedWeightIndex - 1].value : null
  const weightChartSummary = tr(language, `Weight changed from ${firstWeight.toFixed(1)} to ${latestWeight.toFixed(1)} kg. Goal ${data.profile.targetWeight.toFixed(1)} kg.`, `تغيّر الوزن من ${firstWeight.toFixed(1)} إلى ${latestWeight.toFixed(1)} كغ. الهدف ${data.profile.targetWeight.toFixed(1)} كغ.`)

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
        <View style={styles.cardHeading}><View><Text style={[styles.cardTitle, { color: theme.text }]}>{tr(language, 'Weight journey', 'رحلة الوزن')}</Text><Text style={[styles.cardCaption, { color: theme.muted }]}>{tr(language, 'Tap any point for the exact measurement', 'اضغط على أي نقطة لعرض القياس الدقيق')}</Text></View><View style={[styles.currentWeightPill, { backgroundColor: theme.primarySoft }]}><Text style={[styles.currentWeightLabel, { color: theme.primary }]}>{tr(language, 'CURRENT', 'الحالي')}</Text><Text style={[styles.currentWeight, { color: theme.primary }]}>{latestWeight.toFixed(1)} kg</Text></View></View>
        <View style={styles.weightLegend}><View style={styles.weightLegendItem}><View style={[styles.weightLegendSolid, { backgroundColor: theme.primary }]} /><Text style={[styles.weightLegendText, { color: theme.muted }]}>{tr(language, 'Weight', 'الوزن')}</Text></View><View style={styles.weightLegendItem}><View style={[styles.weightLegendDash, { borderColor: palette.amber }]} /><Text style={[styles.weightLegendText, { color: theme.muted }]}>{tr(language, `Goal ${data.profile.targetWeight} kg`, `الهدف ${data.profile.targetWeight} كغ`)}</Text></View></View>
        <View style={styles.weightMetrics}><View style={[styles.weightMetric, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={[styles.weightMetricLabel, { color: theme.muted }]}>{tr(language, 'Total change', 'التغيّر الكلي')}</Text><Text style={[styles.weightMetricValue, { color: weightChange <= 0 ? theme.primary : palette.coral }]}>{weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg</Text></View><View style={[styles.weightMetric, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}><Text style={[styles.weightMetricLabel, { color: theme.muted }]}>{tr(language, 'To goal', 'إلى الهدف')}</Text><Text style={[styles.weightMetricValue, { color: theme.text }]}>{Math.abs(latestWeight - data.profile.targetWeight).toFixed(1)} kg</Text></View></View>
        <View accessible accessibilityRole="image" accessibilityLabel={weightChartSummary} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} style={[styles.weightLineChart, { height: chartHeight, backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
          {weightTicks.map((tick) => <View key={tick.value} style={StyleSheet.absoluteFill} pointerEvents="none"><Text style={[styles.weightAxisLabel, { top: tick.y - 7, color: theme.muted }]}>{tick.value.toFixed(1)}</Text><View style={[styles.weightGridLine, { top: tick.y, left: plot.left, right: plot.right, backgroundColor: theme.line }]} /></View>)}
          {goalY !== null ? <><View style={[styles.weightGoalLine, { top: goalY, left: plot.left, right: plot.right, borderColor: palette.amber }]} /><Text style={[styles.weightGoalLabel, { top: goalY - 11, right: plot.right, color: palette.amber, backgroundColor: theme.surface }]}>{tr(language, 'GOAL', 'الهدف')} {data.profile.targetWeight}</Text></> : null}
          {weightPoints.slice(0, -1).map((point, index) => { const next = weightPoints[index + 1]; const length = Math.hypot(next.x - point.x, next.y - point.y); const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI; return <View key={`line-${point.date}`} pointerEvents="none" style={[styles.weightLineSegment, { left: (point.x + next.x) / 2 - length / 2, top: (point.y + next.y) / 2 - 1.5, width: length, backgroundColor: theme.primary, transform: [{ rotate: `${angle}deg` }] }]} /> })}
          {weightPoints.map((point, index) => { const latest = index === weightPoints.length - 1; const selected = index === highlightedWeightIndex; return <Pressable accessibilityRole="button" accessibilityLabel={`${point.date}, ${point.value.toFixed(1)} kilograms`} key={`${point.date}-${point.value}`} hitSlop={2} onPress={() => setSelectedWeightIndex(index)} style={[styles.weightPointTarget, { left: point.x - 22, top: point.y - 22 }]}><View style={[styles.weightPointHalo, { backgroundColor: latest || selected ? theme.primarySoft : 'transparent' }]}><View style={[styles.weightPoint, { width: selected ? 13 : 10, height: selected ? 13 : 10, borderRadius: selected ? 7 : 5, borderColor: theme.primary, backgroundColor: theme.surface }]} /></View></Pressable> })}
          {weightPoints.map((point, index) => { const labelEvery = Math.max(1, Math.ceil(weightPoints.length / 4)); const visible = index === 0 || index === weightPoints.length - 1 || index % labelEvery === 0; return visible ? <Text key={`${point.date}-label`} pointerEvents="none" style={[styles.weightDate, { left: point.x - 25, color: theme.muted }]}>{point.date.slice(5)}</Text> : null })}
          {highlightedWeight ? <View pointerEvents="none" style={[styles.weightTooltip, { left: Math.max(plot.left, Math.min(chartWidth - 106, highlightedWeight.x - 48)), top: Math.max(4, highlightedWeight.y - 57), backgroundColor: theme.surface, borderColor: theme.line }]}><Text style={[styles.weightTooltipDate, { color: theme.muted }]}>{highlightedWeight.date}</Text><View style={styles.weightTooltipValueRow}><Text style={[styles.weightTooltipValue, { color: theme.text }]}>{highlightedWeight.value.toFixed(1)} kg</Text><Text style={[styles.weightTooltipDelta, { color: highlightedWeightDelta === null || highlightedWeightDelta <= 0 ? theme.primary : palette.coral }]}>{highlightedWeightDelta === null ? tr(language, 'Start', 'البداية') : `${highlightedWeightDelta > 0 ? '+' : ''}${highlightedWeightDelta.toFixed(1)}`}</Text></View></View> : null}
          {!weights.length ? <Text style={[styles.weightEmpty, { color: theme.muted }]}>{tr(language, 'Add your first entry to start the chart.', 'أضف أول قياس لبدء الرسم البياني.')}</Text> : null}
        </View>
        <View style={[styles.weightInsight, { backgroundColor: theme.primarySoft, borderColor: theme.line }]}><View style={[styles.weightInsightMark, { backgroundColor: theme.primary }]} /><View style={styles.flex}><Text style={[styles.weightInsightTitle, { color: theme.text }]}>{weightChange <= 0 ? tr(language, 'Trending toward your goal', 'الاتجاه يسير نحو هدفك') : tr(language, 'A slight upward trend', 'ارتفاع بسيط في الاتجاه')}</Text><Text style={[styles.weightInsightBody, { color: theme.muted }]}>{tr(language, `${Math.abs(weightChange).toFixed(1)} kg total change · ${Math.abs(latestWeight - data.profile.targetWeight).toFixed(1)} kg remaining`, `تغيّر كلي ${Math.abs(weightChange).toFixed(1)} كغ · متبقي ${Math.abs(latestWeight - data.profile.targetWeight).toFixed(1)} كغ`)}</Text></View></View>
        <View style={styles.weightForm}><View style={styles.weightInput}><FormField label={tr(language, 'Current weight (kg)', 'الوزن الحالي (كغ)')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" theme={theme} /></View><View style={styles.weightButton}><PrimaryButton label={tr(language, 'Add', 'إضافة')} onPress={addWeight} theme={theme} /></View></View>
      </Card>

      <SectionHeader eyebrow={tr(language, 'MOMENTUM', 'الاستمرارية')} title={tr(language, 'This week’s habits', 'عادات هذا الأسبوع')} theme={theme} />
      <View style={styles.habitDays}>{days.map((day, index) => <Pressable key={day} style={[styles.habitDay, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.habitCircle, { backgroundColor: completedHabitCount(data, day) === 6 ? theme.primary : theme.surfaceAlt }]}><Text style={{ color: completedHabitCount(data, day) === 6 ? '#fff' : theme.muted, fontWeight: '900' }}>{completedHabitCount(data, day)}</Text></View><Text style={[styles.habitDayLabel, { color: theme.muted }]}>{index === 0 ? tr(language, 'Today', 'اليوم') : shortDayLabel(day, language)}</Text></Pressable>)}</View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  currentWeightPill: { minWidth: 78, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, alignItems: 'flex-end', gap: 1 },
  currentWeightLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  currentWeight: { fontSize: 17, fontWeight: '900', lineHeight: 20 },
  weightLegend: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  weightLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightLegendSolid: { width: 20, height: 3, borderRadius: 2 },
  weightLegendDash: { width: 20, borderTopWidth: 2, borderStyle: 'dashed' },
  weightLegendText: { fontSize: 9, fontWeight: '700' },
  weightMetrics: { flexDirection: 'row', gap: 8 },
  weightMetric: { flex: 1, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 12, gap: 3 },
  weightMetricLabel: { fontSize: 9, fontWeight: '700' },
  weightMetricValue: { fontSize: 13, fontWeight: '900' },
  weightLineChart: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: 18 },
  weightAxisLabel: { position: 'absolute', left: 5, width: 31, fontSize: 8.5, fontWeight: '700', textAlign: 'right' },
  weightGridLine: { position: 'absolute', height: StyleSheet.hairlineWidth },
  weightGoalLine: { position: 'absolute', borderTopWidth: 1, borderStyle: 'dashed' },
  weightGoalLabel: { position: 'absolute', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, fontSize: 8, fontWeight: '900' },
  weightLineSegment: { position: 'absolute', height: 3, borderRadius: 3 },
  weightPointTarget: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weightPointHalo: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weightPoint: { borderWidth: 2.5 },
  weightDate: { position: 'absolute', bottom: 9, width: 50, fontSize: 8.5, fontWeight: '700', textAlign: 'center' },
  weightTooltip: { position: 'absolute', zIndex: 5, width: 100, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderRadius: 11, gap: 2, shadowColor: '#10261f', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.09, shadowRadius: 10, elevation: 3 },
  weightTooltipDate: { fontSize: 7.5, fontWeight: '700' },
  weightTooltipValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 5 },
  weightTooltipValue: { fontSize: 13, fontWeight: '900' },
  weightTooltipDelta: { fontSize: 8, fontWeight: '900' },
  weightEmpty: { position: 'absolute', right: 34, bottom: 56, left: 45, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  weightInsight: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderRadius: 13 },
  weightInsightMark: { width: 4, minHeight: 37, borderRadius: 3 },
  weightInsightTitle: { fontSize: 11, fontWeight: '900', lineHeight: 15 },
  weightInsightBody: { marginTop: 2, fontSize: 9, lineHeight: 13 },
  weightForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  weightInput: { flex: 1 },
  weightButton: { width: 100 },
  habitDays: { flexDirection: 'row', gap: 7 },
  habitDay: { flex: 1, paddingVertical: 11, borderRadius: 15, borderWidth: 1, alignItems: 'center', gap: 5 },
  habitCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  habitDayLabel: { fontSize: 7, fontWeight: '800' },
})
