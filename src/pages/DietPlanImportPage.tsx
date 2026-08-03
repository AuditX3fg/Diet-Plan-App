import { useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, Check, FileText, FileUp, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import { parseDietPlanPdf } from '../services/dietPlan'
import type { ImportedDietPlan, UserAccount } from '../types'

interface DietPlanImportPageProps {
  account: UserAccount
  onComplete: (plan: ImportedDietPlan) => void
  onSkip?: () => void
  onCancel?: () => void
}

export function DietPlanImportPage({ account, onComplete, onSkip, onCancel }: DietPlanImportPageProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<ImportedDietPlan | null>(null)

  async function readFile(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setPlan(await parseDietPlanPdf(file))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The PDF could not be read.')
    } finally {
      setBusy(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    void readFile(event.dataTransfer.files[0])
  }

  function updateMetric(key: 'dailyCalories' | 'protein' | 'carbs' | 'fat', value: string) {
    if (!plan) return
    const number = Math.max(0, Number(value))
    setPlan({ ...plan, [key]: number })
  }

  return (
    <main className="import-shell" dir="ltr" lang="en">
      <section className="import-card">
        <header className="import-header">
          <div><span className="auth-brand-mark"><Sparkles size={24} /></span><p className="auth-kicker">Personalize your account</p><h1>Upload your diet plan</h1><p>Hi {account.displayName.split(' ')[0]}. Add the PDF from your dietitian and Tawazon will extract your daily requirements and meal structure.</p></div>
          {onCancel && <button className="import-close" onClick={onCancel} aria-label="Close PDF import"><X size={19} /></button>}
        </header>

        {!plan ? (
          <>
            <button
              className={dragging ? 'pdf-dropzone dragging' : 'pdf-dropzone'}
              onClick={() => fileInput.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              disabled={busy}
            >
              <span className="pdf-icon">{busy ? <LoaderCircle className="spin" size={30} /> : <FileUp size={30} />}</span>
              <b>{busy ? 'Reading your plan…' : 'Drop your PDF here'}</b>
              <p>{busy ? 'Extracting text, meals, and nutrition requirements.' : 'or click to choose a file · PDF only · maximum 10 MB'}</p>
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => void readFile(event.target.files?.[0])} hidden />
            {error && <p className="import-error" role="alert">{error}</p>}
            <div className="import-privacy"><ShieldCheck size={18} /><span><b>Processed on this device</b><small>The PDF is read in your browser. Only its extracted plan data is saved to this account.</small></span></div>
            {onSkip && <button className="import-skip" onClick={onSkip}>Use the standard catalogue for now</button>}
          </>
        ) : (
          <div className="plan-review">
            <div className="parsed-file"><span><FileText size={20} /></span><div><b>{plan.fileName}</b><small>{plan.pageCount} {plan.pageCount === 1 ? 'page' : 'pages'} · {plan.extractedCharacters.toLocaleString()} characters extracted</small></div><button onClick={() => setPlan(null)}>Choose another</button></div>

            <section className="requirements-review">
              <div className="review-heading"><div><p className="auth-kicker">Detected requirements</p><h2>Confirm your daily targets</h2></div><span><Check size={14} /> Editable</span></div>
              <div className="requirements-grid">
                <label><span>Calories</span><input type="number" min="800" max="6000" value={plan.dailyCalories} onChange={(event) => updateMetric('dailyCalories', event.target.value)} /><small>kcal</small></label>
                <label><span>Protein</span><input type="number" min="20" max="500" value={plan.protein} onChange={(event) => updateMetric('protein', event.target.value)} /><small>g</small></label>
                <label><span>Carbs</span><input type="number" min="20" max="800" value={plan.carbs} onChange={(event) => updateMetric('carbs', event.target.value)} /><small>g</small></label>
                <label><span>Fat</span><input type="number" min="15" max="300" value={plan.fat} onChange={(event) => updateMetric('fat', event.target.value)} /><small>g</small></label>
              </div>
            </section>

            <section className="parsed-meals">
              <div className="review-heading"><div><p className="auth-kicker">Meal structure</p><h2>Meals found in your PDF</h2></div><span>{plan.meals.filter((meal) => meal.items.length > 0).length} / 4 detected</span></div>
              <div className="parsed-meal-grid">{plan.meals.map((meal) => <article key={meal.id}><span className={`parsed-meal-icon ${meal.id}`}>{meal.id === 'breakfast' ? '🍳' : meal.id === 'snack' ? '🥣' : meal.id === 'lunch' ? '🍗' : '🍽️'}</span><div><small>{meal.id}</small><b>{meal.title}</b><p>{meal.items.join(' · ') || 'No dedicated section detected; target values will use the standard catalogue.'}</p></div><em>{meal.calories} kcal</em></article>)}</div>
            </section>

            {plan.notes.length > 0 && <section className="parsed-notes"><p className="auth-kicker">Notes detected</p>{plan.notes.map((note, index) => <span key={`${note}-${index}`}>{note}</span>)}</section>}
            <button className="auth-submit import-confirm" onClick={() => onComplete(plan)}>Load this plan into my account <ArrowLeft size={17} /></button>
          </div>
        )}
      </section>
    </main>
  )
}
