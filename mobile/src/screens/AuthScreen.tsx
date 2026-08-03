import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createAccount, resetPassword, resetPasswordWithEmail, sendEmailRecoveryCode, signIn } from '../services/auth'
import type { UserAccount } from '../types'
import { palette, useAppTheme } from '../theme'
import { FormField, PrimaryButton } from '../components/ui'
import { BrandMark } from '../components/BrandMark'

type Mode = 'signin' | 'signup' | 'reset'
type RecoveryMethod = 'email' | 'code'
type EmailStage = 'request' | 'verify'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (account: UserAccount) => void }) {
  const theme = useAppTheme('light')
  const [mode, setMode] = useState<Mode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>('email')
  const [emailStage, setEmailStage] = useState<EmailStage>('request')
  const [created, setCreated] = useState<{ account: UserAccount; code: string; emailed: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  function changeMode(next: Mode) {
    setMode(next)
    setError('')
    setPassword('')
    setConfirmation('')
    setEmailCode('')
    setEmailStage('request')
    setMessage('')
  }

  function changeRecoveryMethod(next: RecoveryMethod) {
    setRecoveryMethod(next)
    setEmailStage('request')
    setEmailCode('')
    setRecoveryCode('')
    setPassword('')
    setConfirmation('')
    setError('')
    setMessage('')
  }

  async function submit() {
    const needsNewPassword = mode === 'signup' || (mode === 'reset' && (recoveryMethod === 'code' || emailStage === 'verify'))
    if (needsNewPassword && password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signin') onAuthenticated(await signIn(username, password))
      else if (mode === 'signup') {
        const result = await createAccount({ displayName, username, email, password })
        setCreated({ account: result.account, code: result.recoveryCode, emailed: result.recoveryEmailSent })
      } else if (recoveryMethod === 'code') {
        onAuthenticated(await resetPassword({ username, recoveryCode, password }))
      } else if (emailStage === 'request') {
        const result = await sendEmailRecoveryCode(username)
        setEmailStage('verify')
        setMessage(`A six-digit reset code was sent to ${result.maskedEmail}. It expires in 15 minutes.`)
      } else {
        onAuthenticated(await resetPasswordWithEmail({ identifier: username, emailCode, password }))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <SafeAreaView style={styles.recoveryScreen}>
        <LinearGradient colors={['#e7f2ed', '#f7f5ef']} style={StyleSheet.absoluteFill} />
        <View style={styles.recoveryCard}>
          <View style={styles.recoveryIcon}><Text style={styles.recoveryIconText}>✓</Text></View>
          <Text style={styles.kicker}>ACCOUNT CREATED</Text>
          <Text style={styles.recoveryTitle}>Save your recovery code</Text>
          <Text style={styles.recoveryBody}>{created.emailed ? `A copy was sent to ${created.account.email}. You can also request a short-lived email code if you forget your password.` : 'Keep this offline backup somewhere private. Email delivery is not configured or was unavailable, so save the code before continuing.'}</Text>
          <Pressable onPress={async () => { await Clipboard.setStringAsync(created.code); setCopied(true) }} style={styles.codeCard}>
            <Text style={styles.code}>{created.code}</Text><Text style={styles.copyLabel}>{copied ? 'Copied ✓' : 'Copy'}</Text>
          </Pressable>
          <View style={styles.securityNote}><Text style={styles.securityGlyph}>⌾</Text><Text style={styles.securityText}>Your password and offline recovery code are saved as one-way hashes. Email reset codes expire after 15 minutes.</Text></View>
          <PrimaryButton label="I saved the code" icon="→" onPress={() => onAuthenticated(created.account)} theme={theme} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#e4f0eb', '#f7f5ef', '#ffffff']} locations={[0, 0.44, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}><BrandMark size={46} /><View><Text style={styles.brandName}>Tawazon</Text><Text style={styles.brandTagline}>Your plan, your way</Text></View></View>
          <View style={styles.hero}>
            <Text style={styles.heroPill}>PRIVATE · PERSONAL · NATIVE</Text>
            <Text style={styles.heroTitle}>{mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Build your plan.' : 'Recover access.'}</Text>
            <Text style={styles.heroBody}>{mode === 'signin' ? 'Sign in to continue your meals, progress, and personal targets.' : mode === 'signup' ? 'Add an email so a secure reset code can reach you if you forget your password.' : 'Receive a short-lived code by email, or use your offline recovery code.'}</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.modeTabs}>
              <Pressable onPress={() => changeMode('signin')} style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}><Text style={[styles.modeLabel, mode === 'signin' && styles.modeLabelActive]}>Sign in</Text></Pressable>
              <Pressable onPress={() => changeMode('signup')} style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}><Text style={[styles.modeLabel, mode === 'signup' && styles.modeLabelActive]}>Create account</Text></Pressable>
            </View>
            <View style={styles.formFields}>
              {mode === 'signup' ? <FormField label="Full name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" autoCapitalize="words" theme={theme} /> : null}
              {mode === 'signup' ? <FormField label="Recovery email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" theme={theme} /> : null}
              {mode === 'reset' ? <View style={styles.recoveryMethods}><Pressable onPress={() => changeRecoveryMethod('email')} style={[styles.recoveryMethod, recoveryMethod === 'email' && styles.recoveryMethodActive]}><Text style={[styles.recoveryMethodText, recoveryMethod === 'email' && styles.recoveryMethodTextActive]}>Email code</Text></Pressable><Pressable onPress={() => changeRecoveryMethod('code')} style={[styles.recoveryMethod, recoveryMethod === 'code' && styles.recoveryMethodActive]}><Text style={[styles.recoveryMethodText, recoveryMethod === 'code' && styles.recoveryMethodTextActive]}>Offline code</Text></Pressable></View> : null}
              <FormField label={mode === 'reset' ? 'Username or email' : 'Username'} value={username} onChangeText={setUsername} placeholder={mode === 'reset' ? 'Your username or email' : 'e.g. mohammed'} autoComplete="username" keyboardType={mode === 'reset' && username.includes('@') ? 'email-address' : 'default'} theme={theme} />
              {mode === 'reset' && recoveryMethod === 'code' ? <FormField label="Offline recovery code" value={recoveryCode} onChangeText={setRecoveryCode} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" theme={theme} /> : null}
              {mode === 'reset' && recoveryMethod === 'email' && emailStage === 'verify' ? <FormField label="Email reset code" value={emailCode} onChangeText={setEmailCode} placeholder="123456" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" theme={theme} /> : null}
              {mode !== 'reset' || recoveryMethod === 'code' || emailStage === 'verify' ? <FormField label={mode === 'reset' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} theme={theme} /> : null}
              {mode === 'signup' || (mode === 'reset' && (recoveryMethod === 'code' || emailStage === 'verify')) ? <FormField label="Confirm password" value={confirmation} onChangeText={setConfirmation} placeholder="Repeat your password" secureTextEntry autoComplete="new-password" theme={theme} /> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label={mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my account' : recoveryMethod === 'email' && emailStage === 'request' ? 'Send email code' : 'Reset password'} icon="→" onPress={submit} busy={busy} theme={theme} />
              {mode === 'reset' && recoveryMethod === 'email' && emailStage === 'verify' ? <Pressable onPress={() => { setEmailStage('request'); setMessage(''); setEmailCode('') }} style={styles.resend}><Text style={styles.resendText}>Use another account or send again</Text></Pressable> : null}
            </View>
            <Pressable onPress={() => changeMode(mode === 'reset' ? 'signin' : 'reset')} style={styles.forgot}><Text style={styles.forgotText}>{mode === 'reset' ? '← Back to sign in' : '⌘  Forgot password?'}</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#f7f5ef' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 18, gap: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandName: { color: palette.green950, fontSize: 18, fontWeight: '900' },
  brandTagline: { color: palette.muted, fontSize: 10, fontWeight: '600' },
  hero: { gap: 7, paddingTop: 4 },
  heroPill: { color: palette.green700, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  heroTitle: { color: palette.ink, fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.2 },
  heroBody: { color: palette.muted, fontSize: 14, lineHeight: 21, maxWidth: 340 },
  formCard: { padding: 18, borderRadius: 25, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8e4', gap: 18, shadowColor: '#13392f', shadowOpacity: 0.09, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  modeTabs: { height: 48, padding: 4, borderRadius: 15, backgroundColor: '#f0f4f2', flexDirection: 'row' },
  modeTab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeTabActive: { backgroundColor: '#fff', shadowColor: '#163c31', shadowOpacity: 0.1, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  modeLabel: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  modeLabelActive: { color: palette.green800 },
  formFields: { gap: 13 },
  recoveryMethods: { height: 42, padding: 3, borderRadius: 13, backgroundColor: '#f0f4f2', flexDirection: 'row' },
  recoveryMethod: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recoveryMethodActive: { backgroundColor: '#fff', shadowColor: '#163c31', shadowOpacity: 0.09, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  recoveryMethodText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  recoveryMethodTextActive: { color: palette.green800 },
  forgot: { alignSelf: 'flex-start', paddingVertical: 2 },
  forgotText: { color: palette.green700, fontSize: 12, fontWeight: '800' },
  error: { color: palette.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  success: { color: palette.green700, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  resend: { alignSelf: 'center', paddingVertical: 3 },
  resendText: { color: palette.green700, fontSize: 11, fontWeight: '800' },
  recoveryScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  recoveryCard: { width: '100%', maxWidth: 430, padding: 24, borderRadius: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e3', gap: 16, shadowColor: '#13392f', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  recoveryIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.green100 },
  recoveryIconText: { color: palette.green800, fontSize: 26, fontWeight: '900' },
  kicker: { color: palette.green700, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  recoveryTitle: { color: palette.ink, fontSize: 27, lineHeight: 32, fontWeight: '900' },
  recoveryBody: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  codeCard: { minHeight: 70, borderRadius: 18, paddingHorizontal: 17, backgroundColor: palette.green50, borderWidth: 1, borderColor: palette.green100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { color: palette.green950, fontSize: 21, fontWeight: '900', letterSpacing: 1.4 },
  copyLabel: { color: palette.green700, fontSize: 11, fontWeight: '900' },
  securityNote: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 16, backgroundColor: '#f8f7f2' },
  securityGlyph: { color: palette.green700, fontSize: 18 },
  securityText: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 17 },
})
