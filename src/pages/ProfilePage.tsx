import { Calculator, Check, CircleUserRound, HeartPulse, Info, Sparkles, Target } from 'lucide-react'
import type { UserProfile } from '../types'
import { tr } from '../i18n'
import { calculateHealthMetrics, toArabicNumber } from '../utils'

interface ProfilePageProps {
  profile: UserProfile
  onChange: (profile: UserProfile) => void
}

const activityOptions = [
  { id: 'sedentary', label: 'قليل (مكتبي)', labelEn: 'Low (desk-based)' },
  { id: 'light', label: 'خفيف (١–٣ أيام)', labelEn: 'Light (1–3 days)' },
  { id: 'moderate', label: 'متوسط (٣–٥ أيام)', labelEn: 'Moderate (3–5 days)' },
  { id: 'active', label: 'نشط (٦–٧ أيام)', labelEn: 'Active (6–7 days)' },
  { id: 'very-active', label: 'نشط جداً', labelEn: 'Very active' },
] as const

export function ProfilePage({ profile, onChange }: ProfilePageProps) {
  const metrics = calculateHealthMetrics(profile)
  const bmiLabel = metrics.bmi < 18.5 ? tr('أقل من الطبيعي', 'Underweight') : metrics.bmi < 25 ? tr('ضمن النطاق الصحي', 'Healthy range') : metrics.bmi < 30 ? tr('فوق الطبيعي', 'Overweight') : tr('مرتفع', 'High')

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    onChange({ ...profile, [key]: value })
  }

  function applyCalculatedGoal() {
    onChange({ ...profile, targetCalories: metrics.targetCalories, targetProtein: metrics.protein, targetCarbs: metrics.carbs, targetFat: metrics.fat })
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
            <label><span>{tr('الجنس', 'Gender')}</span><select value={profile.gender} onChange={(event) => update('gender', event.target.value as UserProfile['gender'])}><option value="male">{tr('ذكر', 'Male')}</option><option value="female">{tr('أنثى', 'Female')}</option></select></label>
            <label><span>{tr('العمر', 'Age')}</span><div className="unit-input"><input type="number" min="14" max="100" value={profile.age} onChange={(event) => update('age', Number(event.target.value))} /><small>{tr('سنة', 'years')}</small></div></label>
            <label><span>{tr('الطول', 'Height')}</span><div className="unit-input"><input type="number" min="120" max="230" value={profile.height} onChange={(event) => update('height', Number(event.target.value))} /><small>cm</small></div></label>
            <label><span>{tr('الوزن الحالي', 'Current weight')}</span><div className="unit-input"><input type="number" min="30" max="300" step="0.1" value={profile.weight} onChange={(event) => update('weight', Number(event.target.value))} /><small>kg</small></div></label>
            <label><span>{tr('الوزن المستهدف', 'Target weight')}</span><div className="unit-input"><input type="number" min="30" max="300" step="0.1" value={profile.targetWeight} onChange={(event) => update('targetWeight', Number(event.target.value))} /><small>kg</small></div></label>
            <label><span>{tr('المدة المستهدفة', 'Target duration')}</span><div className="unit-input"><input type="number" min="1" max="104" value={profile.goalWeeks} onChange={(event) => update('goalWeeks', Number(event.target.value))} /><small>{tr('أسبوع', 'weeks')}</small></div></label>
            <label className="full"><span>{tr('مستوى النشاط', 'Activity level')}</span><select value={profile.activityLevel} onChange={(event) => update('activityLevel', event.target.value as UserProfile['activityLevel'])}>{activityOptions.map((item) => <option key={item.id} value={item.id}>{tr(item.label, item.labelEn)}</option>)}</select></label>
            <label className="full"><span>{tr('الهدف', 'Goal')}</span><div className="goal-segment"><button className={profile.goal === 'lose' ? 'active' : ''} onClick={() => update('goal', 'lose')} type="button">{tr('خسارة وزن', 'Lose weight')}</button><button className={profile.goal === 'maintain' ? 'active' : ''} onClick={() => update('goal', 'maintain')} type="button">{tr('ثبات', 'Maintain')}</button><button className={profile.goal === 'gain' ? 'active' : ''} onClick={() => update('goal', 'gain')} type="button">{tr('زيادة وزن', 'Gain weight')}</button></div></label>
          </div>

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
            <div className="bmi-value"><strong>{toArabicNumber(metrics.bmi.toFixed(1))}</strong><span>{bmiLabel}</span></div>
            <div className="bmi-scale"><i className="low" /><i className="healthy" /><i className="high" /><i className="very-high" /><span style={{ right: `${Math.max(2, Math.min(96, ((metrics.bmi - 15) / 25) * 100))}%` }} /></div>
            <div className="bmi-labels"><span>{toArabicNumber(15)}</span><span>{tr('طبيعي', 'Healthy')}</span><span>{toArabicNumber(40)}</span></div>
            <p className="healthy-range">{tr('النطاق الصحي لوزنك:', 'Healthy weight range:')} <b>{toArabicNumber(metrics.healthyMin.toFixed(1))}–{toArabicNumber(metrics.healthyMax.toFixed(1))} kg</b></p>
          </div>

          <div className="calculation-card card-surface">
            <div className="section-heading compact"><div><p className="eyebrow">{tr('نتيجة الحاسبة', 'Calculator result')}</p><h3>{tr('هدفك المقترح', 'Suggested target')}</h3></div><Sparkles size={18} /></div>
            <div className="calculation-grid"><div><small>BMR</small><b>{toArabicNumber(metrics.bmr)}</b><span>kcal</span></div><div><small>{tr('سعرات الثبات', 'Maintenance')}</small><b>{toArabicNumber(metrics.tdee)}</b><span>TDEE</span></div><div className="cal-main"><small>{tr('هدفك اليومي', 'Daily target')}</small><b>{toArabicNumber(metrics.targetCalories)}</b><span>kcal</span></div><div><small>{tr('المعدل الأسبوعي', 'Weekly rate')}</small><b>{toArabicNumber(metrics.weeklyChange.toFixed(2))}</b><span>kg / {tr('أسبوع', 'week')}</span></div></div>
            <div className="calculated-macros"><span>{tr('بروتين', 'Protein')} <b>{toArabicNumber(metrics.protein)}g</b></span><span>{tr('كارب', 'Carbs')} <b>{toArabicNumber(metrics.carbs)}g</b></span><span>{tr('دهون', 'Fat')} <b>{toArabicNumber(metrics.fat)}g</b></span></div>
            <button className="primary-btn" onClick={applyCalculatedGoal}><Check size={16} /> {tr('اعتماد هذا الهدف للخطة', 'Apply this target to the plan')}</button>
          </div>

          <div className="health-note"><HeartPulse size={20} /><p><b>{tr('صحتك أولاً', 'Your health comes first')}</b>{tr('هذه الحسابات إرشادية ولا تغني عن استشارة الطبيب أو مختص التغذية.', 'These calculations are estimates and do not replace advice from a doctor or dietitian.')}</p><Info size={16} /></div>
        </aside>
      </section>
    </div>
  )
}
