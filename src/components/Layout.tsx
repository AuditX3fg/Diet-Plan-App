import { useState, type ReactNode } from 'react'
import {
  Activity,
  Apple,
  Barcode,
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  Home,
  Leaf,
  LogOut,
  Moon,
  Settings,
  Settings2,
  Sun,
  UserRound,
} from 'lucide-react'
import type { Language, View } from '../types'

interface LayoutProps {
  children: ReactNode
  view: View
  onViewChange: (view: View) => void
  darkMode: boolean
  onToggleTheme: () => void
  userName: string
  currentDate: string
  language: Language
  onLogout: () => void
}

const navItems = [
  { id: 'today' as const, icon: Home },
  { id: 'plan' as const, icon: CalendarDays },
  { id: 'week' as const, icon: Apple },
  { id: 'habits' as const, icon: Activity },
  { id: 'scanner' as const, icon: Barcode },
  { id: 'workouts' as const, icon: ChartNoAxesColumnIncreasing },
  { id: 'progress' as const, icon: ChartNoAxesColumnIncreasing },
  { id: 'profile' as const, icon: UserRound },
  { id: 'settings' as const, icon: Settings },
]

const labels: Record<Language, Record<View, string>> = {
  ar: { today: 'الرئيسية', plan: 'خطتي', week: 'الأسبوع', habits: 'متابعة', scanner: 'مسح', workouts: 'تمرين', progress: 'التقدم', profile: 'الكتلة', settings: 'الإعدادات' },
  en: { today: 'Home', plan: 'My plan', week: 'Week', habits: 'Tracker', scanner: 'Scan', workouts: 'Workout', progress: 'Progress', profile: 'Health', settings: 'Settings' },
  fr: { today: 'Accueil', plan: 'Mon plan', week: 'Semaine', habits: 'Suivi', scanner: 'Scanner', workouts: 'Sport', progress: 'Progrès', profile: 'Santé', settings: 'Réglages' },
}

export function Layout({ children, view, onViewChange, darkMode, onToggleTheme, userName, currentDate, language, onLogout }: LayoutProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const languageLabels = labels[language]
  return (
    <div className={darkMode ? 'app-shell dark' : 'app-shell'} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <aside className="sidebar">
        <button className="brand" onClick={() => onViewChange('today')} aria-label={language === 'ar' ? 'العودة للرئيسية' : 'Back to home'}>
          <span className="brand-mark"><Leaf size={20} /></span>
          <span><b>{language === 'ar' ? 'توازن' : 'Tawazon'}</b><small>{language === 'ar' ? 'خطتك، بطريقتك' : 'Your plan, your way'}</small></span>
        </button>

        <nav className="side-nav" aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          <p className="nav-kicker">{language === 'ar' ? 'القائمة' : language === 'fr' ? 'MENU' : 'MENU'}</p>
          {navItems.map(({ id, icon: Icon }) => (
            <button key={id} className={view === id ? 'nav-link active' : 'nav-link'} onClick={() => onViewChange(id)}>
              <Icon size={20} />
              <span>{languageLabels[id]}</span>
              {view === id && <ChevronLeft size={15} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span className="tip-icon">💡</span>
          <b>{language === 'ar' ? 'نصيحة اليوم' : language === 'fr' ? 'Conseil du jour' : 'Today’s tip'}</b>
          <p>{language === 'ar' ? 'حضّر وجبتك القادمة مبكراً لتجعل قرارك الصحي أسهل.' : language === 'fr' ? 'Préparez votre prochain repas tôt pour faciliter le choix sain.' : 'Prepare your next meal early to make the healthy choice easier.'}</p>
        </div>

        <button className="profile-mini" onClick={() => onViewChange('profile')}>
          <span className="avatar">{userName.trim().slice(0, 1) || (language === 'ar' ? 'م' : 'U')}</span>
          <span><b>{userName}</b><small>{language === 'ar' ? 'الخطة المتوازنة' : language === 'fr' ? 'Plan équilibré' : 'Balanced plan'}</small></span>
          <Settings2 size={17} />
        </button>
        <button className="logout-mini" onClick={onLogout}><LogOut size={16} /><span>{language === 'ar' ? 'تسجيل الخروج' : language === 'fr' ? 'Se déconnecter' : 'Sign out'}</span></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">{currentDate}</p>
            <h1>{view === 'today' ? `${language === 'ar' ? 'أهلاً' : language === 'fr' ? 'Bonjour' : 'Hello'}, ${userName.split(' ')[0]} 👋` : languageLabels[view]}</h1>
          </div>
          <div className="topbar-actions">
            <button className="round-btn" onClick={onToggleTheme} aria-label={language === 'ar' ? 'تبديل المظهر' : 'Toggle theme'}>
              {darkMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button className="round-btn notification" aria-label={language === 'ar' ? 'الإشعارات' : 'Notifications'} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}>
              <Bell size={19} />
              <span />
            </button>
            <button className="top-avatar" onClick={() => onViewChange('profile')}>{userName.trim().slice(0, 1) || (language === 'ar' ? 'م' : 'U')}</button>
            {notificationsOpen && <div className="notification-popover"><b>{language === 'ar' ? 'تذكيرات اليوم' : 'Today’s reminders'}</b><button onClick={() => { onViewChange('today'); setNotificationsOpen(false) }}>{language === 'ar' ? '💧 تبقّى لك من هدف الماء اليوم' : '💧 You still have water left in today’s goal'}</button><button onClick={() => { onViewChange('habits'); setNotificationsOpen(false) }}>{language === 'ar' ? '✓ حدّث مهام المتابعة قبل نهاية اليوم' : '✓ Update your tracker before the day ends'}</button></div>}
          </div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>

      <nav className="bottom-nav" aria-label={language === 'ar' ? 'التنقل الرئيسي للهاتف' : 'Mobile navigation'}>
        {navItems.map(({ id, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => onViewChange(id)}>
            <Icon size={21} />
            <span>{languageLabels[id]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
