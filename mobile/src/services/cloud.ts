import * as SecureStore from 'expo-secure-store'
import type { UserAccount } from '../types'

const baseUrl = (process.env.EXPO_PUBLIC_ACCOUNT_API_URL || process.env.EXPO_PUBLIC_RECOVERY_API_URL || '').trim().replace(/\/$/, '')
const tokenKey = 'tawazon.cloud.token.v1'

export interface CloudState {
  revision: number
  state: Record<string, unknown>
  updatedAt: string
}

export interface CloudResponse {
  account: UserAccount
  token: string
  expiresAt: string
  state: CloudState
  welcomeEmailSent?: boolean
}

async function getToken() { try { return await SecureStore.getItemAsync(tokenKey) } catch { return null } }
async function setToken(value: string) { await SecureStore.setItemAsync(tokenKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED }) }

async function request<T>(path: string, options: RequestInit = {}) {
  if (!baseUrl) throw new Error('Cloud accounts are not configured in this build.')
  const currentToken = await getToken()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`)
  let response: Response
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers }) }
  catch { throw new Error('Could not reach the Tawazon account service. Check your connection and try again.') }
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'The account service could not complete this request.')
  return payload
}

async function remember(response: CloudResponse) { await setToken(response.token); return response }

export function isCloudConfigured() { return Boolean(baseUrl) }
export async function hasCloudSession() { return Boolean(await getToken()) }
export async function cloudRegister(input: { displayName: string; username: string; email: string; password: string; recoveryCode: string }) { return remember(await request<CloudResponse>('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) })) }
export async function cloudLogin(identifier: string, password: string) { return remember(await request<CloudResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) })) }
export async function cloudOfflineReset(identifier: string, recoveryCode: string, password: string) { return remember(await request<CloudResponse>('/v1/recovery/offline', { method: 'POST', body: JSON.stringify({ identifier, recoveryCode, password }) })) }
export async function cloudRequestEmailCode(identifier: string) { return request<{ accepted: boolean; maskedEmail?: string }>('/v1/recovery/request', { method: 'POST', body: JSON.stringify({ identifier }) }) }
export async function cloudEmailReset(identifier: string, code: string, password: string) { return remember(await request<CloudResponse>('/v1/recovery/reset', { method: 'POST', body: JSON.stringify({ identifier, code, password }) })) }
export async function loadCloudState() { if (!baseUrl || !await getToken()) return null; try { return await request<CloudState>('/v1/state') } catch { return null } }
export async function saveCloudState(state: Record<string, unknown>) { if (!baseUrl || !await getToken()) return null; return request<CloudState>('/v1/state', { method: 'PATCH', body: JSON.stringify({ state }) }) }
export async function updateCloudAccount(displayName: string) { if (!baseUrl || !await getToken()) return null; return request<{ account: UserAccount }>('/v1/account', { method: 'PATCH', body: JSON.stringify({ displayName }) }) }
export async function cloudLogout() { if (baseUrl && await getToken()) await request('/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined); await SecureStore.deleteItemAsync(tokenKey).catch(() => undefined) }
