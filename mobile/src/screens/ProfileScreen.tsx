import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppTheme } from '../theme'
import { palette } from '../theme'
import type { ActivityLevel, AppData, HealthGoal, UserProfile } from '../types'
import { Card, FormField, MetricChip, PrimaryButton, ScreenScroll, SectionHeader } from '../components/ui'
import { calculateHealthMetrics } from '../utils/nutrition'
import { tr } from '../i18n'

const activityLevels: Array<{ id: ActivityLevel; en: string; ar: string }> = [
  { id: 'sedentary', en: 'Sedentary', ar: 'قليل الحركة' },
  { id: 'light', en: 'Light', ar: 'خفيف' },
  { id: 'moderate', en: 'Moderate', ar: 'متوسط' },
  { id: 'active', en: 'Active', ar: 'نشيط' },
  { id: 'very-active', en: 'Very active', ar: 'نشيط جداً' },
]

const goals: Array<{ id: HealthGoal; en: string; ar: string; glyph: string }> = [
  { id: 'lose', en: 'Lose', ar: 'خسارة', glyph: '↘' },
  { id: 'maintain', en: 'Maintain', ar: 'ثبات', glyph: '↔' },
  { id: 'gain', en: 'Gain', ar: 'زيادة', glyph: '↗' },
]

export function ProfileScreen({ data, theme, onSave }: { data: AppData; theme: AppTheme; onSave: (profile: UserProfile) => void }) {
  const [draft, setDraft] = useState(data.profile)
  const language = data.language
  const metrics = calculateHealthMetrics(draft)
  useEffect(() => setDraft(data.profile), [data.profile])

  function numberField(key: keyof UserProfile, value: string) {
    setDraft((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  function applyCalculatedTargets() {
    setDraft((current) => ({ ...current, targetCalories: metrics.calories, targetProtein: metrics.protein, targetCarbs: metrics.carbs, targetFat: metrics.fat }))
  }

  return (
    <ScreenScroll theme={theme}>
      <SectionHeader eyebrow={tr(language, 'PERSONAL PROFILE', 'ملفك الشخصي')} title={tr(language, 'Your body, your targets', 'جسمك وأهدافك')} caption={tr(language, 'Edit your profile or calculate a safe planning estimate.', 'عدّل ملفك أو احسب تقديراً آمناً للخطة.')} theme={theme} />
      <Card theme={theme} style={styles.identityCard}><View style={[styles.largeAvatar, { backgroundColor: theme.primarySoft }]}><Text style={[styles.largeAvatarText, { color: theme.primary }]}>{draft.name[0]?.toUpperCase() || 'U'}</Text></View><View style={styles.flex}><Text style={[styles.identityName, { color: theme.text }]}>{draft.name}</Text><Text style={[styles.identityCaption, { color: theme.muted }]}>{tr(language, `${draft.goalWeeks}-week ${draft.goal} plan`, `خطة ${draft.goalWeeks} أسبوعاً`)}</Text></View></Card>

      <SectionHeader eyebrow={tr(language, 'BASICS', 'الأساسيات')} title={tr(language, 'Profile details', 'بيانات الملف')} theme={theme} />
      <Card theme={theme} style={styles.formCard}>
        <FormField label={tr(language, 'Display name', 'اسم العرض')} value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} autoCapitalize="words" theme={theme} rightToLeft={language === 'ar'} />
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label={tr(language, 'Age', 'العمر')} value={String(draft.age)} onChangeText={(value) => numberField('age', value)} keyboardType="number-pad" theme={theme} /></View><View style={styles.flex}><FormField label={tr(language, 'Height (cm)', 'الطول (سم)')} value={String(draft.height)} onChangeText={(value) => numberField('height', value)} keyboardType="number-pad" theme={theme} /></View></View>
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label={tr(language, 'Weight (kg)', 'الوزن (كغ)')} value={String(draft.weight)} onChangeText={(value) => numberField('weight', value)} keyboardType="decimal-pad" theme={theme} /></View><View style={styles.flex}><FormField label={tr(language, 'Target (kg)', 'الوزن الهدف')} value={String(draft.targetWeight)} onChangeText={(value) => numberField('targetWeight', value)} keyboardType="decimal-pad" theme={theme} /></View></View>
        <Text style={[styles.choiceLabel, { color: theme.muted }]}>{tr(language, 'Gender', 'الجنس')}</Text><View style={styles.choiceRow}>{(['male', 'female'] as const).map((gender) => <Pressable key={gender} onPress={() => setDraft({ ...draft, gender })} style={[styles.choice, { backgroundColor: draft.gender === gender ? theme.primary : theme.surfaceAlt, borderColor: draft.gender === gender ? theme.primary : theme.line }]}><Text style={{ color: draft.gender === gender ? '#fff' : theme.text, fontWeight: '800' }}>{tr(language, gender === 'male' ? 'Male' : 'Female', gender === 'male' ? 'ذكر' : 'أنثى')}</Text></Pressable>)}</View>
      </Card>

      <SectionHeader eyebrow={tr(language, 'GOAL', 'الهدف')} title={tr(language, 'Direction and pace', 'الاتجاه والمدة')} theme={theme} />
      <Card theme={theme} style={styles.formCard}>
        <View style={styles.choiceRow}>{goals.map((goal) => <Pressable key={goal.id} onPress={() => setDraft({ ...draft, goal: goal.id })} style={[styles.goalChoice, { backgroundColor: draft.goal === goal.id ? theme.primary : theme.surfaceAlt, borderColor: draft.goal === goal.id ? theme.primary : theme.line }]}><Text style={[styles.goalGlyph, { color: draft.goal === goal.id ? '#fff' : theme.primary }]}>{goal.glyph}</Text><Text style={{ color: draft.goal === goal.id ? '#fff' : theme.text, fontSize: 11, fontWeight: '800' }}>{language === 'ar' ? goal.ar : goal.en}</Text></Pressable>)}</View>
        <FormField label={tr(language, 'Goal duration (weeks)', 'مدة الهدف (أسابيع)')} value={String(draft.goalWeeks)} onChangeText={(value) => numberField('goalWeeks', value)} keyboardType="number-pad" theme={theme} />
        <Text style={[styles.choiceLabel, { color: theme.muted }]}>{tr(language, 'Activity level', 'مستوى النشاط')}</Text><View style={styles.wrapRow}>{activityLevels.map((level) => <Pressable key={level.id} onPress={() => setDraft({ ...draft, activityLevel: level.id })} style={[styles.smallChoice, { backgroundColor: draft.activityLevel === level.id ? theme.primarySoft : theme.surfaceAlt, borderColor: draft.activityLevel === level.id ? theme.primary : theme.line }]}><Text style={{ color: draft.activityLevel === level.id ? theme.primary : theme.text, fontSize: 10, fontWeight: '800' }}>{language === 'ar' ? level.ar : level.en}</Text></Pressable>)}</View>
      </Card>

      <SectionHeader eyebrow={tr(language, 'HEALTH ESTIMATE', 'التقدير الصحي')} title={tr(language, 'Calculated guidance', 'إرشادات محسوبة')} caption={tr(language, 'Planning estimates only—not medical advice.', 'تقديرات للتخطيط وليست نصيحة طبية.')} theme={theme} />
      <Card theme={theme} style={styles.metricsCard}>
        <View style={styles.metricRow}><MetricChip label="BMI" value={metrics.bmi.toFixed(1)} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.green100} /><MetricChip label="BMR" value={`${metrics.bmr}`} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.amberSoft} /><MetricChip label="TDEE" value={`${metrics.tdee}`} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.lilacSoft} /></View>
        <View style={[styles.recommendation, { backgroundColor: theme.primarySoft }]}><Text style={[styles.recommendationLabel, { color: theme.primary }]}>{tr(language, 'RECOMMENDED DAILY TARGET', 'الهدف اليومي المقترح')}</Text><Text style={[styles.recommendationValue, { color: theme.text }]}>{metrics.calories} kcal</Text><Text style={[styles.recommendationMacros, { color: theme.muted }]}>P {metrics.protein}g · C {metrics.carbs}g · F {metrics.fat}g</Text></View>
        <PrimaryButton label={tr(language, 'Apply calculated targets', 'تطبيق الأهداف المحسوبة')} onPress={applyCalculatedTargets} theme={theme} />
      </Card>

      <SectionHeader eyebrow={tr(language, 'CURRENT TARGETS', 'الأهداف الحالية')} title={tr(language, 'Nutrition goals', 'أهداف التغذية')} theme={theme} />
      <Card theme={theme} style={styles.formCard}>
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label="Calories" value={String(draft.targetCalories)} onChangeText={(value) => numberField('targetCalories', value)} keyboardType="number-pad" theme={theme} /></View><View style={styles.flex}><FormField label="Protein (g)" value={String(draft.targetProtein)} onChangeText={(value) => numberField('targetProtein', value)} keyboardType="number-pad" theme={theme} /></View></View>
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label="Carbs (g)" value={String(draft.targetCarbs)} onChangeText={(value) => numberField('targetCarbs', value)} keyboardType="number-pad" theme={theme} /></View><View style={styles.flex}><FormField label="Fat (g)" value={String(draft.targetFat)} onChangeText={(value) => numberField('targetFat', value)} keyboardType="number-pad" theme={theme} /></View></View>
      </Card>
      <PrimaryButton label={tr(language, 'Save profile', 'حفظ الملف')} icon="✓" onPress={() => onSave(draft)} theme={theme} />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  largeAvatar: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  largeAvatarText: { fontSize: 25, fontWeight: '900' },
  identityName: { fontSize: 18, fontWeight: '900' },
  identityCaption: { marginTop: 3, fontSize: 11 },
  formCard: { gap: 14 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  choiceLabel: { fontSize: 10, fontWeight: '900' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 45, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  goalChoice: { flex: 1, minHeight: 75, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  goalGlyph: { fontSize: 21, fontWeight: '900' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  smallChoice: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  metricsCard: { gap: 15 },
  metricRow: { flexDirection: 'row', gap: 8 },
  recommendation: { padding: 17, borderRadius: 18, alignItems: 'center', gap: 3 },
  recommendationLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  recommendationValue: { fontSize: 25, fontWeight: '900' },
  recommendationMacros: { fontSize: 10, fontWeight: '700' },
})
