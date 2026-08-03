import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { AuthScreen } from './src/screens/AuthScreen'
import { PdfImportScreen } from './src/screens/PdfImportScreen'
import { TodayScreen } from './src/screens/TodayScreen'
import { PlanScreen } from './src/screens/PlanScreen'
import { ProgressScreen } from './src/screens/ProgressScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { MoreScreen } from './src/screens/MoreScreen'
import { BottomTabs } from './src/components/BottomTabs'
import { getCurrentAccount, signOut, updateAccount } from './src/services/auth'
import { applyDietPlan, buildMealGroups, loadAppData, saveAppData, skipDietPlan } from './src/services/storage'
import type { AppData, MainTab, UserAccount, UserProfile } from './src/types'
import { palette, useAppTheme } from './src/theme'

export default function App() {
  return <SafeAreaProvider><AppRoot /></SafeAreaProvider>
}

function AppRoot() {
  const [booting, setBooting] = useState(true)
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [data, setData] = useState<AppData | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const current = await getCurrentAccount()
      if (!active) return
      setAccount(current)
      if (current) setData(await loadAppData(current))
      setBooting(false)
    })()
    return () => { active = false }
  }, [])

  async function authenticated(nextAccount: UserAccount) {
    setAccount(nextAccount)
    setData(await loadAppData(nextAccount))
  }

  async function logout() {
    await signOut()
    setAccount(null)
    setData(null)
  }

  if (booting) return <BootScreen />
  if (!account) return <AuthScreen onAuthenticated={(next) => void authenticated(next)} />
  if (!data) return <BootScreen />
  if (!data.dietPlan && !data.planSkippedAt) {
    const theme = {
      dark: false, background: palette.cream, surface: '#fff', surfaceAlt: '#f5f7f5', text: palette.ink, muted: palette.muted, line: palette.line, primary: palette.green700, primarySoft: palette.green50, tabBar: '#fff',
    }
    return <PdfImportScreen account={account} theme={theme} onComplete={(plan) => setData(applyDietPlan(data, plan))} onSkip={() => setData(skipDietPlan(data))} />
  }
  return <AuthenticatedApp account={account} data={data} onChangeAccount={setAccount} onChangeData={setData} onLogout={() => void logout()} />
}

function AuthenticatedApp({ account, data, onChangeAccount, onChangeData, onLogout }: {
  account: UserAccount
  data: AppData
  onChangeAccount: (account: UserAccount) => void
  onChangeData: (data: AppData) => void
  onLogout: () => void
}) {
  const [tab, setTab] = useState<MainTab>('today')
  const [replacingPlan, setReplacingPlan] = useState(false)
  const theme = useAppTheme(data.theme)
  const groups = useMemo(() => buildMealGroups(data.dietPlan), [data.dietPlan])

  useEffect(() => {
    const timer = setTimeout(() => { void saveAppData(account.id, data) }, 140)
    return () => clearTimeout(timer)
  }, [account.id, data])

  async function saveProfile(profile: UserProfile) {
    onChangeData({ ...data, profile })
    if (profile.name.trim() && profile.name.trim() !== account.displayName) onChangeAccount(await updateAccount(account.id, profile.name))
  }

  if (replacingPlan) {
    return <><StatusBar style={theme.dark ? 'light' : 'dark'} /><PdfImportScreen account={account} theme={theme} existingPlan={data.dietPlan} onComplete={(plan) => { onChangeData(applyDietPlan(data, plan)); setReplacingPlan(false) }} onCancel={() => setReplacingPlan(false)} /></>
  }

  let screen
  if (tab === 'plan') screen = <PlanScreen data={data} groups={groups} theme={theme} onChangeData={onChangeData} />
  else if (tab === 'progress') screen = <ProgressScreen data={data} groups={groups} theme={theme} onChangeData={onChangeData} />
  else if (tab === 'profile') screen = <ProfileScreen data={data} theme={theme} onSave={(profile) => void saveProfile(profile)} />
  else if (tab === 'more') screen = <MoreScreen account={account} data={data} theme={theme} onChangeAccount={onChangeAccount} onChangeData={onChangeData} onReplacePlan={() => setReplacingPlan(true)} onLogout={onLogout} />
  else screen = <TodayScreen data={data} groups={groups} theme={theme} onChangeData={onChangeData} onOpenPlan={() => setTab('plan')} />

  return (
    <View style={[styles.app, { backgroundColor: theme.background, direction: data.language === 'ar' ? 'rtl' : 'ltr' }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {screen}
      <BottomTabs active={tab} onChange={setTab} theme={theme} language={data.language} />
    </View>
  )
}

function BootScreen() {
  return <SafeAreaView style={styles.boot}><View style={styles.bootMark}><Text style={styles.bootGlyph}>◒</Text></View><Text style={styles.bootName}>Tawazon</Text><Text style={styles.bootTagline}>Your plan, your way</Text><ActivityIndicator style={styles.bootSpinner} color={palette.green700} /><StatusBar style="dark" /></SafeAreaView>
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cream },
  bootMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: palette.green800, alignItems: 'center', justifyContent: 'center' },
  bootGlyph: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bootName: { marginTop: 14, color: palette.green950, fontSize: 25, fontWeight: '900' },
  bootTagline: { marginTop: 2, color: palette.muted, fontSize: 11, fontWeight: '700' },
  bootSpinner: { marginTop: 24 },
})
