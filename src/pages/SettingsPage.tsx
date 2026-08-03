import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Bell, Check, Download, FileText, KeyRound, Languages, LogOut, MonitorCog, Moon, Send, Settings2, Share2, Smartphone, Sun, UserRound } from 'lucide-react'
import type { Language, ReminderSettings, ThemeMode, UserAccount, UserProfile } from '../types'
import { tr } from '../i18n'
import { clearInstallPrompt, getInstallPrompt, subscribeToInstallPrompt } from '../pwa'
import type { NotificationSupport } from '../services/reminders'

interface SettingsPageProps {
  profile: UserProfile
  language: Language
  theme: ThemeMode
  account: UserAccount
  reminders: ReminderSettings
  notificationPermission: NotificationSupport
  onProfileChange: (profile: UserProfile) => void
  onLanguageChange: (language: Language) => void
  onThemeChange: (theme: ThemeMode) => void
  onReminderChange: Dispatch<SetStateAction<ReminderSettings>>
  onEnableNotifications: () => Promise<void>
  onTestNotification: () => void | Promise<unknown>
  onOpenPlanImport: () => void
  onLogout: () => void
}

type StandaloneNavigator = Navigator & { standalone?: boolean }

const languages: { id: Language; label: string; native: string }[] = [
  { id: 'ar', label: 'العربية', native: 'العربية' },
  { id: 'en', label: 'English', native: 'English' },
  { id: 'fr', label: 'Français', native: 'Français' },
]

const themes: { id: ThemeMode; label: string; labelEn: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'فاتح', labelEn: 'Light', icon: Sun },
  { id: 'dark', label: 'داكن', labelEn: 'Dark', icon: Moon },
  { id: 'system', label: 'تلقائي', labelEn: 'System', icon: MonitorCog },
]

export function SettingsPage({ profile, language, theme, account, reminders, notificationPermission, onProfileChange, onLanguageChange, onThemeChange, onReminderChange, onEnableNotifications, onTestNotification, onOpenPlanImport, onLogout }: SettingsPageProps) {
  const [installPrompt, setInstallPrompt] = useState(getInstallPrompt)
  const [isInstalled, setIsInstalled] = useState(false)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateInstalledState = () => setIsInstalled(displayMode.matches || Boolean((navigator as StandaloneNavigator).standalone))
    const markInstalled = () => {
      setIsInstalled(true)
    }

    updateInstalledState()
    const unsubscribe = subscribeToInstallPrompt(setInstallPrompt)
    displayMode.addEventListener('change', updateInstalledState)
    window.addEventListener('appinstalled', markInstalled)

    return () => {
      unsubscribe()
      displayMode.removeEventListener('change', updateInstalledState)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setIsInstalled(true)
    clearInstallPrompt()
  }

  const updateReminder = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    onReminderChange((current) => ({ ...current, [key]: value }))
  }

  const updateMealTime = (index: number, value: string) => {
    onReminderChange((current) => ({ ...current, mealTimes: current.mealTimes.map((time, timeIndex) => timeIndex === index ? value : time) }))
  }

  return (
    <div className="settings-page">
      <section className="feature-intro"><div><span className="status-pill"><Settings2 size={14} /> {tr('الإعدادات', 'Settings')}</span><h2>{tr('التطبيق كما تفضله', 'Make the app yours')}</h2><p>{tr('يتم حفظ تفضيلاتك تلقائياً على هذا الجهاز.', 'Your preferences are saved automatically on this device.')}</p></div><span className="saved-pill"><Check size={14} /> {tr('محفوظ تلقائياً', 'Saved automatically')}</span></section>
      <section className="settings-grid">
        <div className="settings-card card-surface"><div className="settings-title"><span><UserRound size={19} /></span><div><small>{tr('الحساب', 'Account')}</small><h3>{tr('ملفك الشخصي', 'Your profile')}</h3></div></div><label className="setting-input"><span>{tr('اسم العرض', 'Display name')}</span><input value={language !== 'ar' && profile.name === 'محمد' ? 'Mohammed' : profile.name} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} placeholder={tr('اكتب اسمك', 'Enter your name')} /></label><label className="setting-input"><span>{tr('اسم المستخدم', 'Username')}</span><input value={`@${account.username}`} readOnly /></label></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><FileText size={19} /></span><div><small>{tr('الخطة الغذائية', 'Diet plan')}</small><h3>{account.dietPlan ? tr('ملف PDF متصل', 'PDF plan connected') : tr('لم يتم رفع ملف', 'No PDF uploaded')}</h3></div></div>{account.dietPlan ? <div className="connected-plan"><b>{account.dietPlan.fileName}</b><small>{toLocaleDate(account.dietPlan.uploadedAt, language)} · {account.dietPlan.dailyCalories} kcal</small></div> : <p className="setting-help">{tr('ارفع خطة اختصاصي التغذية لتخصيص الوجبات والأهداف.', 'Upload your dietitian’s plan to personalize meals and daily targets.')}</p>}<button className="settings-action" onClick={onOpenPlanImport}><FileText size={15} /> {account.dietPlan ? tr('استبدال ملف PDF', 'Replace PDF plan') : tr('رفع ملف PDF', 'Upload PDF plan')}</button></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><Languages size={19} /></span><div><small>{tr('اللغة', 'Language')}</small><h3>{tr('لغة الواجهة', 'Interface language')}</h3></div></div><div className="choice-row">{languages.map((item) => <button key={item.id} className={language === item.id ? 'active' : ''} onClick={() => onLanguageChange(item.id)}>{item.native}{language === item.id && <Check size={14} />}</button>)}</div><p className="setting-help">{tr('تترجم الواجهة والوجبات تلقائياً عند تغيير اللغة.', 'The interface and meal catalogue update together when you change language.')}</p></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><Sun size={19} /></span><div><small>{tr('المظهر', 'Appearance')}</small><h3>{tr('اختر السمة', 'Choose a theme')}</h3></div></div><div className="theme-row">{themes.map(({ id, label, labelEn, icon: Icon }) => <button key={id} className={theme === id ? 'active' : ''} onClick={() => onThemeChange(id)}><Icon size={18} /><span>{tr(label, labelEn)}</span>{theme === id && <Check size={14} />}</button>)}</div></div>
        <div className="settings-card card-surface install-app-card">
          <div className="settings-title"><span><Smartphone size={19} /></span><div><small>{tr('التطبيق', 'App')}</small><h3>{isInstalled ? tr('مثبّت على جهازك', 'Installed on this device') : tr('ثبّت توازن', 'Install Tawazon')}</h3></div></div>
          {isInstalled ? (
            <p className="setting-help install-success"><Check size={15} /> {tr('يعمل توازن الآن كتطبيق مستقل.', 'Tawazon now runs as a standalone app.')}</p>
          ) : installPrompt ? (
            <><p className="setting-help">{tr('أضف توازن إلى شاشتك الرئيسية وافتحه كتطبيق مستقل.', 'Add Tawazon to your device and open it like a standalone app.')}</p><button className="settings-action install-action" onClick={installApp}><Download size={15} /> {tr('تثبيت التطبيق', 'Install app')}</button></>
          ) : isIOS ? (
            <div className="install-guidance"><Share2 size={17} /><p>{tr('في Safari اضغط مشاركة، ثم اختر إضافة إلى الشاشة الرئيسية.', 'In Safari, tap Share, then choose Add to Home Screen.')}</p></div>
          ) : (
            <div className="install-guidance"><Download size={17} /><p>{tr('افتح قائمة المتصفح واختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.', 'Open the browser menu and choose Install app or Add to Home Screen.')}</p></div>
          )}
        </div>
        <div className="settings-card card-surface reminder-card">
          <div className="settings-title"><span><Bell size={19} /></span><div><small>{tr('التذكيرات', 'Reminders')}</small><h3>{tr('الماء ومواعيد الوجبات', 'Water and meal times')}</h3></div></div>
          {notificationPermission === 'unsupported' ? (
            <p className="setting-help reminder-warning">{tr('هذا المتصفح لا يدعم إشعارات التطبيق.', 'This browser does not support app notifications.')}</p>
          ) : notificationPermission !== 'granted' ? (
            <><p className="setting-help">{notificationPermission === 'denied' ? tr('تم حظر الإشعارات. اسمح بها من إعدادات المتصفح أو الجهاز أولاً.', 'Notifications are blocked. Allow them in your browser or device settings first.') : tr('اسمح لتوازن بإرسال تذكيرات الماء والوجبات.', 'Allow Tawazon to send water and meal reminders.')}</p><button className="settings-action reminder-enable" onClick={onEnableNotifications}><Bell size={15} /> {tr('السماح بالإشعارات', 'Allow notifications')}</button></>
          ) : (
            <div className="reminder-controls">
              <label className="reminder-toggle"><span><b>{tr('تفعيل التذكيرات', 'Enable reminders')}</b><small>{tr('يمكنك إيقافها في أي وقت.', 'You can pause them at any time.')}</small></span><input type="checkbox" checked={reminders.enabled} onChange={(event) => updateReminder('enabled', event.target.checked)} /></label>
              <div className="reminder-rule">
                <label><input type="checkbox" checked={reminders.waterEnabled} onChange={(event) => updateReminder('waterEnabled', event.target.checked)} /><span>💧 {tr('تذكير الماء', 'Water reminder')}</span></label>
                <select aria-label={tr('فاصل تذكير الماء', 'Water reminder interval')} value={reminders.waterIntervalMinutes} onChange={(event) => updateReminder('waterIntervalMinutes', Number(event.target.value))}><option value={30}>{tr('كل ٣٠ دقيقة', 'Every 30 minutes')}</option><option value={60}>{tr('كل ساعة', 'Every hour')}</option><option value={90}>{tr('كل ٩٠ دقيقة', 'Every 90 minutes')}</option><option value={120}>{tr('كل ساعتين', 'Every 2 hours')}</option><option value={180}>{tr('كل ٣ ساعات', 'Every 3 hours')}</option></select>
              </div>
              <div className="reminder-meals">
                <label className="reminder-meal-toggle"><input type="checkbox" checked={reminders.mealEnabled} onChange={(event) => updateReminder('mealEnabled', event.target.checked)} /><span>🍽️ {tr('تذكيرات الوجبات', 'Meal reminders')}</span></label>
                <div className="meal-time-grid">{reminders.mealTimes.map((time, index) => <label key={index}><span>{tr(['الفطور', 'وجبة خفيفة', 'الغداء', 'العشاء'][index], ['Breakfast', 'Snack', 'Lunch', 'Dinner'][index])}</span><input type="time" value={time} onChange={(event) => updateMealTime(index, event.target.value)} /></label>)}</div>
              </div>
              <button className="settings-action" onClick={() => void onTestNotification()}><Send size={14} /> {tr('إرسال إشعار تجريبي', 'Send test notification')}</button>
            </div>
          )}
        </div>
        <div className="settings-card card-surface"><div className="settings-title"><span><KeyRound size={19} /></span><div><small>{tr('الأمان', 'Security')}</small><h3>{tr('كلمة المرور والاسترداد', 'Password and recovery')}</h3></div></div><p className="setting-help">{tr('استخدم رمز الاسترداد المحفوظ لإعادة تعيين كلمة المرور من شاشة تسجيل الدخول.', 'Use your saved recovery code to reset the password from the sign-in screen.')}</p><button className="settings-action danger" onClick={onLogout}><LogOut size={15} /> {tr('تسجيل الخروج', 'Sign out')}</button></div>
      </section>
    </div>
  )
}

function toLocaleDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
