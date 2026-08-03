import { Bell, Check, FileText, KeyRound, Languages, LogOut, MonitorCog, Moon, Settings2, Sun, UserRound } from 'lucide-react'
import type { Language, ThemeMode, UserAccount, UserProfile } from '../types'
import { tr } from '../i18n'

interface SettingsPageProps {
  profile: UserProfile
  language: Language
  theme: ThemeMode
  account: UserAccount
  onProfileChange: (profile: UserProfile) => void
  onLanguageChange: (language: Language) => void
  onThemeChange: (theme: ThemeMode) => void
  onOpenPlanImport: () => void
  onLogout: () => void
}

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

export function SettingsPage({ profile, language, theme, account, onProfileChange, onLanguageChange, onThemeChange, onOpenPlanImport, onLogout }: SettingsPageProps) {
  return (
    <div className="settings-page">
      <section className="feature-intro"><div><span className="status-pill"><Settings2 size={14} /> {tr('الإعدادات', 'Settings')}</span><h2>{tr('التطبيق كما تفضله', 'Make the app yours')}</h2><p>{tr('يتم حفظ تفضيلاتك تلقائياً على هذا الجهاز.', 'Your preferences are saved automatically on this device.')}</p></div><span className="saved-pill"><Check size={14} /> {tr('محفوظ تلقائياً', 'Saved automatically')}</span></section>
      <section className="settings-grid">
        <div className="settings-card card-surface"><div className="settings-title"><span><UserRound size={19} /></span><div><small>{tr('الحساب', 'Account')}</small><h3>{tr('ملفك الشخصي', 'Your profile')}</h3></div></div><label className="setting-input"><span>{tr('اسم العرض', 'Display name')}</span><input value={language !== 'ar' && profile.name === 'محمد' ? 'Mohammed' : profile.name} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} placeholder={tr('اكتب اسمك', 'Enter your name')} /></label><label className="setting-input"><span>{tr('اسم المستخدم', 'Username')}</span><input value={`@${account.username}`} readOnly /></label></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><FileText size={19} /></span><div><small>{tr('الخطة الغذائية', 'Diet plan')}</small><h3>{account.dietPlan ? tr('ملف PDF متصل', 'PDF plan connected') : tr('لم يتم رفع ملف', 'No PDF uploaded')}</h3></div></div>{account.dietPlan ? <div className="connected-plan"><b>{account.dietPlan.fileName}</b><small>{toLocaleDate(account.dietPlan.uploadedAt, language)} · {account.dietPlan.dailyCalories} kcal</small></div> : <p className="setting-help">{tr('ارفع خطة اختصاصي التغذية لتخصيص الوجبات والأهداف.', 'Upload your dietitian’s plan to personalize meals and daily targets.')}</p>}<button className="settings-action" onClick={onOpenPlanImport}><FileText size={15} /> {account.dietPlan ? tr('استبدال ملف PDF', 'Replace PDF plan') : tr('رفع ملف PDF', 'Upload PDF plan')}</button></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><Languages size={19} /></span><div><small>{tr('اللغة', 'Language')}</small><h3>{tr('لغة الواجهة', 'Interface language')}</h3></div></div><div className="choice-row">{languages.map((item) => <button key={item.id} className={language === item.id ? 'active' : ''} onClick={() => onLanguageChange(item.id)}>{item.native}{language === item.id && <Check size={14} />}</button>)}</div><p className="setting-help">{tr('تترجم الواجهة والوجبات تلقائياً عند تغيير اللغة.', 'The interface and meal catalogue update together when you change language.')}</p></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><Sun size={19} /></span><div><small>{tr('المظهر', 'Appearance')}</small><h3>{tr('اختر السمة', 'Choose a theme')}</h3></div></div><div className="theme-row">{themes.map(({ id, label, labelEn, icon: Icon }) => <button key={id} className={theme === id ? 'active' : ''} onClick={() => onThemeChange(id)}><Icon size={18} /><span>{tr(label, labelEn)}</span>{theme === id && <Check size={14} />}</button>)}</div></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><Bell size={19} /></span><div><small>{tr('التذكيرات', 'Reminders')}</small><h3>{tr('إشعارات داخل التطبيق', 'In-app notifications')}</h3></div></div><p className="setting-help">{tr('يعرض زر الجرس تذكيرات الماء والوجبات. لا يطلب التطبيق إذن إشعارات النظام ولا يرسل بياناتك إلى خادم.', 'The bell shows water and meal reminders. The app does not request system notification access or send your data to a server.')}</p></div>
        <div className="settings-card card-surface"><div className="settings-title"><span><KeyRound size={19} /></span><div><small>{tr('الأمان', 'Security')}</small><h3>{tr('كلمة المرور والاسترداد', 'Password and recovery')}</h3></div></div><p className="setting-help">{tr('استخدم رمز الاسترداد المحفوظ لإعادة تعيين كلمة المرور من شاشة تسجيل الدخول.', 'Use your saved recovery code to reset the password from the sign-in screen.')}</p><button className="settings-action danger" onClick={onLogout}><LogOut size={15} /> {tr('تسجيل الخروج', 'Sign out')}</button></div>
      </section>
    </div>
  )
}

function toLocaleDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
