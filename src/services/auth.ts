import type { ImportedDietPlan, UserAccount } from '../types'
import { sendWelcomeEmail } from './recoveryEmail'
import { cloudLogin, cloudLogout, cloudOfflineReset, cloudRegister, isCloudConfigured, saveCloudState, updateCloudAccount } from './cloud'

const ACCOUNTS_KEY = 'tawazon-accounts-v1'
const SESSION_KEY = 'tawazon-session-v1'
const CLOUD_ACCOUNT_KEY = 'tawazon-cloud-account-v1'
const HASH_ITERATIONS = 150_000

interface StoredAccount extends UserAccount {
  passwordHash: string
  passwordSalt: string
  recoveryHash: string
  recoverySalt: string
}

interface SessionRecord {
  accountId: string
  createdAt: string
}

function loadAccounts(): StoredAccount[] {
  try {
    const stored = window.localStorage.getItem(ACCOUNTS_KEY)
    return stored ? JSON.parse(stored) as StoredAccount[] : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function publicAccount(account: StoredAccount): UserAccount {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, recoveryHash: _recoveryHash, recoverySalt: _recoverySalt, ...safe } = account
  return safe
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return window.btoa(binary)
}

function randomToken(bytes = 18) {
  const value = new Uint8Array(bytes)
  window.crypto.getRandomValues(value)
  return bytesToBase64(value).replace(/[+/=]/g, '').slice(0, bytes * 2)
}

function recoveryCode() {
  const raw = randomToken(12).toUpperCase().slice(0, 12)
  return raw.match(/.{1,4}/g)?.join('-') ?? raw
}

function normalizeSecret(value: string) {
  return value.trim().replace(/[\s-]/g, '').toUpperCase()
}

async function hashSecret(secret: string, salt: string) {
  const encoder = new TextEncoder()
  const key = await window.crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: HASH_ITERATIONS },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function setSession(accountId: string) {
  const session: SessionRecord = { accountId, createdAt: new Date().toISOString() }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function cloudAccountWithState(account: UserAccount, state: Record<string, unknown>) {
  return { ...account, dietPlan: state.dietPlan as ImportedDietPlan | undefined, planSkippedAt: state.planSkippedAt as string | undefined }
}

function saveCloudAccount(account: UserAccount) {
  window.localStorage.setItem(CLOUD_ACCOUNT_KEY, JSON.stringify(account))
}

export function getCurrentAccount(): UserAccount | null {
  try {
    if (isCloudConfigured()) {
      const cloudAccount = window.localStorage.getItem(CLOUD_ACCOUNT_KEY)
      return cloudAccount ? JSON.parse(cloudAccount) as UserAccount : null
    }
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const session = JSON.parse(stored) as SessionRecord
    const account = loadAccounts().find((item) => item.id === session.accountId)
    if (!account) {
      window.localStorage.removeItem(SESSION_KEY)
      return null
    }
    return publicAccount(account)
  } catch {
    return null
  }
}

export async function createAccount(input: { displayName: string; username: string; email: string; password: string }) {
  const displayName = input.displayName.trim()
  const username = input.username.trim().toLowerCase()
  const email = input.email.trim().toLowerCase()
  if (displayName.length < 2) throw new Error('Enter your full name.')
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new Error('Username must be 3–24 characters using letters, numbers, dots, dashes, or underscores.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address.')
  if (input.password.length < 8) throw new Error('Password must contain at least 8 characters.')

  if (isCloudConfigured()) {
    const code = recoveryCode()
    const response = await cloudRegister({ displayName, username, email, password: input.password, recoveryCode: code })
    const account = cloudAccountWithState(response.account, response.state.state)
    saveCloudAccount(account)
    return { account, recoveryCode: code, welcomeEmailSent: Boolean(response.welcomeEmailSent) }
  }

  const accounts = loadAccounts()
  if (accounts.some((account) => account.username === username)) throw new Error('That username is already in use.')
  if (accounts.some((account) => account.email === email)) throw new Error('That email is already connected to an account.')

  const passwordSalt = randomToken()
  const recoverySalt = randomToken()
  const code = recoveryCode()
  const account: StoredAccount = {
    id: window.crypto.randomUUID?.() ?? `${Date.now()}-${randomToken(6)}`,
    username,
    email,
    displayName,
    createdAt: new Date().toISOString(),
    passwordHash: await hashSecret(input.password, passwordSalt),
    passwordSalt,
    recoveryHash: await hashSecret(normalizeSecret(code), recoverySalt),
    recoverySalt,
  }
  saveAccounts([...accounts, account])
  setSession(account.id)
  const safeAccount = publicAccount(account)
  let welcomeEmailSent = false
  try { welcomeEmailSent = await sendWelcomeEmail(safeAccount, code) } catch { /* The offline account remains usable. */ }
  return { account: safeAccount, recoveryCode: code, welcomeEmailSent }
}

export async function signIn(usernameInput: string, password: string) {
  const username = usernameInput.trim().toLowerCase()
  if (isCloudConfigured()) {
    const response = await cloudLogin(username, password)
    const account = cloudAccountWithState(response.account, response.state.state)
    saveCloudAccount(account)
    return account
  }
  const account = loadAccounts().find((item) => item.username === username)
  if (!account) throw new Error('Username or password is incorrect.')
  const passwordHash = await hashSecret(password, account.passwordSalt)
  if (passwordHash !== account.passwordHash) throw new Error('Username or password is incorrect.')
  setSession(account.id)
  return publicAccount(account)
}

export function signOut() {
  if (isCloudConfigured()) {
    window.localStorage.removeItem(CLOUD_ACCOUNT_KEY)
    void cloudLogout()
    return
  }
  window.localStorage.removeItem(SESSION_KEY)
}

export function subscribeToAuthChanges(listener: (account: UserAccount | null) => void) {
  function syncAccount(event: StorageEvent) {
    if (event.key === SESSION_KEY || event.key === ACCOUNTS_KEY || event.key === CLOUD_ACCOUNT_KEY || event.key === null) {
      listener(getCurrentAccount())
    }
  }

  window.addEventListener('storage', syncAccount)
  return () => window.removeEventListener('storage', syncAccount)
}

export async function resetPassword(input: { username: string; recoveryCode: string; password: string }) {
  if (input.password.length < 8) throw new Error('New password must contain at least 8 characters.')
  const username = input.username.trim().toLowerCase()
  if (isCloudConfigured()) {
    const response = await cloudOfflineReset(username, input.recoveryCode, input.password)
    const account = cloudAccountWithState(response.account, response.state.state)
    saveCloudAccount(account)
    return account
  }
  const accounts = loadAccounts()
  const index = accounts.findIndex((item) => item.username === username)
  if (index < 0) throw new Error('The username or recovery code is incorrect.')
  const account = accounts[index]
  const recoveryHash = await hashSecret(normalizeSecret(input.recoveryCode), account.recoverySalt)
  if (recoveryHash !== account.recoveryHash) throw new Error('The username or recovery code is incorrect.')
  const passwordSalt = randomToken()
  accounts[index] = { ...account, passwordSalt, passwordHash: await hashSecret(input.password, passwordSalt) }
  saveAccounts(accounts)
  setSession(account.id)
  return publicAccount(accounts[index])
}

export function updateAccount(accountId: string, patch: Partial<Pick<UserAccount, 'displayName' | 'dietPlan' | 'planSkippedAt'>>) {
  if (isCloudConfigured()) {
    const current = getCurrentAccount()
    if (!current || current.id !== accountId) throw new Error('Account not found.')
    const next = { ...current, ...patch }
    saveCloudAccount(next)
    if (patch.displayName) void updateCloudAccount(patch.displayName)
    if ('dietPlan' in patch || 'planSkippedAt' in patch) void saveCloudState({ dietPlan: patch.dietPlan ?? null, planSkippedAt: patch.planSkippedAt ?? null })
    return next
  }
  const accounts = loadAccounts()
  const index = accounts.findIndex((account) => account.id === accountId)
  if (index < 0) throw new Error('Account not found.')
  accounts[index] = { ...accounts[index], ...patch }
  saveAccounts(accounts)
  return publicAccount(accounts[index])
}

export function saveDietPlan(accountId: string, dietPlan: ImportedDietPlan) {
  return updateAccount(accountId, { dietPlan, planSkippedAt: undefined })
}

export function accountStorageKey(accountId: string, key: string) {
  return `tawazon-user:${accountId}:${key}`
}
