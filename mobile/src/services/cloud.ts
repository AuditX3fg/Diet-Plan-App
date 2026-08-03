import * as SecureStore from 'expo-secure-store'
import type { VideoSource } from 'expo-video'
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

export interface CloudTrainingVideo {
  id: string
  sessionId: 'day-1' | 'day-2' | 'day-3' | 'day-4' | 'abs'
  title: string
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
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
export async function listCloudTrainingVideos() {
  if (!baseUrl || !await getToken()) throw new Error('Sign in to your cloud account to load training videos.')
  return request<{ videos: CloudTrainingVideo[] }>('/v1/training/videos')
}
export async function uploadCloudTrainingVideo(sessionId: CloudTrainingVideo['sessionId'], title: string, asset: { uri: string; name: string; mimeType?: string | null }) {
  const currentToken = await getToken()
  if (!baseUrl || !currentToken) throw new Error('Sign in to your cloud account before uploading videos.')
  const parameters = new URLSearchParams({ sessionId, title, originalName: asset.name })
  let localResponse: Response
  try { localResponse = await fetch(asset.uri) }
  catch { throw new Error('The selected video could not be read.') }
  const body = await localResponse.blob()
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': asset.mimeType || body.type || 'video/mp4', Authorization: `Bearer ${currentToken}` })
  let response: Response
  try { response = await fetch(`${baseUrl}/v1/training/videos?${parameters}`, { method: 'POST', headers, body }) }
  catch { throw new Error('Could not upload this video. Check your connection and try again.') }
  const payload = await response.json().catch(() => ({})) as { video?: CloudTrainingVideo; error?: string }
  if (!response.ok || !payload.video) throw new Error(payload.error || 'The training video could not be uploaded.')
  return payload.video
}
export async function deleteCloudTrainingVideo(videoId: string) { return request<{ deleted: boolean }>(`/v1/training/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' }) }
export async function cloudTrainingVideoSource(videoId: string, title: string): Promise<VideoSource> {
  const currentToken = await getToken()
  if (!baseUrl || !currentToken) throw new Error('Sign in to play this training video.')
  return { uri: `${baseUrl}/v1/training/videos/${encodeURIComponent(videoId)}/content`, headers: { Authorization: `Bearer ${currentToken}` }, useCaching: true, metadata: { title, artist: 'Tawazon Coaching' } }
}
export async function cloudLogout() { if (baseUrl && await getToken()) await request('/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined); await SecureStore.deleteItemAsync(tokenKey).catch(() => undefined) }
