import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { UserAccount } from '../types'
import { registerRecoveryEmail, requestRecoveryEmail, verifyRecoveryEmail } from './recoveryEmail'
import { cloudEmailReset, cloudLogin, cloudLogout, cloudOfflineReset, cloudRegister, cloudRequestEmailCode, isCloudConfigured, updateCloudAccount } from './cloud'

const ACCOUNT_INDEX_KEY = 'tawazon.mobile.accounts.v1'
const SESSION_KEY = 'tawazon.mobile.session.v1'
const SECRET_FALLBACK_PREFIX = 'tawazon.mobile.secret.'
const ITERATIONS = 120_000

interface SecretRecord {
  salt: string
  hash: string
}

async function loadAccounts(): Promise<UserAccount[]> {
  try {
    const stored = await AsyncStorage.getItem(ACCOUNT_INDEX_KEY)
    return stored ? JSON.parse(stored) as UserAccount[] : []
  } catch {
    return []
  }
}

async function saveAccounts(accounts: UserAccount[]) {
  await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(accounts))
}

async function secureAvailable() {
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

async function setSecret(key: string, value: string) {
  if (await secureAvailable()) {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED })
    return
  }
  await AsyncStorage.setItem(`${SECRET_FALLBACK_PREFIX}${key}`, value)
}

async function getSecret(key: string) {
  if (await secureAvailable()) return SecureStore.getItemAsync(key)
  return AsyncStorage.getItem(`${SECRET_FALLBACK_PREFIX}${key}`)
}

async function deleteSecret(key: string) {
  if (await secureAvailable()) return SecureStore.deleteItemAsync(key)
  return AsyncStorage.removeItem(`${SECRET_FALLBACK_PREFIX}${key}`)
}

function passwordKey(accountId: string) {
  return `tawazon.password.${accountId}`
}

function recoveryKey(accountId: string) {
  return `tawazon.recovery.${accountId}`
}

async function randomHex(length = 16) {
  return bytesToHex(await Crypto.getRandomBytesAsync(length))
}

async function deriveSecret(value: string, salt: string) {
  const bytes = await pbkdf2Async(sha256, value, salt, { c: ITERATIONS, dkLen: 32, asyncTick: 8 })
  return bytesToHex(bytes)
}

function normalizeRecovery(value: string) {
  return value.trim().replace(/[\s-]/g, '').toUpperCase()
}

async function createSecretRecord(value: string): Promise<SecretRecord> {
  const salt = await randomHex()
  return { salt, hash: await deriveSecret(value, salt) }
}

async function verifySecret(value: string, record: SecretRecord) {
  return await deriveSecret(value, record.salt) === record.hash
}

async function setSession(accountId: string) {
  await setSecret(SESSION_KEY, accountId)
}

export function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = Crypto.getRandomBytes(12)
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return raw.match(/.{1,4}/g)?.join('-') ?? raw
}

export async function getCurrentAccount() {
  const accountId = await getSecret(SESSION_KEY)
  if (!accountId) return null
  const account = (await loadAccounts()).find((item) => item.id === accountId) ?? null
  if (!account) await deleteSecret(SESSION_KEY)
  return account
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function findAccount(accounts: UserAccount[], identifier: string) {
  const normalized = identifier.trim().toLowerCase()
  return accounts.find((item) => item.username === normalized || item.email === normalized)
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  const shown = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2)
  return `${shown}${'*'.repeat(Math.max(2, local.length - shown.length))}@${domain}`
}

async function replacePassword(account: UserAccount, password: string) {
  await setSecret(passwordKey(account.id), JSON.stringify(await createSecretRecord(password)))
  await setSession(account.id)
  return account
}

export async function createAccount(input: { displayName: string; username: string; email: string; password: string }) {
  const displayName = input.displayName.trim()
  const username = input.username.trim().toLowerCase()
  const email = normalizeEmail(input.email)
  if (displayName.length < 2) throw new Error('Enter your full name.')
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new Error('Use 3–24 letters, numbers, dots, dashes, or underscores.')
  if (!validEmail(email)) throw new Error('Enter a valid email address for password recovery.')
  if (input.password.length < 8) throw new Error('Password must contain at least 8 characters.')

  if (isCloudConfigured()) {
    const recoveryCode = generateRecoveryCode()
    const response = await cloudRegister({ displayName, username, email, password: input.password, recoveryCode })
    await saveAccounts([response.account])
    await setSession(response.account.id)
    return { account: response.account, recoveryCode, recoveryEmailSent: Boolean(response.welcomeEmailSent) }
  }

  const accounts = await loadAccounts()
  if (accounts.some((account) => account.username === username)) throw new Error('That username is already in use.')
  if (accounts.some((account) => account.email === email)) throw new Error('That email is already connected to an account.')

  const account: UserAccount = { id: Crypto.randomUUID(), username, email, displayName, createdAt: new Date().toISOString() }
  const recoveryCode = generateRecoveryCode()
  await Promise.all([
    setSecret(passwordKey(account.id), JSON.stringify(await createSecretRecord(input.password))),
    setSecret(recoveryKey(account.id), JSON.stringify(await createSecretRecord(normalizeRecovery(recoveryCode)))),
  ])
  await saveAccounts([...accounts, account])
  await setSession(account.id)
  let recoveryEmailSent = false
  try {
    await registerRecoveryEmail(account, recoveryCode)
    recoveryEmailSent = true
  } catch {
    // Account creation remains usable offline. The recovery code is still shown once.
  }
  return { account, recoveryCode, recoveryEmailSent }
}

export async function signIn(usernameInput: string, password: string) {
  const username = usernameInput.trim().toLowerCase()
  if (isCloudConfigured()) {
    const response = await cloudLogin(username, password)
    const accounts = await loadAccounts()
    await saveAccounts([response.account, ...accounts.filter((item) => item.id !== response.account.id)])
    await setSession(response.account.id)
    return response.account
  }
  const account = (await loadAccounts()).find((item) => item.username === username)
  if (!account) throw new Error('Username or password is incorrect.')
  const stored = await getSecret(passwordKey(account.id))
  if (!stored || !await verifySecret(password, JSON.parse(stored) as SecretRecord)) throw new Error('Username or password is incorrect.')
  await setSession(account.id)
  return account
}

export async function resetPassword(input: { username: string; recoveryCode: string; password: string }) {
  if (input.password.length < 8) throw new Error('New password must contain at least 8 characters.')
  if (isCloudConfigured()) {
    const response = await cloudOfflineReset(input.username, input.recoveryCode, input.password)
    const accounts = await loadAccounts()
    await saveAccounts([response.account, ...accounts.filter((item) => item.id !== response.account.id)])
    await setSession(response.account.id)
    return response.account
  }
  const account = (await loadAccounts()).find((item) => item.username === input.username.trim().toLowerCase())
  if (!account) throw new Error('The username or recovery code is incorrect.')
  const storedRecovery = await getSecret(recoveryKey(account.id))
  if (!storedRecovery || !await verifySecret(normalizeRecovery(input.recoveryCode), JSON.parse(storedRecovery) as SecretRecord)) {
    throw new Error('The username or recovery code is incorrect.')
  }
  return replacePassword(account, input.password)
}

export async function sendEmailRecoveryCode(identifier: string) {
  if (isCloudConfigured()) {
    const result = await cloudRequestEmailCode(identifier)
    return { maskedEmail: result.maskedEmail || 'your recovery email' }
  }
  const account = findAccount(await loadAccounts(), identifier)
  if (!account) throw new Error('No matching account was found on this device.')
  if (!account.email) throw new Error('This older account has no recovery email. Use the saved recovery code.')
  await registerRecoveryEmail(account)
  await requestRecoveryEmail(account.email)
  return { maskedEmail: maskEmail(account.email) }
}

export async function resetPasswordWithEmail(input: { identifier: string; emailCode: string; password: string }) {
  if (input.password.length < 8) throw new Error('New password must contain at least 8 characters.')
  if (!/^\d{6}$/.test(input.emailCode.trim())) throw new Error('Enter the six-digit code from your email.')
  if (isCloudConfigured()) {
    const response = await cloudEmailReset(input.identifier, input.emailCode.trim(), input.password)
    const accounts = await loadAccounts()
    await saveAccounts([response.account, ...accounts.filter((item) => item.id !== response.account.id)])
    await setSession(response.account.id)
    return response.account
  }
  const account = findAccount(await loadAccounts(), input.identifier)
  if (!account?.email) throw new Error('No email-enabled account was found on this device.')
  const verified = await verifyRecoveryEmail(account.email, input.emailCode.trim())
  if (verified.accountId !== account.id) throw new Error('The email code could not be verified for this account.')
  return replacePassword(account, input.password)
}

export async function updateAccount(accountId: string, displayName: string) {
  const accounts = await loadAccounts()
  const index = accounts.findIndex((item) => item.id === accountId)
  if (index < 0) throw new Error('Account not found.')
  if (isCloudConfigured()) {
    const response = await updateCloudAccount(displayName)
    if (!response) throw new Error('Could not update this cloud account.')
    accounts[index] = response.account
    await saveAccounts(accounts)
    return response.account
  }
  accounts[index] = { ...accounts[index], displayName: displayName.trim() || accounts[index].displayName }
  await saveAccounts(accounts)
  return accounts[index]
}

export async function addRecoveryEmail(accountId: string, emailInput: string) {
  const email = normalizeEmail(emailInput)
  if (!validEmail(email)) throw new Error('Enter a valid recovery email address.')
  const accounts = await loadAccounts()
  const index = accounts.findIndex((item) => item.id === accountId)
  if (index < 0) throw new Error('Account not found.')
  if (accounts[index].email) throw new Error('This account already has a recovery email.')
  if (accounts.some((item) => item.id !== accountId && item.email === email)) throw new Error('That email is already connected to an account.')
  const next = { ...accounts[index], email }
  await registerRecoveryEmail(next)
  accounts[index] = next
  await saveAccounts(accounts)
  return next
}

export async function signOut() {
  if (isCloudConfigured()) await cloudLogout()
  await deleteSecret(SESSION_KEY)
}
