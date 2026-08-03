import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppTheme } from '../theme'
import { palette } from '../theme'
import type { AppData, Language, MealGroup } from '../types'
import { Card, MetricChip, ProgressBar, ScreenScroll, SectionHeader } from '../components/ui'
import { MealImage } from '../components/MealImage'
import { getNutritionTotals, longDateLabel, selectionSummary } from '../utils/nutrition'
import { tr } from '../i18n'

export function TodayScreen({ data, groups, theme, onChangeData, onOpenPlan }: {
  data: AppData
  groups: MealGroup[]
  theme: AppTheme
  onChangeData: (next: AppData) => void
  onOpenPlan: () => void
}) {
  const todayId = new Date().toISOString().slice(0, 10)
  const language = data.language
  const totals = getNutritionTotals(data.selections[todayId], groups, data.fruitMap[todayId])
  const calorieProgress = data.profile.targetCalories > 0 ? totals.calories / data.profile.targetCalories * 100 : 0
  const remaining = Math.max(0, Math.round(data.profile.targetCalories - totals.calories))
  const water = data.waterByDay[todayId] ?? 0
  const firstName = data.profile.name.trim().split(' ')[0] || tr(language, 'User', 'مستخدم')

  return (
    <ScreenScroll theme={theme}>
      <View style={styles.header}>
        <View><Text style={[styles.date, { color: theme.muted }]}>{longDateLabel(todayId, language)}</Text><Text style={[styles.hello, { color: theme.text }]}>{tr(language, `Hello, ${firstName}`, `مرحباً، ${firstName}`)} <Text>👋</Text></Text></View>
        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}><Text style={[styles.avatarText, { color: theme.primary }]}>{firstName[0]?.toUpperCase()}</Text></View>
      </View>

      <LinearGradient colors={theme.dark ? ['#285a49', '#193d32'] : ['#2b745e', '#1e5545']} style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryKicker}>{tr(language, 'TODAY’S NUTRITION', 'تغذية اليوم')}</Text><Text style={styles.summaryTitle}>{tr(language, 'Your daily balance', 'توازنك اليومي')}</Text></View><View style={styles.flame}><Text style={styles.flameText}>✦</Text></View></View>
        <View style={styles.calorieRow}>
          <View style={styles.ring}><Text style={styles.ringValue}>{Math.round(totals.calories).toLocaleString()}</Text><Text style={styles.ringUnit}>kcal</Text></View>
          <View style={styles.calorieCopy}><Text style={styles.targetText}>{tr(language, 'Daily target', 'الهدف اليومي')}</Text><Text style={styles.targetValue}>{data.profile.targetCalories.toLocaleString()} kcal</Text><Text style={styles.remaining}>{remaining} {tr(language, 'kcal remaining', 'سعرة متبقية')}</Text><ProgressBar value={calorieProgress} theme={theme} color="#cce9dc" height={7} /></View>
        </View>
        <View style={styles.macroRow}>
          <View style={styles.macro}><Text style={styles.macroValue}>{Math.round(totals.protein)}g</Text><Text style={styles.macroLabel}>{tr(language, 'Protein', 'بروتين')}</Text></View>
          <View style={styles.macroDivider} />
          <View style={styles.macro}><Text style={styles.macroValue}>{Math.round(totals.carbs)}g</Text><Text style={styles.macroLabel}>{tr(language, 'Carbs', 'كربوهيدرات')}</Text></View>
          <View style={styles.macroDivider} />
          <View style={styles.macro}><Text style={styles.macroValue}>{Math.round(totals.fat)}g</Text><Text style={styles.macroLabel}>{tr(language, 'Fat', 'دهون')}</Text></View>
        </View>
      </LinearGradient>

      <Card theme={theme}>
        <View style={styles.waterHeader}><View><Text style={[styles.waterTitle, { color: theme.text }]}>{tr(language, 'Hydration', 'الماء')}</Text><Text style={[styles.waterCaption, { color: theme.muted }]}>{water} {tr(language, 'of 8 glasses', 'من ٨ أكواب')}</Text></View><Text style={styles.waterEmoji}>💧</Text></View>
        <View style={styles.waterRow}>{Array.from({ length: 8 }, (_, index) => <Pressable key={index} onPress={() => onChangeData({ ...data, waterByDay: { ...data.waterByDay, [todayId]: index + 1 === water ? index : index + 1 } })} style={[styles.waterDrop, { backgroundColor: index < water ? '#5b9ec4' : theme.surfaceAlt, borderColor: index < water ? '#5b9ec4' : theme.line }]}><Text style={{ opacity: index < water ? 1 : 0.32 }}>•</Text></Pressable>)}</View>
      </Card>

      <SectionHeader eyebrow={tr(language, 'TODAY’S SCHEDULE', 'جدول اليوم')} title={tr(language, 'Your planned meals', 'وجباتك المخططة')} caption={tr(language, 'Tap edit to change portions or combine options.', 'عدّل الحصص أو اجمع أكثر من خيار.')} theme={theme} action={<Pressable onPress={onOpenPlan} style={[styles.editButton, { backgroundColor: theme.primarySoft }]}><Text style={[styles.editLabel, { color: theme.primary }]}>{tr(language, 'Edit', 'تعديل')}</Text></Pressable>} />
      <View style={styles.mealList}>
        {groups.map((group) => {
          const items = selectionSummary(group, data.selections[todayId], language)
          const calories = items.reduce((sum, item) => sum + item.option.calories * item.portion, 0)
          const primary = items[0]?.option ?? group.options[0]
          return <Pressable key={group.id} onPress={onOpenPlan}><Card theme={theme} style={styles.mealCard}><MealImage imageKey={primary.imageKey} glyph={group.options[0].glyph} size={70} radius={19} /><View style={styles.mealCopy}><View style={styles.mealMeta}><Text style={[styles.mealType, { color: theme.primary }]}>{language === 'ar' ? group.title : group.titleEn}</Text><Text style={[styles.mealTime, { color: theme.muted }]}>{language === 'ar' ? group.time : group.timeEn}</Text></View><Text numberOfLines={2} style={[styles.mealSelection, { color: theme.text }]}>{items.length ? items.map((item) => `${item.portion}× ${item.name}`).join(' + ') : tr(language, 'No options selected', 'لم يتم اختيار وجبة')}</Text><Text style={[styles.mealSub, { color: theme.muted }]}>{items.length} {tr(language, 'options', 'خيارات')} · {Math.round(calories)} kcal</Text></View><Text style={[styles.chevron, { color: theme.muted }]}>›</Text></Card></Pressable>
        })}
      </View>

      <SectionHeader eyebrow={tr(language, 'YOUR TARGETS', 'أهدافك')} title={tr(language, 'Macro overview', 'نظرة على المغذيات')} theme={theme} />
      <View style={styles.targetRow}>
        <MetricChip label={tr(language, 'protein target', 'هدف البروتين')} value={`${data.profile.targetProtein}g`} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.amberSoft} />
        <MetricChip label={tr(language, 'carb target', 'هدف الكربوهيدرات')} value={`${data.profile.targetCarbs}g`} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.lilacSoft} />
        <MetricChip label={tr(language, 'fat target', 'هدف الدهون')} value={`${data.profile.targetFat}g`} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.coralSoft} />
      </View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  header: { paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 11, fontWeight: '700' },
  hello: { marginTop: 3, fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 },
  avatar: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  summaryCard: { borderRadius: 28, padding: 20, gap: 18, overflow: 'hidden' },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKicker: { color: '#b9deD1', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  summaryTitle: { marginTop: 4, color: '#fff', fontSize: 20, fontWeight: '900' },
  flame: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.13)', alignItems: 'center', justifyContent: 'center' },
  flameText: { color: '#fff3bb', fontSize: 20 },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: { width: 108, height: 108, borderRadius: 54, borderWidth: 9, borderColor: '#8ac5b0', backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  ringUnit: { color: '#b9ded1', fontSize: 10, fontWeight: '700' },
  calorieCopy: { flex: 1, gap: 5 },
  targetText: { color: '#b9ded1', fontSize: 10, fontWeight: '800' },
  targetValue: { color: '#fff', fontSize: 19, fontWeight: '900' },
  remaining: { marginBottom: 4, color: '#d8eee6', fontSize: 11 },
  macroRow: { minHeight: 59, paddingHorizontal: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.09)', flexDirection: 'row', alignItems: 'center' },
  macro: { flex: 1, alignItems: 'center', gap: 2 },
  macroValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  macroLabel: { color: '#b9ded1', fontSize: 18, fontWeight: '700' },
  macroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,.14)' },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterTitle: { fontSize: 16, fontWeight: '900' },
  waterCaption: { marginTop: 2, fontSize: 11 },
  waterEmoji: { fontSize: 24 },
  waterRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  waterDrop: { flex: 1, aspectRatio: 1, maxWidth: 35, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editButton: { minHeight: 36, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editLabel: { fontSize: 11, fontWeight: '900' },
  mealList: { gap: 10 },
  mealCard: { minHeight: 106, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  mealCopy: { flex: 1, gap: 5 },
  mealMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mealType: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  mealTime: { fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5 },
  mealSelection: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  mealSub: { fontSize: 10 },
  chevron: { fontSize: 25, fontWeight: '300' },
  targetRow: { flexDirection: 'row', gap: 9 },
})
