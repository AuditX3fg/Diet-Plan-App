import type { UserAccount } from '../types'

const baseUrl = (import.meta.env.VITE_ACCOUNT_API_URL || import.meta.env.VITE_RECOVERY_API_URL || '').trim().replace(/\/$/, '')
const tokenKey = 'tawazon-cloud-token-v1'

interface CloudResponse {
  account: UserAccount
  token: string
  expiresAt: string
  state: CloudState
  welcomeEmailSent?: boolean
}

export interface CloudState {
  revision: number
  state: Record<string, unknown>
  updatedAt: string
}

function token() { return window.localStorage.getItem(tokenKey) || '' }

async function request<T>(path: string, options: RequestInit = {}) {
  if (!baseUrl) throw new Error('Cloud accounts are not configured in this build.')
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token()) headers.set('Authorization', `Bearer ${token()}`)
  let response: Response
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers }) }
  catch { throw new Error('Could not reach the Tawazon account service. Check your connection and try again.') }
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'The account service could not complete this request.')
  return payload
}

function rememberSession(response: CloudResponse) {
  window.localStorage.setItem(tokenKey, response.token)
  return response
}

export function isCloudConfigured() { return Boolean(baseUrl) }
export function hasCloudSession() { return Boolean(token()) }

export async function cloudRegister(input: { displayName: string; username: string; email: string; password: string; recoveryCode: string }) {
  return rememberSession(await request<CloudResponse>('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }))
}

export async function cloudLogin(identifier: string, password: string) {
  return rememberSession(await request<CloudResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }))
}

export async function cloudOfflineReset(identifier: string, recoveryCode: string, password: string) {
  return rememberSession(await request<CloudResponse>('/v1/recovery/offline', { method: 'POST', body: JSON.stringify({ identifier, recoveryCode, password }) }))
}

export async function cloudRequestEmailCode(identifier: string) {
  return request<{ accepted: boolean; maskedEmail?: string }>('/v1/recovery/request', { method: 'POST', body: JSON.stringify({ identifier }) })
}

export async function cloudEmailReset(identifier: string, code: string, password: string) {
  return rememberSession(await request<CloudResponse>('/v1/recovery/reset', { method: 'POST', body: JSON.stringify({ identifier, code, password }) }))
}

export async function loadCloudState() {
  if (!baseUrl || !token()) return null
  try { return await request<CloudState>('/v1/state') }
  catch { return null }
}

export async function saveCloudState(state: Record<string, unknown>) {
  if (!baseUrl || !token()) return null
  return request<CloudState>('/v1/state', { method: 'PATCH', body: JSON.stringify({ state }) })
}

export async function updateCloudAccount(displayName: string) {
  if (!baseUrl || !token()) return null
  return request<{ account: UserAccount }>('/v1/account', { method: 'PATCH', body: JSON.stringify({ displayName }) })
}

export async function cloudLogout() {
  if (baseUrl && token()) await request('/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined)
  window.localStorage.removeItem(tokenKey)
}
