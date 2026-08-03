import { useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { AppTheme } from '../../theme'
import { palette } from '../../theme'
import type { AppData, Language, ThemeMode, UserAccount } from '../../types'
import { Card, FormField, PrimaryButton, SecondaryButton, SectionHeader } from '../../components/ui'
import { tr } from '../../i18n'
import { addRecoveryEmail } from '../../services/auth'
import { submitCloudFeedback } from '../../services/cloud'

interface SettingsPanelProps {
  account: UserAccount
  data: AppData
  theme: AppTheme
  onChangeAccount: (next: UserAccount) => void
  onChangeData: (next: AppData) => void
  onReplacePlan: () => void
  onLogout: () => void
}

interface FeedbackPanelProps {
  language: Language
  theme: AppTheme
}

const feedbackCategories = [
  { id: 'experience', label: 'Experience' },
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature' },
  { id: 'meals', label: 'Meals' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'general', label: 'General' },
]

function FeedbackPanel({ language, theme }: FeedbackPanelProps) {
  const [rating, setRating] = useState(5)
  const [category, setCategory] = useState('experience')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    setStatus('')
    try {
      const result = await submitCloudFeedback({
        rating,
        category,
        message,
        page: 'settings',
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      })
      setMessage('')
      setStatus(result.emailSent
        ? tr(language, 'Feedback sent successfully.', 'تم إرسال ملاحظاتك بنجاح.')
        : tr(language, 'Feedback saved and visible to the administrator.', 'تم حفظ ملاحظاتك وستظهر للمشرف.'))
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : tr(language, 'Could not send feedback.', 'تعذر إرسال الملاحظات.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.feedbackPanel}>
      <SectionHeader
        eyebrow={tr(language, 'YOUR EXPERIENCE', 'تجربتك')}
        title={tr(language, 'Send feedback', 'أرسل ملاحظاتك')}
        caption={tr(language, 'Share an idea or report a problem. It is stored securely and shown to the administrator.', 'شارك اقتراحاً أو مشكلة. تُحفظ الرسالة بأمان وتظهر للمشرف.')}
        theme={theme}
      />
      <View style={styles.feedbackStars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setRating(value)}
            style={[
              styles.feedbackStar,
              {
                borderColor: value <= rating ? '#d7aa44' : theme.line,
                backgroundColor: value <= rating ? '#fff5d8' : theme.surface,
              },
            ]}
          >
            <Text style={{ color: value <= rating ? '#c58e1c' : theme.muted, fontSize: 20 }}>★</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedbackCategories}>
        {feedbackCategories.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setCategory(item.id)}
            style={[
              styles.feedbackCategory,
              {
                borderColor: category === item.id ? theme.primary : theme.line,
                backgroundColor: category === item.id ? theme.primarySoft : theme.surface,
              },
            ]}
          >
            <Text style={{ color: category === item.id ? theme.primary : theme.muted, fontSize: 9, fontWeight: '800' }}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        multiline
        value={message}
        onChangeText={setMessage}
        maxLength={2000}
        placeholder={tr(language, 'Tell us what worked or what could be better…', 'اكتب ما أعجبك أو ما يمكن تحسينه…')}
        placeholderTextColor={theme.muted}
        style={[styles.feedbackInput, { color: theme.text, borderColor: theme.line, backgroundColor: theme.surface }]}
      />
      <PrimaryButton
        label={tr(language, 'Send feedback', 'إرسال الملاحظات')}
        onPress={() => void send()}
        busy={busy}
        disabled={message.trim().length < 10}
        theme={theme}
      />
      {status ? <Text style={[styles.feedbackStatus, { color: theme.primary }]}>{status}</Text> : null}
    </View>
  )
}

export function SettingsPanel({ account, data, theme, onChangeAccount, onChangeData, onReplacePlan, onLogout }: SettingsPanelProps) {
  const languages: Array<{ id: Language; label: string }> = [
    { id: 'en', label: 'English' },
    { id: 'ar', label: 'العربية' },
    { id: 'fr', label: 'Français' },
  ]
  const themes: Array<{ id: ThemeMode; label: string; glyph: string }> = [
    { id: 'light', label: 'Light', glyph: '☀' },
    { id: 'dark', label: 'Dark', glyph: '☾' },
    { id: 'system', label: 'System', glyph: '◐' },
  ]
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState('')

  async function connectRecoveryEmail() {
    setEmailBusy(true)
    setEmailStatus('')
    try {
      onChangeAccount(await addRecoveryEmail(account.id, recoveryEmail))
      setEmailStatus('Recovery email connected. You can now request a reset code from the sign-in screen.')
    } catch (caught) {
      setEmailStatus(caught instanceof Error ? caught.message : 'Could not connect this recovery email.')
    } finally {
      setEmailBusy(false)
    }
  }

  return (
    <View style={styles.panel}>
      <SectionHeader
        eyebrow={tr(data.language, 'ACCOUNT', 'الحساب')}
        title={tr(data.language, 'Settings', 'الإعدادات')}
        caption={tr(data.language, 'Every change is saved automatically and securely synchronized with your account.', 'يتم حفظ كل تغيير تلقائياً ومزامنته بأمان مع حسابك.')}
        theme={theme}
      />
      <Card theme={theme} style={styles.accountCard}>
        <View style={[styles.accountAvatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.accountAvatarText, { color: theme.primary }]}>{account.displayName[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.accountName, { color: theme.text }]}>{account.displayName}</Text>
          <Text style={[styles.accountUsername, { color: theme.muted }]}>@{account.username}</Text>
          {account.email ? <Text style={[styles.accountEmail, { color: theme.muted }]}>{account.email}</Text> : null}
        </View>
        <View style={[styles.secureBadge, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.secureBadgeText, { color: theme.primary }]}>{account.email ? 'EMAIL ON' : 'CODE ONLY'}</Text>
        </View>
      </Card>
      {!account.email ? (
        <Card theme={theme} style={styles.emailRecoveryCard}>
          <FormField
            label={tr(data.language, 'Recovery email', 'بريد الاسترداد')}
            value={recoveryEmail}
            onChangeText={setRecoveryEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            theme={theme}
          />
          <PrimaryButton
            label={tr(data.language, 'Enable email recovery', 'تفعيل الاسترداد بالبريد')}
            onPress={() => void connectRecoveryEmail()}
            busy={emailBusy}
            theme={theme}
          />
          {emailStatus ? <Text style={[styles.emailStatus, { color: theme.muted }]}>{emailStatus}</Text> : null}
        </Card>
      ) : null}
      <SectionHeader
        eyebrow={tr(data.language, 'DIET PLAN', 'الخطة الغذائية')}
        title={data.dietPlan ? tr(data.language, 'PDF plan connected', 'ملف PDF متصل') : tr(data.language, 'Standard catalogue', 'الكتالوج القياسي')}
        theme={theme}
      />
      <Card theme={theme} style={styles.planCard}>
        <View style={styles.planFileIcon}><Text style={styles.planFileText}>PDF</Text></View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.planFileName, { color: theme.text }]}>
            {data.dietPlan?.fileName ?? tr(data.language, 'No PDF uploaded', 'لم يتم رفع ملف')}
          </Text>
          <Text style={[styles.planFileMeta, { color: theme.muted }]}>
            {data.dietPlan
              ? `${data.dietPlan.dailyCalories} kcal · ${new Date(data.dietPlan.uploadedAt).toLocaleDateString()}`
              : tr(data.language, 'Upload your dietitian’s plan any time.', 'ارفع خطة اختصاصي التغذية في أي وقت.')}
          </Text>
        </View>
      </Card>
      <SecondaryButton
        label={data.dietPlan ? tr(data.language, 'Replace PDF plan', 'استبدال ملف PDF') : tr(data.language, 'Upload PDF plan', 'رفع ملف PDF')}
        onPress={onReplacePlan}
        theme={theme}
      />
      <SectionHeader eyebrow={tr(data.language, 'LANGUAGE', 'اللغة')} title={tr(data.language, 'Interface language', 'لغة الواجهة')} theme={theme} />
      <View style={styles.settingChoiceRow}>
        {languages.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onChangeData({ ...data, language: item.id })}
            style={[
              styles.settingChoice,
              {
                backgroundColor: data.language === item.id ? theme.primary : theme.surface,
                borderColor: data.language === item.id ? theme.primary : theme.line,
              },
            ]}
          >
            <Text style={{ color: data.language === item.id ? '#fff' : theme.text, fontSize: 11, fontWeight: '900' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <SectionHeader eyebrow={tr(data.language, 'APPEARANCE', 'المظهر')} title={tr(data.language, 'Choose a theme', 'اختر السمة')} theme={theme} />
      <View style={styles.settingChoiceRow}>
        {themes.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onChangeData({ ...data, theme: item.id })}
            style={[
              styles.themeChoice,
              {
                backgroundColor: data.theme === item.id ? theme.primarySoft : theme.surface,
                borderColor: data.theme === item.id ? theme.primary : theme.line,
              },
            ]}
          >
            <Text style={[styles.themeGlyph, { color: data.theme === item.id ? theme.primary : theme.muted }]}>{item.glyph}</Text>
            <Text style={{ color: theme.text, fontSize: 10, fontWeight: '800' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <FeedbackPanel language={data.language} theme={theme} />
      <Card theme={theme} style={styles.securityCard}>
        <Text style={styles.securityIcon}>⌾</Text>
        <View style={styles.flex}>
          <Text style={[styles.securityTitle, { color: theme.text }]}>{tr(data.language, 'Password and recovery', 'كلمة المرور والاسترداد')}</Text>
          <Text style={[styles.securityBody, { color: theme.muted }]}>
            {tr(
              data.language,
              account.email
                ? 'Use a 15-minute email code or your offline recovery code. Passwords remain hashed in platform-secured storage.'
                : 'This older account uses its offline recovery code. Passwords remain hashed in platform-secured storage.',
              'استخدم رمز البريد المؤقت أو رمز الاسترداد المحفوظ. تبقى كلمة المرور مشفرة في مخزن النظام الآمن.',
            )}
          </Text>
        </View>
      </Card>
      <SecondaryButton
        label={tr(data.language, 'Sign out', 'تسجيل الخروج')}
        onPress={() => Alert.alert(
          tr(data.language, 'Sign out?', 'تسجيل الخروج؟'),
          tr(data.language, 'Your account data stays on this device.', 'ستبقى بيانات حسابك على هذا الجهاز.'),
          [
            { text: tr(data.language, 'Cancel', 'إلغاء'), style: 'cancel' },
            { text: tr(data.language, 'Sign out', 'خروج'), style: 'destructive', onPress: onLogout },
          ],
        )}
        danger
        theme={theme}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: 17 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountAvatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 20, fontWeight: '900' },
  accountName: { fontSize: 15, fontWeight: '900' },
  accountUsername: { marginTop: 2, fontSize: 10 },
  accountEmail: { marginTop: 2, fontSize: 10 },
  emailRecoveryCard: { gap: 12 },
  emailStatus: { fontSize: 11, lineHeight: 17 },
  secureBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  secureBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planFileIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: palette.green100, alignItems: 'center', justifyContent: 'center' },
  planFileText: { color: palette.green800, fontSize: 10, fontWeight: '900' },
  planFileName: { fontSize: 13, fontWeight: '900' },
  planFileMeta: { marginTop: 3, fontSize: 9 },
  settingChoiceRow: { flexDirection: 'row', gap: 8 },
  settingChoice: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeChoice: { flex: 1, minHeight: 70, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  themeGlyph: { fontSize: 22 },
  securityCard: { flexDirection: 'row', gap: 12 },
  feedbackPanel: { gap: 10 },
  feedbackStars: { flexDirection: 'row', gap: 7 },
  feedbackStar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  feedbackCategories: { gap: 7 },
  feedbackCategory: { minHeight: 35, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 99 },
  feedbackInput: { minHeight: 112, padding: 12, borderWidth: 1, borderRadius: 14, fontSize: 11, lineHeight: 17, textAlignVertical: 'top' },
  feedbackStatus: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
  securityIcon: { color: palette.green700, fontSize: 23 },
  securityTitle: { fontSize: 13, fontWeight: '900' },
  securityBody: { marginTop: 4, fontSize: 10, lineHeight: 16 },
})
