import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import { Layout } from './components/Layout'
import { fruits } from './data'
import { setActiveLanguage } from './i18n'
import { useLocalStorage } from './hooks/useLocalStorage'
import { AuthPage } from './pages/AuthPage'
import { DietPlanImportPage } from './pages/DietPlanImportPage'
import { HabitsPage } from './pages/HabitsPage'
import { PlanPage } from './pages/PlanPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProgressPage } from './pages/ProgressPage'
import { ScannerPage } from './pages/ScannerPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'
import { TodayPage } from './pages/TodayPage'
import { WeekPage } from './pages/WeekPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { accountStorageKey, getCurrentAccount, saveDietPlan, signOut, subscribeToAuthChanges, updateAccount, updateAccountDetails } from './services/auth'
import { flushAutosave, pauseAutosave, pendingAutosaveState, queueAutosave } from './services/autosave'
import { buildMealGroups } from './services/dietPlan'
import { loadCloudState, recordCloudActivity } from './services/cloud'
import { defaultReminderSettings, getNotificationPermission, requestNotificationPermission, sendReminderNotification } from './services/reminders'
import type { FoodProduct, FruitMap, HabitId, HabitMap, ImportedDietPlan, Language, PlanPreset, ReminderSettings, SelectionMap, SportPreference, ThemeMode, UserAccount, UserProfile, View, WeightEntry } from './types'
import { buildWeek, createDefaultSelections, createRandomWeek, getDayTotals, normalizeSelectionMap } from './utils'

const defaultProfile: UserProfile = {
  name: 'محمد',
  targetCalories: 1900,
  targetProtein: 150,
  targetCarbs: 190,
  targetFat: 65,
  height: 178,
  weight: 82.4,
  targetWeight: 76,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
  goal: 'lose',
  goalWeeks: 16,
}

const validViews = new Set<View>(['today', 'plan', 'week', 'habits', 'scanner', 'workouts', 'progress', 'profile', 'settings', 'admin'])

function defaultFruitMap(dayIds: string[]): FruitMap {
  return Object.fromEntries(dayIds.map((id, index) => [id, [fruits[(index * 2) % fruits.length].id, fruits[(index * 2 + 1) % fruits.length].id]]))
}

function emptyFruitMap(dayIds: string[]): FruitMap {
  return Object.fromEntries(dayIds.map((id) => [id, []]))
}

function dateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export default function App() {
  const [account, setAccount] = useState<UserAccount | null>(() => getCurrentAccount())

  useEffect(() => subscribeToAuthChanges(setAccount), [])

  useEffect(() => {
    if (!account) {
      document.documentElement.lang = 'en'
      document.documentElement.dir = 'ltr'
    }
  }, [account])

  if (!account) return <AuthPage onAuthenticated={setAccount} />
  if (!account.dietPlan && !account.planSkippedAt) {
    return <DietPlanImportPage account={account} onComplete={(plan) => setAccount(saveDietPlan(account.id, plan))} onSkip={() => setAccount(updateAccount(account.id, { planSkippedAt: new Date().toISOString() }))} />
  }

  return <DietApp key={account.id} account={account} onAccountChange={setAccount} onLogout={() => { signOut(); setAccount(null) }} />
}

interface DietAppProps {
  account: UserAccount
  onAccountChange: (account: UserAccount) => void
  onLogout: () => void
}

function DietApp({ account, onAccountChange, onLogout }: DietAppProps) {
  const days = useMemo(buildWeek, [])
  const mealGroups = useMemo(() => buildMealGroups(account.dietPlan), [account.dietPlan])
  const initialProfile = useMemo<UserProfile>(() => ({
    ...defaultProfile,
    name: account.displayName,
    targetCalories: account.dietPlan?.dailyCalories ?? defaultProfile.targetCalories,
    targetProtein: account.dietPlan?.protein ?? defaultProfile.targetProtein,
    targetCarbs: account.dietPlan?.carbs ?? defaultProfile.targetCarbs,
    targetFat: account.dietPlan?.fat ?? defaultProfile.targetFat,
  }), [account.displayName, account.dietPlan])
  const storageKey = (key: string) => accountStorageKey(account.id, key)
  const [storedView, setView] = useLocalStorage<View>(storageKey('active-view-v1'), 'today')
  const view = validViews.has(storedView) && (storedView !== 'admin' || account.isSuperAdmin) ? storedView : 'today'
  const [importingPlan, setImportingPlan] = useState(false)
  const [selectedDayId, setSelectedDayId] = useState(days[0].id)
  const [openMeal, setOpenMeal] = useState<string | null>('breakfast')
  const [theme, setTheme] = useLocalStorage<ThemeMode>(storageKey('theme-v2'), 'light')
  const [language, setLanguage] = useLocalStorage<Language>(storageKey('language-v1'), navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [profile, setProfile] = useLocalStorage<UserProfile>(storageKey('profile-v2'), initialProfile)
  const [storedSelections, setStoredSelections] = useLocalStorage<unknown>(storageKey('selections-v2'), () => createDefaultSelections(days, mealGroups))
  const selections = useMemo(() => normalizeSelectionMap(storedSelections), [storedSelections])
  const [fruitMap, setFruitMap] = useLocalStorage<FruitMap>(storageKey('fruits-v2'), () => account.dietPlan ? emptyFruitMap(days.map((day) => day.id)) : defaultFruitMap(days.map((day) => day.id)))
  const [waterMap, setWaterMap] = useLocalStorage<Record<string, number>>(storageKey('water'), { [days[0].id]: 5 })
  const [habits, setHabits] = useLocalStorage<HabitMap>(storageKey('habits-v1'), {})
  const [presets, setPresets] = useLocalStorage<PlanPreset[]>(storageKey('presets-v1'), [])
  const [sportPreference, setSportPreference] = useLocalStorage<SportPreference>(storageKey('sport-v1'), 'gym')
  const [scanHistory, setScanHistory] = useLocalStorage<FoodProduct[]>(storageKey('scan-history-v1'), [])
  const [shoppingList, setShoppingList] = useLocalStorage<FoodProduct[]>(storageKey('shopping-v1'), [])
  const [reminders, setReminders] = useLocalStorage<ReminderSettings>(storageKey('reminders-v1'), defaultReminderSettings)
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission)
  const [weightEntries, setWeightEntries] = useLocalStorage<WeightEntry[]>(storageKey('weight-history'), [
    { date: dateDaysAgo(35), value: 85.1 },
    { date: dateDaysAgo(28), value: 84.6 },
    { date: dateDaysAgo(21), value: 84.0 },
    { date: dateDaysAgo(14), value: 83.3 },
    { date: dateDaysAgo(7), value: 82.9 },
    { date: dateDaysAgo(0), value: 82.4 },
  ])
  const [cloudHydrated, setCloudHydrated] = useState(false)

  useEffect(() => { void recordCloudActivity('app_open', view).catch(() => undefined) }, [account.id])
  useEffect(() => { void recordCloudActivity('page_view', view).catch(() => undefined) }, [account.id, view])

  useEffect(() => {
    let active = true
    void loadCloudState().then((cloud) => {
      if (!active) return
      const pendingState = pendingAutosaveState(account.id)
      const state = pendingState ?? cloud?.state
      if (!state || Object.keys(state).length === 0) { setCloudHydrated(true); return }
      if (state.theme) setTheme(state.theme as ThemeMode)
      if (state.language) setLanguage(state.language as Language)
      if (state.profile) setProfile((current) => ({ ...current, ...(state.profile as UserProfile) }))
      if (state.selections) setStoredSelections(state.selections)
      if (state.fruitMap) setFruitMap(state.fruitMap as FruitMap)
      if (state.waterByDay) setWaterMap(state.waterByDay as Record<string, number>)
      if (state.habits) setHabits(state.habits as HabitMap)
      if (state.presets) setPresets(state.presets as PlanPreset[])
      if (state.sport) setSportPreference(state.sport as SportPreference)
      if (state.scanHistory) setScanHistory(state.scanHistory as FoodProduct[])
      if (state.shoppingList) setShoppingList(state.shoppingList as FoodProduct[])
      if (state.reminders) setReminders(state.reminders as ReminderSettings)
      if (state.weights) setWeightEntries(state.weights as WeightEntry[])
      const remotePlan = state.dietPlan as ImportedDietPlan | undefined
      const remoteSkippedAt = state.planSkippedAt as string | undefined
      if (remotePlan !== account.dietPlan || remoteSkippedAt !== account.planSkippedAt) onAccountChange({ ...account, dietPlan: remotePlan, planSkippedAt: remoteSkippedAt })
      setCloudHydrated(true)
    })
    return () => { active = false }
  }, [account.id])

  useEffect(() => {
    if (!cloudHydrated) return
    queueAutosave(account.id, {
      profile, dietPlan: account.dietPlan ?? null, planSkippedAt: account.planSkippedAt ?? null,
      selections, fruitMap, waterByDay: waterMap, habits, presets,
      sport: sportPreference, language, theme, scanHistory, shoppingList,
      reminders, weights: weightEntries,
    })
  }, [account.dietPlan, account.id, account.planSkippedAt, cloudHydrated, fruitMap, habits, language, presets, profile, reminders, scanHistory, selections, shoppingList, sportPreference, theme, waterMap, weightEntries])

  useEffect(() => {
    const flush = () => { void flushAutosave(account.id) }
    const handleVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('online', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
      pauseAutosave(account.id)
    }
  }, [account.id])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  useEffect(() => {
    const refreshPermission = () => setNotificationPermission(getNotificationPermission())
    document.addEventListener('visibilitychange', refreshPermission)
    return () => document.removeEventListener('visibilitychange', refreshPermission)
  }, [])

  useEffect(() => {
    if (!reminders.enabled || notificationPermission !== 'granted') return

    const runtimeKey = storageKey('reminder-runtime-v1')
    const readRuntime = () => {
      try {
        return JSON.parse(window.localStorage.getItem(runtimeKey) || '{}') as { lastWaterAt?: number; mealMarkers?: string[] }
      } catch {
        return {} as { lastWaterAt?: number; mealMarkers?: string[] }
      }
    }
    const saveRuntime = (runtime: { lastWaterAt?: number; mealMarkers?: string[] }) => {
      try { window.localStorage.setItem(runtimeKey, JSON.stringify(runtime)) } catch { /* Continue without persistence in private browsing. */ }
    }

    const checkReminders = async () => {
      const now = new Date()
      const runtime = readRuntime()

      if (reminders.waterEnabled) {
        const intervalMs = Math.max(15, reminders.waterIntervalMinutes) * 60_000
        if (!runtime.lastWaterAt) {
          runtime.lastWaterAt = now.getTime()
          saveRuntime(runtime)
        } else if (now.getTime() - runtime.lastWaterAt >= intervalMs) {
          runtime.lastWaterAt = now.getTime()
          saveRuntime(runtime)
          const glasses = waterMap[days[0].id] ?? 0
          await sendReminderNotification(
            language === 'ar' ? '💧 حان وقت الماء' : '💧 Time to drink water',
            language === 'ar' ? `شربت ${glasses} من ٨ أكواب اليوم. خذ كوباً الآن.` : `You have logged ${glasses} of 8 glasses today. Have a glass now.`,
            'tawazon-water',
          )
        }
      }

      if (reminders.mealEnabled) {
        const markers = runtime.mealMarkers ?? []
        const dateKey = now.toISOString().slice(0, 10)
        for (let index = 0; index < reminders.mealTimes.length; index += 1) {
          const time = reminders.mealTimes[index]
          const [hours, minutes] = time.split(':').map(Number)
          if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue
          const scheduled = new Date(now)
          scheduled.setHours(hours, minutes, 0, 0)
          const marker = `${dateKey}-${index}-${time}`
          const dueForLessThanTenMinutes = now >= scheduled && now.getTime() - scheduled.getTime() < 10 * 60_000
          if (!dueForLessThanTenMinutes || markers.includes(marker)) continue

          markers.push(marker)
          runtime.mealMarkers = markers.slice(-28)
          saveRuntime(runtime)
          const group = mealGroups[index]
          const mealName = group ? (language === 'ar' ? group.title : group.titleEn) : (language === 'ar' ? 'وجبتك' : 'your meal')
          await sendReminderNotification(
            language === 'ar' ? `🍽️ موعد ${mealName}` : `🍽️ ${mealName} reminder`,
            language === 'ar' ? 'افتح توازن وراجع الحصص المخططة لهذه الوجبة.' : 'Open Tawazon and review the portions planned for this meal.',
            `tawazon-meal-${index}`,
          )
        }
      }
    }

    void checkReminders()
    const timer = window.setInterval(() => void checkReminders(), 30_000)
    return () => window.clearInterval(timer)
  }, [account.id, days, language, mealGroups, notificationPermission, reminders, waterMap])

  useEffect(() => {
    setStoredSelections((current: unknown) => normalizeSelectionMap(current))
  }, [setStoredSelections])

  const darkMode = theme === 'dark' || (theme === 'system' && systemDark)
  setActiveLanguage(language)
  const weeklyTotals = useMemo(() => days.map((day) => getDayTotals(day.id, selections, fruitMap, mealGroups)), [days, selections, fruitMap, mealGroups])
  const habitStreak = useMemo(() => {
    let streak = 0
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date()
      date.setHours(12, 0, 0, 0)
      date.setDate(date.getDate() - offset)
      const completed = Object.values(habits[date.toISOString().slice(0, 10)] ?? {}).filter(Boolean).length
      if (completed < 6) break
      streak += 1
    }
    return streak
  }, [habits])
  const selectedTotals = getDayTotals(selectedDayId, selections, fruitMap, mealGroups)
  const todayTotals = getDayTotals(days[0].id, selections, fruitMap, mealGroups)

  async function enableNotifications() {
    const permission = await requestNotificationPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      setReminders((current) => ({ ...current, enabled: true }))
      await sendReminderNotification(
        language === 'ar' ? 'تم تفعيل تذكيرات توازن' : 'Tawazon reminders are on',
        language === 'ar' ? 'سنذكّرك بالماء والوجبات حسب جدولك.' : 'We will remind you about water and meals using your schedule.',
        'tawazon-enabled',
      )
    }
  }

  function changeView(nextView: View) {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function setSelections(update: SetStateAction<SelectionMap>) {
    setStoredSelections((current: unknown) => {
      const normalized = normalizeSelectionMap(current)
      return typeof update === 'function' ? update(normalized) : update
    })
  }

  function setMealPortion(mealId: string, optionId: string, portion: number) {
    setSelections((current) => {
      const daySelections = current[selectedDayId] ?? {}
      const mealSelections = { ...(daySelections[mealId] ?? {}) }
      const normalizedPortion = Math.min(4, Math.max(0, Math.round(portion * 4) / 4))
      if (normalizedPortion === 0) delete mealSelections[optionId]
      else mealSelections[optionId] = normalizedPortion
      return { ...current, [selectedDayId]: { ...daySelections, [mealId]: mealSelections } }
    })
  }

  function toggleFruit(fruitId: string) {
    setFruitMap((current) => {
      const chosen = current[selectedDayId] ?? []
      const next = chosen.includes(fruitId) ? chosen.filter((id) => id !== fruitId) : chosen.length < 2 ? [...chosen, fruitId] : chosen
      return { ...current, [selectedDayId]: next }
    })
  }

  function addWeight(value: number) {
    const today = days[0].id
    setWeightEntries((current) => [...current.filter((entry) => entry.date !== today), { date: today, value }].slice(-14))
    setProfile((current) => ({ ...current, weight: value }))
  }

  function regenerateWeek() {
    const next = createRandomWeek(days, mealGroups)
    setSelections(next.selections)
    setFruitMap(next.fruitMap)
    setOpenMeal(null)
  }

  function resetSelectedDay() {
    setSelections((current) => ({ ...current, [selectedDayId]: {} }))
    setFruitMap((current) => ({ ...current, [selectedDayId]: [] }))
  }

  function savePreset(name: string) {
    const preset: PlanPreset = { id: crypto.randomUUID?.() ?? String(Date.now()), name, createdAt: new Date().toISOString(), selections, fruits: fruitMap }
    setPresets((current) => [preset, ...current].slice(0, 8))
  }

  function toggleHabit(taskId: HabitId) {
    const today = days[0].id
    setHabits((current) => ({ ...current, [today]: { ...(current[today] ?? {}), [taskId]: !current[today]?.[taskId] } }))
  }

  function addScanResult(product: FoodProduct) {
    setScanHistory((current) => [product, ...current.filter((item) => item.id !== product.id)].slice(0, 8))
  }

  function toggleShopping(product: FoodProduct) {
    setShoppingList((current) => current.some((item) => item.id === product.id) ? current.filter((item) => item.id !== product.id) : [product, ...current])
  }

  async function logoutSafely() {
    await flushAutosave(account.id)
    onLogout()
  }

  function applyImportedPlan(plan: ImportedDietPlan) {
    const nextMealGroups = buildMealGroups(plan)
    setSelections(createDefaultSelections(days, nextMealGroups))
    setFruitMap(emptyFruitMap(days.map((day) => day.id)))
    setProfile((current) => ({ ...current, targetCalories: plan.dailyCalories, targetProtein: plan.protein, targetCarbs: plan.carbs, targetFat: plan.fat }))
    onAccountChange(saveDietPlan(account.id, plan))
    setImportingPlan(false)
  }

  if (importingPlan) return <DietPlanImportPage account={account} onComplete={applyImportedPlan} onCancel={() => setImportingPlan(false)} />

  let page
  switch (view) {
    case 'plan':
      page = <PlanPage days={days} mealGroups={mealGroups} selectedDayId={selectedDayId} selections={selections} fruitMap={fruitMap} totals={selectedTotals} profile={profile} openMeal={openMeal} onOpenMeal={setOpenMeal} onDayChange={(id) => { setSelectedDayId(id); setOpenMeal(null) }} onMealPortionChange={setMealPortion} onFruitToggle={toggleFruit} presets={presets} onSavePreset={savePreset} onLoadPreset={(preset) => { setSelections(normalizeSelectionMap(preset.selections)); setFruitMap(preset.fruits) }} onDeletePreset={(id) => setPresets((current) => current.filter((preset) => preset.id !== id))} onResetDay={resetSelectedDay} onRegenerateWeek={regenerateWeek} />
      break
    case 'week':
      page = <WeekPage days={days} mealGroups={mealGroups} selections={selections} fruitMap={fruitMap} weeklyTotals={weeklyTotals} onRegenerate={regenerateWeek} onOpenDay={(id) => { setSelectedDayId(id); changeView('plan') }} />
      break
    case 'habits':
      page = <HabitsPage todayId={days[0].id} habits={habits} profile={profile} onToggle={toggleHabit} onAddWeight={addWeight} />
      break
    case 'scanner':
      page = <ScannerPage history={scanHistory} shoppingList={shoppingList} onResult={addScanResult} onToggleShopping={toggleShopping} onClearHistory={() => setScanHistory([])} />
      break
    case 'workouts':
      page = <WorkoutsPage account={account} profile={profile} preference={sportPreference} onPreferenceChange={setSportPreference} onAccountChange={onAccountChange} />
      break
    case 'progress':
      page = <ProgressPage days={days} weeklyTotals={weeklyTotals} profile={profile} weightEntries={weightEntries} onAddWeight={addWeight} />
      break
    case 'profile':
      page = <ProfilePage account={account} profile={profile} onChange={(next) => { setProfile(next); if (next.name.trim().length >= 2 && next.name.trim() !== account.displayName) onAccountChange(updateAccount(account.id, { displayName: next.name.trim() })) }} onAccountUpdate={async (input) => { const next = await updateAccountDetails(account.id, input); onAccountChange(next); return next }} />
      break
    case 'settings':
      page = <SettingsPage profile={profile} language={language} theme={theme} account={account} reminders={reminders} notificationPermission={notificationPermission} onProfileChange={(next) => { setProfile(next); if (next.name.trim().length >= 2 && next.name.trim() !== account.displayName) onAccountChange(updateAccount(account.id, { displayName: next.name.trim() })) }} onLanguageChange={setLanguage} onThemeChange={setTheme} onReminderChange={setReminders} onEnableNotifications={enableNotifications} onTestNotification={() => sendReminderNotification(language === 'ar' ? '💧 تذكير تجريبي' : '💧 Test reminder', language === 'ar' ? 'تعمل إشعارات توازن بشكل صحيح.' : 'Tawazon notifications are working correctly.', 'tawazon-test')} onOpenPlanImport={() => setImportingPlan(true)} onLogout={() => void logoutSafely()} />
      break
    case 'admin':
      page = account.isSuperAdmin ? <AdminPage /> : <TodayPage dayId={days[0].id} mealGroups={mealGroups} selections={selections} totals={todayTotals} weeklyTotals={weeklyTotals} profile={profile} water={waterMap[days[0].id] ?? 0} habitStreak={habitStreak} onWaterChange={(value) => setWaterMap((current) => ({ ...current, [days[0].id]: value }))} onOpenPlan={() => { setSelectedDayId(days[0].id); changeView('plan') }} onOpenProgress={() => changeView('progress')} />
      break
    default:
      page = <TodayPage dayId={days[0].id} mealGroups={mealGroups} selections={selections} totals={todayTotals} weeklyTotals={weeklyTotals} profile={profile} water={waterMap[days[0].id] ?? 0} habitStreak={habitStreak} onWaterChange={(value) => setWaterMap((current) => ({ ...current, [days[0].id]: value }))} onOpenPlan={() => { setSelectedDayId(days[0].id); changeView('plan') }} onOpenProgress={() => changeView('progress')} />
  }

  const displayName = language === 'ar' ? profile.name || 'مستخدم' : profile.name === 'محمد' ? 'Mohammed' : profile.name || 'User'
  return <Layout view={view} onViewChange={changeView} darkMode={darkMode} onToggleTheme={() => setTheme(darkMode ? 'light' : 'dark')} userName={displayName} currentDate={language === 'ar' ? days[0].date : days[0].dateEn} language={language} onLogout={() => void logoutSafely()} isSuperAdmin={account.isSuperAdmin}>{page}</Layout>
}
