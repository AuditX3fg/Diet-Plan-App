import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppTheme } from '../theme'
import { palette } from '../theme'
import type { AccountUpdateInput, ActivityLevel, AppData, HealthGoal, UserAccount, UserProfile } from '../types'
import { Card, FormField, MetricChip, PrimaryButton, ScreenScroll, SectionHeader } from '../components/ui'
import { calculateHealthMetrics } from '../utils/nutrition'
import type { HealthProfileIssue } from '../utils/nutrition'
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

const issueLabels: Record<HealthProfileIssue, { en: string; ar: string }> = {
  age: { en: 'Age must be 20–100 for the adult calculator.', ar: 'العمر يجب أن يكون بين ٢٠ و١٠٠ سنة لاستخدام حاسبة البالغين.' },
  height: { en: 'Height must be between 120 and 230 cm.', ar: 'الطول يجب أن يكون بين ١٢٠ و٢٣٠ سم.' },
  weight: { en: 'Weight must be between 30 and 300 kg.', ar: 'الوزن يجب أن يكون بين ٣٠ و٣٠٠ كغ.' },
  targetWeight: { en: 'Target weight must be between 30 and 300 kg.', ar: 'الوزن المستهدف يجب أن يكون بين ٣٠ و٣٠٠ كغ.' },
  goalWeeks: { en: 'Goal duration must be between 1 and 104 weeks.', ar: 'مدة الهدف يجب أن تكون بين أسبوع و١٠٤ أسابيع.' },
  goalDirection: { en: 'Target weight does not match the selected goal direction.', ar: 'الوزن المستهدف لا يطابق اتجاه الهدف المختار.' },
  targetCalories: { en: 'Calories must be between 1,000 and 5,000.', ar: 'السعرات يجب أن تكون بين ١٠٠٠ و٥٠٠٠.' },
  targetProtein: { en: 'Protein must be between 20 and 400 g.', ar: 'البروتين يجب أن يكون بين ٢٠ و٤٠٠ غ.' },
  targetCarbs: { en: 'Carbohydrates must be between 20 and 600 g.', ar: 'الكربوهيدرات يجب أن تكون بين ٢٠ و٦٠٠ غ.' },
  targetFat: { en: 'Fat must be between 20 and 200 g.', ar: 'الدهون يجب أن تكون بين ٢٠ و٢٠٠ غ.' },
}

export function ProfileScreen({ account, data, theme, onSave, onAccountUpdate }: { account: UserAccount; data: AppData; theme: AppTheme; onSave: (profile: UserProfile) => void; onAccountUpdate: (input: AccountUpdateInput) => Promise<UserAccount> }) {
  const [draft, setDraft] = useState(data.profile)
  const [username, setUsername] = useState(account.username)
  const [email, setEmail] = useState(account.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountSaved, setAccountSaved] = useState(false)
  const language = data.language
  const metrics = calculateHealthMetrics(draft)
  const profileIsValid = metrics.profileIsValid && draft.name.trim().length >= 2
  useEffect(() => setDraft(data.profile), [data.profile])
  useEffect(() => { setUsername(account.username); setEmail(account.email ?? '') }, [account.email, account.username])

  function numberField(key: keyof UserProfile, value: string) {
    setDraft((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  function applyCalculatedTargets() {
    setDraft((current) => ({ ...current, targetCalories: metrics.calories, targetProtein: metrics.protein, targetCarbs: metrics.carbs, targetFat: metrics.fat }))
  }

  async function saveAccount() {
    setAccountError('')
    setAccountSaved(false)
    const sensitiveChange = username.trim().toLowerCase() !== account.username || email.trim().toLowerCase() !== (account.email ?? '') || Boolean(newPassword)
    if (newPassword !== confirmPassword) {
      setAccountError(tr(language, 'New passwords do not match.', 'كلمتا المرور الجديدتان غير متطابقتين.'))
      return
    }
    if (sensitiveChange && !currentPassword) {
      setAccountError(tr(language, 'Enter your current password to save sensitive changes.', 'أدخل كلمة المرور الحالية لحفظ التغييرات الحساسة.'))
      return
    }
    setAccountBusy(true)
    try {
      const next = await onAccountUpdate({ displayName: draft.name, username, email, currentPassword, newPassword: newPassword || undefined })
      setUsername(next.username)
      setEmail(next.email ?? '')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setAccountSaved(true)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : tr(language, 'Could not update the account.', 'تعذر تحديث الحساب.'))
    } finally {
      setAccountBusy(false)
    }
  }

  return (
    <ScreenScroll theme={theme}>
      <SectionHeader eyebrow={tr(language, 'PERSONAL PROFILE', 'ملفك الشخصي')} title={tr(language, 'Your body, your targets', 'جسمك وأهدافك')} caption={tr(language, 'Edit your profile or calculate a safe planning estimate.', 'عدّل ملفك أو احسب تقديراً آمناً للخطة.')} theme={theme} />
      <Card theme={theme} style={styles.identityCard}><View style={[styles.largeAvatar, { backgroundColor: theme.primarySoft }]}><Text style={[styles.largeAvatarText, { color: theme.primary }]}>{draft.name[0]?.toUpperCase() || 'U'}</Text></View><View style={styles.flex}><Text style={[styles.identityName, { color: theme.text }]}>{draft.name}</Text><Text style={[styles.identityCaption, { color: theme.muted }]}>{tr(language, `${draft.goalWeeks}-week ${draft.goal} plan`, `خطة ${draft.goalWeeks} أسبوعاً`)}</Text></View></Card>

      <SectionHeader eyebrow={tr(language, 'ACCOUNT & SECURITY', 'الحساب والأمان')} title={tr(language, 'Sign-in information', 'بيانات تسجيل الدخول')} caption={tr(language, 'Change your username, email, or password securely.', 'غيّر اسم المستخدم أو البريد أو كلمة المرور بأمان.')} theme={theme} />
      <Card theme={theme} style={styles.formCard}>
        <FormField label={tr(language, 'Username', 'اسم المستخدم')} value={username} onChangeText={(value) => { setUsername(value); setAccountSaved(false) }} autoCapitalize="none" autoCorrect={false} maxLength={24} theme={theme} rightToLeft={false} />
        <FormField label={tr(language, 'Email address', 'البريد الإلكتروني')} value={email} onChangeText={(value) => { setEmail(value); setAccountSaved(false) }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" theme={theme} rightToLeft={false} />
        <View style={[styles.securityDivider, { backgroundColor: theme.line }]} />
        <FormField label={tr(language, 'Current password', 'كلمة المرور الحالية')} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" theme={theme} />
        <FormField label={tr(language, 'New password (optional)', 'كلمة المرور الجديدة (اختياري)')} value={newPassword} onChangeText={(value) => { setNewPassword(value); setAccountSaved(false) }} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" theme={theme} />
        <FormField label={tr(language, 'Confirm new password', 'تأكيد كلمة المرور الجديدة')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" theme={theme} />
        <Text style={[styles.securityHint, { color: theme.muted }]}>{tr(language, 'Your current password is required when username, email, or password changes.', 'كلمة المرور الحالية مطلوبة عند تغيير اسم المستخدم أو البريد أو كلمة المرور.')}</Text>
        {accountError ? <View style={[styles.accountMessage, { backgroundColor: theme.dark ? '#3b2927' : '#fff0ed', borderColor: palette.danger }]}><Text style={styles.accountError}>{accountError}</Text></View> : null}
        {accountSaved ? <View style={[styles.accountMessage, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}><Text style={[styles.accountSuccess, { color: theme.primary }]}>{tr(language, 'Account information updated.', 'تم تحديث بيانات الحساب.')}</Text></View> : null}
        <PrimaryButton label={tr(language, 'Save account details', 'حفظ بيانات الحساب')} icon="✓" busy={accountBusy} disabled={draft.name.trim().length < 2} onPress={() => void saveAccount()} theme={theme} />
      </Card>

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
      {!profileIsValid ? <Card theme={theme} style={[styles.validationCard, { backgroundColor: theme.dark ? '#3b2927' : '#fff0ed' }]}><Text style={styles.validationTitle}>{tr(language, 'Check your details', 'راجع بياناتك')}</Text>{draft.name.trim().length < 2 ? <Text style={[styles.validationText, { color: theme.muted }]}>{tr(language, 'Display name must contain at least two characters.', 'اسم العرض يجب أن يحتوي على حرفين على الأقل.')}</Text> : null}{metrics.issues.map((issue) => <Text key={issue} style={[styles.validationText, { color: theme.muted }]}>{language === 'ar' ? issueLabels[issue].ar : issueLabels[issue].en}</Text>)}</Card> : null}
      <Card theme={theme} style={styles.metricsCard}>
        <View style={styles.metricRow}><MetricChip label="BMI" value={metrics.isValid ? metrics.bmi.toFixed(1) : '—'} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.green100} /><MetricChip label="BMR" value={metrics.isValid ? `${metrics.bmr}` : '—'} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.amberSoft} /><MetricChip label="TDEE" value={metrics.isValid ? `${metrics.tdee}` : '—'} theme={theme} tint={theme.dark ? theme.surfaceAlt : palette.lilacSoft} /></View>
        <View style={[styles.recommendation, { backgroundColor: theme.primarySoft }]}><Text style={[styles.recommendationLabel, { color: theme.primary }]}>{tr(language, 'RECOMMENDED DAILY TARGET', 'الهدف اليومي المقترح')}</Text><Text style={[styles.recommendationValue, { color: theme.text }]}>{metrics.isValid ? `${metrics.calories} kcal` : '—'}</Text><Text style={[styles.recommendationMacros, { color: theme.muted }]}>{metrics.isValid ? `P ${metrics.protein}g · C ${metrics.carbs}g · F ${metrics.fat}g` : tr(language, 'Complete valid details to calculate', 'أكمل البيانات الصحيحة للحساب')}</Text></View>
        <PrimaryButton label={tr(language, 'Apply calculated targets', 'تطبيق الأهداف المحسوبة')} onPress={applyCalculatedTargets} disabled={!metrics.isValid} theme={theme} />
      </Card>

      <SectionHeader eyebrow={tr(language, 'CURRENT TARGETS', 'الأهداف الحالية')} title={tr(language, 'Nutrition goals', 'أهداف التغذية')} theme={theme} />
      <Card theme={theme} style={styles.formCard}>
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label="Calories" value={String(draft.targetCalories)} onChangeText={(value) => numberField('targetCalories', value)} keyboardType="number-pad" theme={theme} /></View><View style={styles.flex}><FormField label="Protein (g)" value={String(draft.targetProtein)} onChangeText={(value) => numberField('targetProtein', value)} keyboardType="number-pad" theme={theme} /></View></View>
        <View style={styles.twoColumns}><View style={styles.flex}><FormField label="Carbs (g)" value={String(draft.targetCarbs)} onChangeText={(value) => numberField('targetCarbs', value)} keyboardType="number-pad" theme={theme} /></View><View style={styles.flex}><FormField label="Fat (g)" value={String(draft.targetFat)} onChangeText={(value) => numberField('targetFat', value)} keyboardType="number-pad" theme={theme} /></View></View>
      </Card>
      <PrimaryButton label={tr(language, 'Save profile', 'حفظ الملف')} icon="✓" disabled={!profileIsValid} onPress={() => onSave(draft)} theme={theme} />
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
  securityDivider: { height: 1, marginVertical: 2 },
  securityHint: { fontSize: 11, lineHeight: 17 },
  accountMessage: { minHeight: 42, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center', borderWidth: 1, borderRadius: 13 },
  accountError: { color: palette.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  accountSuccess: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
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
  validationCard: { gap: 5, borderColor: palette.danger },
  validationTitle: { color: palette.danger, fontSize: 13, fontWeight: '900' },
  validationText: { fontSize: 11, lineHeight: 16 },
})
