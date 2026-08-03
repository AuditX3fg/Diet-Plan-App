import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Copy, Eye, EyeOff, KeyRound, Leaf, LockKeyhole, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { createAccount, resetPassword, signIn } from '../services/auth'
import type { UserAccount } from '../types'

type AuthMode = 'signin' | 'signup' | 'reset'

interface AuthPageProps {
  onAuthenticated: (account: UserAccount) => void
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [createdAccount, setCreatedAccount] = useState<UserAccount | null>(null)
  const [generatedCode, setGeneratedCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function changeMode(next: AuthMode) {
    setMode(next)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if ((mode === 'signup' || mode === 'reset') && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        onAuthenticated(await signIn(username, password))
      } else if (mode === 'signup') {
        const result = await createAccount({ displayName, username, password })
        setCreatedAccount(result.account)
        setGeneratedCode(result.recoveryCode)
      } else {
        onAuthenticated(await resetPassword({ username, recoveryCode, password }))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copyRecoveryCode() {
    await navigator.clipboard?.writeText(generatedCode)
    setCopied(true)
  }

  if (createdAccount) {
    return (
      <main className="auth-shell" dir="ltr" lang="en">
        <section className="auth-card recovery-card">
          <span className="auth-brand-mark"><ShieldCheck size={27} /></span>
          <p className="auth-kicker">Account created</p>
          <h1>Save your recovery code</h1>
          <p>This is the only way to reset your password. Store it somewhere private before continuing.</p>
          <div className="recovery-code"><code>{generatedCode}</code><button onClick={copyRecoveryCode} aria-label="Copy recovery code">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
          <div className="auth-security-note"><LockKeyhole size={17} /><span>Passwords and recovery codes are stored as one-way hashes. The original values cannot be displayed later.</span></div>
          <button className="auth-submit" onClick={() => onAuthenticated(createdAccount)}>I saved the code <ArrowLeft size={17} /></button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell" dir="ltr" lang="en">
      <section className="auth-showcase">
        <div className="auth-logo"><span><Leaf size={22} /></span><div><b>Tawazon</b><small>Your plan, your way</small></div></div>
        <div className="auth-showcase-copy"><span className="auth-pill"><ShieldCheck size={15} /> Private personal workspace</span><h1>Nutrition built around <em>your</em> plan.</h1><p>Create your account, upload your diet-plan PDF, and keep every meal, target, and progress entry separate from other users.</p></div>
        <div className="auth-feature-row"><span>01</span><p><b>Your account</b><small>Personal profile and secure sign-in</small></p></div>
        <div className="auth-feature-row"><span>02</span><p><b>Your PDF plan</b><small>Meals and requirements extracted for you</small></p></div>
        <div className="auth-feature-row"><span>03</span><p><b>Your progress</b><small>Account-scoped tracking and history</small></p></div>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-logo"><Leaf size={20} /> Tawazon</div>
        <div className="auth-heading">
          <span className="auth-icon">{mode === 'signin' ? <LogIn size={21} /> : mode === 'signup' ? <UserPlus size={21} /> : <KeyRound size={21} />}</span>
          <div><p>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'New account' : 'Account recovery'}</p><h2>{mode === 'signin' ? 'Sign in to continue' : mode === 'signup' ? 'Create your profile' : 'Reset your password'}</h2></div>
        </div>

        <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => changeMode('signin')}><LogIn size={16} /> Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}><UserPlus size={16} /> Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label><span>Full name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Your name" required /></label>}
          <label><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoComplete="username" placeholder="e.g. mohammed" required /></label>
          {mode === 'reset' && <label><span>Recovery code</span><input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="XXXX-XXXX-XXXX" required /></label>}
          <label><span>{mode === 'reset' ? 'New password' : 'Password'}</span><div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {(mode === 'signup' || mode === 'reset') && <label><span>Confirm password</span><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repeat your password" required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'} <ArrowLeft size={17} /></button>
        </form>

        <div className="auth-links">
          {mode === 'signin' ? <button onClick={() => changeMode('reset')}><KeyRound size={14} /> Forgot password?</button> : mode === 'reset' ? <button onClick={() => changeMode('signin')}><ArrowLeft size={14} /> Back to sign in</button> : <span>Already registered? <button onClick={() => changeMode('signin')}>Sign in</button></span>}
        </div>
      </section>
    </main>
  )
}
