import { createClient } from '@supabase/supabase-js'
import type { AccountUpdateInput, UserAccount } from '../types'

const defaultSupabaseUrl = 'https://wxyrmynixsojofxtpfqi.supabase.co'
const defaultPublishableKey = 'sb_publishable_hJ0TwMjeHZq9pZ0zZlfeHg_tdUNQi8f'
const baseUrl = (import.meta.env.VITE_ACCOUNT_API_URL || import.meta.env.VITE_RECOVERY_API_URL || `${defaultSupabaseUrl}/functions/v1/tawazon-api`).trim().replace(/\/$/, '')
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl).trim().replace(/\/$/, '')
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaultPublishableKey).trim()
const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
  : null
const trainingBucket = 'tawazon-training-videos'
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

export interface CloudTrainingVideo {
  id: string
  sessionId: 'day-1' | 'day-2' | 'day-3' | 'day-4' | 'abs'
  title: string
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface AdminUserSummary {
  id: string
  username: string
  email: string
  display_name: string
  role: 'user' | 'super_admin'
  created_at: string
}

export interface AdminActivityEvent {
  id: number | string
  user_id: string | null
  event_type: string
  page: string | null
  platform: 'web' | 'ios' | 'android' | 'unknown'
  metadata: Record<string, unknown>
  created_at: string
  user?: { username: string; display_name: string; email: string } | null
}

export interface AdminFeedback {
  id: string
  user_id: string
  rating: number
  category: string
  message: string
  page: string | null
  platform: 'web' | 'ios' | 'android' | 'unknown'
  status: 'new' | 'reviewed' | 'resolved'
  email_status: 'pending' | 'sent' | 'not_configured' | 'failed'
  created_at: string
  updated_at: string
  user?: { username: string; display_name: string; email: string } | null
}

export interface AdminOverview {
  summary: { totalUsers: number; active24h: number; events7d: number; newFeedback: number }
  users: AdminUserSummary[]
  events: AdminActivityEvent[]
  feedback: AdminFeedback[]
  feedbackEmailConfigured: boolean
}

interface PreparedTrainingVideo {
  video: CloudTrainingVideo
  upload: { path: string; token: string; signedUrl: string }
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

export async function updateCloudAccount(input: Partial<AccountUpdateInput>) {
  if (!baseUrl || !token()) return null
  return request<{ account: UserAccount; passwordChanged?: boolean }>('/v1/account', { method: 'PATCH', body: JSON.stringify(input) })
}

export async function recordCloudActivity(eventType: 'app_open' | 'page_view', page?: string) {
  if (!baseUrl || !token()) return false
  await request('/v1/activity', { method: 'POST', body: JSON.stringify({ eventType, page, platform: 'web' }) })
  return true
}

export async function submitCloudFeedback(input: { rating: number; category: string; message: string; page?: string }) {
  return request<{ submitted: boolean; emailSent: boolean }>('/v1/feedback', { method: 'POST', body: JSON.stringify({ ...input, platform: 'web' }) })
}

export async function loadCloudAdminOverview() {
  return request<AdminOverview>('/v1/admin/overview')
}

export async function updateCloudFeedbackStatus(feedbackId: string, status: AdminFeedback['status']) {
  return request<{ feedback: AdminFeedback }>(`/v1/admin/feedback/${encodeURIComponent(feedbackId)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function listCloudTrainingVideos() {
  if (!baseUrl || !token()) throw new Error('Sign in to your cloud account to load training videos.')
  return request<{ videos: CloudTrainingVideo[]; editable: boolean }>('/v1/training/videos')
}

export async function updateCloudWorkoutPreference(mode: 'default' | 'custom') {
  if (!baseUrl || !token()) throw new Error('Sign in to choose a workout plan.')
  return request<{ account: UserAccount }>('/v1/workout-preference', { method: 'PATCH', body: JSON.stringify({ mode }) })
}

export async function uploadCloudTrainingVideo(sessionId: CloudTrainingVideo['sessionId'], title: string, file: File) {
  if (!baseUrl || !token()) throw new Error('Sign in to your cloud account before uploading videos.')
  if (!supabase) throw new Error('Private video storage is not configured in this build.')
  const mimeType = file.type || 'video/mp4'
  const prepared = await request<PreparedTrainingVideo>('/v1/training/videos', {
    method: 'POST',
    body: JSON.stringify({ sessionId, title, originalName: file.name, mimeType, sizeBytes: file.size }),
  })
  const { error: uploadError } = await supabase.storage
    .from(trainingBucket)
    .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, { contentType: mimeType })
  if (uploadError) {
    await deleteCloudTrainingVideo(prepared.video.id).catch(() => undefined)
    throw new Error(uploadError.message || 'The training video could not be uploaded.')
  }
  const completed = await request<{ video: CloudTrainingVideo }>(`/v1/training/videos/${encodeURIComponent(prepared.video.id)}/complete`, { method: 'POST', body: '{}' })
  return completed.video
}

export async function deleteCloudTrainingVideo(videoId: string) {
  return request<{ deleted: boolean }>(`/v1/training/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' })
}

export async function moveCloudTrainingVideo(videoId: string, sessionId: CloudTrainingVideo['sessionId']) {
  return request<{ video: CloudTrainingVideo }>(`/v1/training/videos/${encodeURIComponent(videoId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sessionId }),
  })
}

export async function createCloudTrainingVideoUrl(videoId: string, signal?: AbortSignal) {
  if (!baseUrl || !token()) throw new Error('Sign in to play this training video.')
  const payload = await request<{ url: string; expiresAt: string }>(`/v1/training/videos/${encodeURIComponent(videoId)}/playback`, { signal })
  return payload.url
}

export async function cloudLogout() {
  if (baseUrl && token()) await request('/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined)
  window.localStorage.removeItem(tokenKey)
}
