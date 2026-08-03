import { useEffect, useState, type FormEvent } from 'react'
import { AtSign, Calculator, Check, CircleUserRound, HeartPulse, Info, KeyRound, Mail, ShieldCheck, Sparkles, Target } from 'lucide-react'
import type { AccountUpdateInput, UserAccount, UserProfile } from '../types'
import { tr } from '../i18n'
import { calculateHealthMetrics, toArabicNumber, type HealthProfileIssue } from '../utils'

interface ProfilePageProps {
  profile: UserProfile
  account: UserAccount
  onChange: (profile: UserProfile) => void
  onAccountUpdate: (input: AccountUpdateInput) => Promise<UserAccount>
}

const activityOptions = [
  { id: 'sedentary', label: 'قليل (مكتبي)', labelEn: 'Low (desk-based)' },
  { id: 'light', label: 'خفيف (١–٣ أيام)', labelEn: 'Light (1–3 days)' },
  { id: 'moderate', label: 'متوسط (٣–٥ أيام)', labelEn: 'Moderate (3–5 days)' },
  { id: 'active', label: 'نشط (٦–٧ أيام)', labelEn: 'Active (6–7 days)' },
  { id: 'very-active', label: 'نشط جداً', labelEn: 'Very active' },
] as const

const issueLabels: Record<HealthProfileIssue, [string, string]> = {
  age: ['العمر يجب أن يكون بين ٢٠ و١٠٠ سنة لاستخدام حاسبة البالغين.', 'Age must be 20–100 for the adult calculator.'],
  height: ['أدخل طولاً بين ١٢٠ و٢٣٠ سم.', 'Enter a height between 120 and 230 cm.'],
  weight: ['أدخل وزناً بين ٣٠ و٣٠٠ كغ.', 'Enter a weight between 30 and 300 kg.'],
  targetWeight: ['أدخل وزناً مستهدفاً بين ٣٠ و٣٠٠ كغ.', 'Enter a target weight between 30 and 300 kg.'],
  goalWeeks: ['مدة الهدف يجب أن تكون بين أسبوع و١٠٤ أسابيع.', 'Goal duration must be between 1 and 104 weeks.'],
  goalDirection: ['الوزن المستهدف لا يطابق اتجاه الهدف المختار.', 'Target weight does not match the selected goal direction.'],
  targetCalories: ['السعرات الحالية يجب أن تكون بين ١٠٠٠ و٥٠٠٠.', 'Current calories must be between 1,000 and 5,000.'],
  targetProtein: ['البروتين الحالي يجب أن يكون بين ٢٠ و٤٠٠ غ.', 'Current protein must be between 20 and 400 g.'],
  targetCarbs: ['الكربوهيدرات الحالية يجب أن تكون بين ٢٠ و٦٠٠ غ.', 'Current carbohydrates must be between 20 and 600 g.'],
  targetFat: ['الدهون الحالية يجب أن تكون بين ٢٠ و٢٠٠ غ.', 'Current fat must be between 20 and 200 g.'],
}

export function ProfilePage({ profile, account, onChange, onAccountUpdate }: ProfilePageProps) {
  const [username, setUsername] = useState(account.username)
  const [email, setEmail] = useState(account.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountSaved, setAccountSaved] = useState(false)
  const metrics = calculateHealthMetrics(profile)
  const profileNameValid = profile.name.trim().length >= 2
  const bmiLabel = !metrics.isValid ? tr('أكمل البيانات الصحيحة', 'Complete valid details') : metrics.bmi < 18.5 ? tr('أقل من الطبيعي', 'Underweight') : metrics.bmi < 25 ? tr('ضمن النطاق الصحي', 'Healthy range') : metrics.bmi < 30 ? tr('فوق الطبيعي', 'Overweight') : tr('مرتفع', 'High')
  const metricValue = (value: number | string) => metrics.isValid ? toArabicNumber(value) : '—'
  const identityChanged = username.trim().toLowerCase() !== account.username || email.trim().toLowerCase() !== (account.email ?? '')

  useEffect(() => {
    setUsername(account.username)
    setEmail(account.email ?? '')
  }, [account.email, account.username])

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    onChange({ ...profile, [key]: value })
  }

  function applyCalculatedGoal() {
    onChange({ ...profile, targetCalories: metrics.targetCalories, targetProtein: metrics.protein, targetCarbs: metrics.carbs, targetFat: metrics.fat })
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault()
    setAccountError('')
    setAccountSaved(false)
    if (newPassword !== confirmPassword) {
      setAccountError(tr('كلمتا المرور الجديدتان غير متطابقتين.', 'New passwords do not match.'))
      return
    }
    if ((identityChanged || newPassword) && !currentPassword) {
      setAccountError(tr('أدخل كلمة المرور الحالية لحفظ التغييرات الحساسة.', 'Enter your current password to save sensitive changes.'))
      return
    }
    setAccountBusy(true)
    try {
      const next = await onAccountUpdate({ displayName: profile.name, username, email, currentPassword, newPassword: newPassword || undefined })
      setUsername(next.username)
      setEmail(next.email ?? '')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setAccountSaved(true)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : tr('تعذر تحديث الحساب.', 'Could not update the account.'))
    } finally {
      setAccountBusy(false)
    }
  }

  return (
    <div className="profile-page">
      <section className="profile-intro">
        <div><span className="status-pill"><CircleUserRound size={14} /> {tr('الكتلة والسعرات', 'Body and calories')}</span><h2>{tr('احسب هدفك بدقة', 'Calculate your target accurately')}</h2><p>{tr('مؤشر الكتلة، معدل الحرق، الاحتياج اليومي، وهدف المغذيات في مكان واحد.', 'BMI, metabolism, daily energy needs, and macro targets in one place.')}</p></div>
        <span className="saved-pill"><Check size={14} /> {tr('يتم الحفظ تلقائياً', 'Saved automatically')}</span>
      </section>

      <section className="profile-layout health-layout">
        <div className="profile-form card-surface">
          <div className="section-heading"><div><p className="eyebrow">{tr('البيانات الأساسية', 'Basic details')}</p><h2>{tr('معلومات الجسم', 'Body information')}</h2></div><span className="form-heading-icon"><Calculator size={18} /></span></div>
          <div className="field-grid health-fields">
            <label className="full"><span>{tr('اسم العرض', 'Display name')}</span><input value={profile.name} onChange={(event) => update('name', event.target.value)} minLength={2} maxLength={100} /></label>
            <label><span>{tr('الجنس', 'Gender')}</span><select value={profile.gender} onChange={(event) => update('gender', event.target.value as UserProfile['gender'])}><option value="male">{tr('ذكر', 'Male')}</option><option value="female">{tr('أنثى', 'Female')}</option></select></label>
            <label><span>{tr('العمر', 'Age')}</span><div className="unit-input"><input type="number" min="20" max="100" value={profile.age} onChange={(event) => update('age', Number(event.target.value))} /><small>{tr('سنة', 'years')}</small></div></label>
            <label><span>{tr('الطول', 'Height')}</span><div className="unit-input"><input type="number" min="120" max="230" value={profile.height} onChange={(event) => update('height', Number(event.target.value))} /><small>cm</small></div></label>
            <label><span>{tr('الوزن الحالي', 'Current weight')}</span><div className="unit-input"><input type="number" min="30" max="300" step="0.1" value={profile.weight} onChange={(event) => update('weight', Number(event.target.value))} /><small>kg</small></div></label>
            <label><span>{tr('الوزن المستهدف', 'Target weight')}</span><div className="unit-input"><input type="number" min="30" max="300" step="0.1" value={profile.targetWeight} onChange={(event) => update('targetWeight', Number(event.target.value))} /><small>kg</small></div></label>
            <label><span>{tr('المدة المستهدفة', 'Target duration')}</span><div className="unit-input"><input type="number" min="1" max="104" value={profile.goalWeeks} onChange={(event) => update('goalWeeks', Number(event.target.value))} /><small>{tr('أسبوع', 'weeks')}</small></div></label>
            <label className="full"><span>{tr('مستوى النشاط', 'Activity level')}</span><select value={profile.activityLevel} onChange={(event) => update('activityLevel', event.target.value as UserProfile['activityLevel'])}>{activityOptions.map((item) => <option key={item.id} value={item.id}>{tr(item.label, item.labelEn)}</option>)}</select></label>
            <label className="full"><span>{tr('الهدف', 'Goal')}</span><div className="goal-segment"><button className={profile.goal === 'lose' ? 'active' : ''} onClick={() => update('goal', 'lose')} type="button">{tr('خسارة وزن', 'Lose weight')}</button><button className={profile.goal === 'maintain' ? 'active' : ''} onClick={() => update('goal', 'maintain')} type="button">{tr('ثبات', 'Maintain')}</button><button className={profile.goal === 'gain' ? 'active' : ''} onClick={() => update('goal', 'gain')} type="button">{tr('زيادة وزن', 'Gain weight')}</button></div></label>
          </div>
          {(!profileNameValid || metrics.issues.length > 0) && <div className="health-validation" role="alert"><Info size={17} /><div><b>{tr('راجع بياناتك', 'Check your details')}</b>{!profileNameValid && <span>{tr('اسم العرض يجب أن يحتوي على حرفين على الأقل.', 'Display name must contain at least two characters.')}</span>}{metrics.issues.map((issue) => <span key={issue}>{tr(...issueLabels[issue])}</span>)}</div></div>}

          <div className="form-divider" />
          <div className="form-subhead"><span className="form-heading-icon warm"><Target size={18} /></span><div><b>{tr('الأهداف الحالية للخطة', 'Current plan targets')}</b><small>{tr('يمكنك تعديلها يدوياً أو اعتماد نتيجة الحاسبة', 'Edit manually or apply the calculator result')}</small></div></div>
          <div className="field-grid goals">
            <label><span>{tr('السعرات', 'Calories')}</span><div className="unit-input"><input type="number" min="1000" max="5000" step="50" value={profile.targetCalories} onChange={(event) => update('targetCalories', Number(event.target.value))} /><small>kcal</small></div></label>
            <label><span>{tr('البروتين', 'Protein')}</span><div className="unit-input"><input type="number" min="20" max="400" value={profile.targetProtein} onChange={(event) => update('targetProtein', Number(event.target.value))} /><small>g</small></div></label>
            <label><span>{tr('الكربوهيدرات', 'Carbohydrates')}</span><div className="unit-input"><input type="number" min="20" max="600" value={profile.targetCarbs} onChange={(event) => update('targetCarbs', Number(event.target.value))} /><small>g</small></div></label>
            <label><span>{tr('الدهون', 'Fat')}</span><div className="unit-input"><input type="number" min="20" max="200" value={profile.targetFat} onChange={(event) => update('targetFat', Number(event.target.value))} /><small>g</small></div></label>
          </div>
        </div>

        <aside className="profile-aside health-results">
          <div className="bmi-card card-surface">
            <div className="bmi-head"><span><Calculator size={20} /></span><div><small>{tr('مؤشر كتلة الجسم', 'Body mass index')}</small><b>BMI</b></div></div>
            <div className="bmi-value"><strong>{metricValue(metrics.bmi.toFixed(1))}</strong><span>{bmiLabel}</span></div>
            <div className="bmi-scale"><i className="low" /><i className="healthy" /><i className="high" /><i className="very-high" />{metrics.isValid && <span style={{ right: `${Math.max(2, Math.min(96, ((metrics.bmi - 15) / 25) * 100))}%` }} />}</div>
            <div className="bmi-labels"><span>{toArabicNumber(15)}</span><span>{tr('طبيعي', 'Healthy')}</span><span>{toArabicNumber(40)}</span></div>
            <p className="healthy-range">{tr('النطاق الصحي لوزنك:', 'Healthy weight range:')} <b>{metrics.isValid ? `${toArabicNumber(metrics.healthyMin.toFixed(1))}–${toArabicNumber(metrics.healthyMax.toFixed(1))} kg` : '—'}</b></p>
          </div>

          <div className="calculation-card card-surface">
            <div className="section-heading compact"><div><p className="eyebrow">{tr('نتيجة الحاسبة', 'Calculator result')}</p><h3>{tr('هدفك المقترح', 'Suggested target')}</h3></div><Sparkles size={18} /></div>
            <div className="calculation-grid"><div><small>BMR</small><b>{metricValue(metrics.bmr)}</b><span>kcal</span></div><div><small>{tr('سعرات الثبات', 'Maintenance')}</small><b>{metricValue(metrics.tdee)}</b><span>TDEE</span></div><div className="cal-main"><small>{tr('هدفك اليومي', 'Daily target')}</small><b>{metricValue(metrics.targetCalories)}</b><span>kcal</span></div><div><small>{tr('المعدل الأسبوعي', 'Weekly rate')}</small><b>{metricValue(metrics.weeklyChange.toFixed(2))}</b><span>kg / {tr('أسبوع', 'week')}</span></div></div>
            <div className="calculated-macros">{metrics.isValid ? <><span>{tr('بروتين', 'Protein')} <b>{toArabicNumber(metrics.protein)}g</b></span><span>{tr('كارب', 'Carbs')} <b>{toArabicNumber(metrics.carbs)}g</b></span><span>{tr('دهون', 'Fat')} <b>{toArabicNumber(metrics.fat)}g</b></span></> : <span>{tr('أكمل البيانات الصحيحة لعرض الأهداف.', 'Complete valid details to see targets.')}</span>}</div>
            <button className="primary-btn" disabled={!metrics.isValid} onClick={applyCalculatedGoal}><Check size={16} /> {tr('اعتماد هذا الهدف للخطة', 'Apply this target to the plan')}</button>
          </div>

          <div className="health-note"><HeartPulse size={20} /><p><b>{tr('صحتك أولاً', 'Your health comes first')}</b>{tr('هذه الحسابات إرشادية ولا تغني عن استشارة الطبيب أو مختص التغذية.', 'These calculations are estimates and do not replace advice from a doctor or dietitian.')}</p><Info size={16} /></div>
        </aside>
      </section>

      <section className="account-security-card card-surface">
        <div className="section-heading">
          <div><p className="eyebrow">{tr('الحساب والأمان', 'Account & security')}</p><h2>{tr('تحكم كامل ببيانات حسابك', 'Manage all account information')}</h2><p>{tr('غيّر اسم المستخدم والبريد وكلمة المرور. نطلب كلمة المرور الحالية قبل أي تغيير حساس.', 'Change your username, email, and password. Your current password is required before sensitive changes.')}</p></div>
          <span className="form-heading-icon"><ShieldCheck size={19} /></span>
        </div>
        <form onSubmit={(event) => void saveAccount(event)}>
          <div className="account-security-grid">
            <label><span><AtSign size={14} /> {tr('اسم المستخدم', 'Username')}</span><input value={username} onChange={(event) => { setUsername(event.target.value); setAccountSaved(false) }} autoCapitalize="none" autoComplete="username" minLength={3} maxLength={24} /></label>
            <label><span><Mail size={14} /> {tr('البريد الإلكتروني', 'Email address')}</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setAccountSaved(false) }} autoCapitalize="none" autoComplete="email" /></label>
            <label><span><KeyRound size={14} /> {tr('كلمة المرور الحالية', 'Current password')}</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder={identityChanged || newPassword ? tr('مطلوبة لحفظ التغييرات', 'Required to save changes') : tr('اتركها فارغة إن لم تغيّر بيانات حساسة', 'Leave blank unless changing secure details')} /></label>
            <label><span><KeyRound size={14} /> {tr('كلمة المرور الجديدة', 'New password')}</span><input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setAccountSaved(false) }} autoComplete="new-password" minLength={8} placeholder={tr('٨ أحرف على الأقل', 'At least 8 characters')} /></label>
            <label><span><Check size={14} /> {tr('تأكيد كلمة المرور الجديدة', 'Confirm new password')}</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} /></label>
            <div className="account-member"><small>{tr('عضو منذ', 'Member since')}</small><b>{new Date(account.createdAt).toLocaleDateString()}</b></div>
          </div>
          {accountError && <div className="account-message error" role="alert"><Info size={16} /><span>{accountError}</span></div>}
          {accountSaved && <div className="account-message success" role="status"><Check size={16} /><span>{tr('تم تحديث جميع بيانات الحساب بنجاح.', 'Your account information was updated successfully.')}</span></div>}
          <div className="account-security-actions"><p>{tr('اسم العرض وباقي بيانات الصحة تُحفظ تلقائياً. استخدم هذا الزر لتحديث بيانات الدخول.', 'Display name and health details save automatically. Use this button for sign-in details.')}</p><button className="primary-btn account-save-btn" type="submit" disabled={accountBusy || !profileNameValid}>{accountBusy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ بيانات الحساب', 'Save account details')} <ShieldCheck size={16} /></button></div>
        </form>
      </section>
    </div>
  )
}
