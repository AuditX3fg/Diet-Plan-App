import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})
function createAuthClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

const bucket = 'tawazon-training-videos'
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
const recoveryIterations = 150_000
const maxVideoBytes = 100 * 1024 * 1024
const maxLibraryBytes = 2 * 1024 * 1024 * 1024
const maxVideosPerDay = 50
const trainingSessions = new Set(['day-1', 'day-2', 'day-3', 'day-4', 'abs'])
const videoExtensions = new Map([
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['video/webm', 'webm'],
])

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface ProfileRow {
  id: string
  username: string
  email: string
  display_name: string
  created_at: string
}

interface StateRow {
  revision: number
  state: Record<string, unknown>
  updated_at: string
}

interface VideoRow {
  id: string
  user_id: string
  session_id: 'day-1' | 'day-2' | 'day-3' | 'day-4' | 'abs'
  title: string
  original_name: string
  object_path: string
  mime_type: string
  size_bytes: number
  status: 'pending' | 'ready'
  created_at: string
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function normalizeRecovery(value: unknown) {
  return String(value ?? '').trim().replace(/[\s-]/g, '').toUpperCase()
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomValue(bytes = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

async function deriveRecoveryHash(value: string, salt: string, iterations = recoveryIterations) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}

async function readJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Invalid JSON request.')
  }
}

function publicAccount(profile: ProfileRow) {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    displayName: profile.display_name,
    createdAt: profile.created_at,
  }
}

function statePayload(row: StateRow | null) {
  return row
    ? { revision: Number(row.revision), state: row.state ?? {}, updatedAt: row.updated_at }
    : { revision: 0, state: {}, updatedAt: new Date().toISOString() }
}

function videoPayload(video: VideoRow) {
  return {
    id: video.id,
    sessionId: video.session_id,
    title: video.title,
    originalName: video.original_name,
    mimeType: video.mime_type,
    sizeBytes: Number(video.size_bytes),
    createdAt: video.created_at,
  }
}

async function profileById(userId: string) {
  const { data, error } = await admin.from('tawazon_profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Account not found.')
  return data as ProfileRow
}

async function profileByIdentifier(identifierInput: unknown) {
  const identifier = normalize(identifierInput)
  if (!identifier) return null
  const column = isEmail(identifier) ? 'email' : 'username'
  const { data, error } = await admin.from('tawazon_profiles').select('*').eq(column, identifier).maybeSingle()
  if (error) throw error
  return data as ProfileRow | null
}

async function loadState(userId: string) {
  const { data, error } = await admin.from('tawazon_states').select('revision,state,updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return statePayload(data as StateRow | null)
}

async function issueSession(userId: string) {
  const token = randomValue(32)
  const tokenHash = await sha256(token)
  const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString()
  const { error } = await admin.from('tawazon_sessions').insert({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt })
  if (error) throw error
  return { token, expiresAt }
}

async function requireSession(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Sign in to continue.')
  const tokenHash = await sha256(token)
  const { data, error } = await admin.from('tawazon_sessions').select('user_id,expires_at').eq('token_hash', tokenHash).maybeSingle()
  if (error) throw error
  if (!data || Date.parse(data.expires_at) <= Date.now()) {
    if (data) await admin.from('tawazon_sessions').delete().eq('token_hash', tokenHash)
    throw new HttpError(401, 'Your session has expired. Sign in again.')
  }
  await admin.from('tawazon_sessions').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', tokenHash)
  return { userId: data.user_id as string, tokenHash }
}

async function accountResponse(userId: string, includeSession = true) {
  const [profile, state, session] = await Promise.all([
    profileById(userId),
    loadState(userId),
    includeSession ? issueSession(userId) : Promise.resolve(null),
  ])
  return { account: publicAccount(profile), state, ...(session ?? {}) }
}

function validateRegistration(body: Record<string, unknown>) {
  const displayName = String(body.displayName ?? '').trim().slice(0, 100)
  const username = normalize(body.username)
  const email = normalize(body.email)
  const password = String(body.password ?? '')
  const recoveryCode = String(body.recoveryCode ?? '').trim()
  if (displayName.length < 2) throw new HttpError(400, 'Enter your full name.')
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new HttpError(400, 'Username must be 3–24 characters using letters, numbers, dots, dashes, or underscores.')
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must contain at least 8 characters.')
  if (!/^[A-Z0-9-]{12,20}$/i.test(recoveryCode)) throw new HttpError(400, 'Invalid offline recovery code.')
  return { displayName, username, email, password, recoveryCode }
}

async function register(body: Record<string, unknown>) {
  const input = validateRegistration(body)
  const { data: existingUsername } = await admin.from('tawazon_profiles').select('id').eq('username', input.username).maybeSingle()
  const { data: existingEmail } = await admin.from('tawazon_profiles').select('id').eq('email', input.email).maybeSingle()
  if (existingUsername || existingEmail) throw new HttpError(409, 'That username or email is already connected to an account.')

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName, username: input.username },
  })
  if (authError || !authData.user) {
    const duplicate = authError?.message.toLowerCase().includes('already')
    throw new HttpError(duplicate ? 409 : 400, duplicate ? 'That username or email is already connected to an account.' : authError?.message ?? 'Could not create this account.')
  }

  const userId = authData.user.id
  const recoverySalt = randomValue(18)
  const recoveryHash = await deriveRecoveryHash(normalizeRecovery(input.recoveryCode), recoverySalt)
  const createdAt = new Date().toISOString()
  try {
    const { error: profileError } = await admin.from('tawazon_profiles').insert({
      id: userId,
      username: input.username,
      email: input.email,
      display_name: input.displayName,
      created_at: createdAt,
      updated_at: createdAt,
    })
    if (profileError) throw profileError
    const { error: recoveryError } = await admin.from('tawazon_recovery_secrets').insert({
      user_id: userId,
      recovery_hash: recoveryHash,
      recovery_salt: recoverySalt,
      iterations: recoveryIterations,
    })
    if (recoveryError) throw recoveryError
    const { error: stateError } = await admin.from('tawazon_states').insert({ user_id: userId })
    if (stateError) throw stateError
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    throw error
  }
  return { ...await accountResponse(userId), welcomeEmailSent: false }
}

async function login(body: Record<string, unknown>) {
  const identifier = normalize(body.identifier)
  const password = String(body.password ?? '')
  if (!identifier || !password) throw new HttpError(400, 'Enter your username and password.')
  const profile = await profileByIdentifier(identifier)
  if (!profile) throw new HttpError(401, 'Username or password is incorrect.')
  const authClient = createAuthClient()
  const { error } = await authClient.auth.signInWithPassword({ email: profile.email, password })
  await authClient.auth.signOut().catch(() => undefined)
  if (error) throw new HttpError(401, 'Username or password is incorrect.')
  return accountResponse(profile.id)
}

async function requestEmailRecovery(body: Record<string, unknown>) {
  const profile = await profileByIdentifier(body.identifier)
  if (!profile) return { accepted: true }
  const authClient = createAuthClient()
  const { error } = await authClient.auth.resetPasswordForEmail(profile.email)
  if (error) throw new HttpError(error.status || 502, error.message)
  const [local, domain] = profile.email.split('@')
  const shown = local.slice(0, Math.min(2, local.length))
  return { accepted: true, maskedEmail: `${shown}${'*'.repeat(Math.max(2, local.length - shown.length))}@${domain}` }
}

async function resetWithEmail(body: Record<string, unknown>) {
  const profile = await profileByIdentifier(body.identifier)
  const code = String(body.code ?? '').trim()
  const password = String(body.password ?? '')
  if (!profile || !/^\d{6}$/.test(code)) throw new HttpError(400, 'The email code is invalid or expired.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'New password must contain at least 8 characters.')
  const authClient = createAuthClient()
  const { data, error } = await authClient.auth.verifyOtp({ email: profile.email, token: code, type: 'recovery' })
  await authClient.auth.signOut().catch(() => undefined)
  if (error || data.user?.id !== profile.id) throw new HttpError(400, 'The email code is invalid or expired.')
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (updateError) throw updateError
  await admin.from('tawazon_sessions').delete().eq('user_id', profile.id)
  return accountResponse(profile.id)
}

async function resetWithOfflineCode(body: Record<string, unknown>) {
  const profile = await profileByIdentifier(body.identifier)
  const password = String(body.password ?? '')
  if (!profile) throw new HttpError(400, 'The username or recovery code is incorrect.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'New password must contain at least 8 characters.')
  const { data: secret, error } = await admin.from('tawazon_recovery_secrets').select('*').eq('user_id', profile.id).maybeSingle()
  if (error) throw error
  if (!secret) throw new HttpError(400, 'The username or recovery code is incorrect.')
  const candidate = await deriveRecoveryHash(normalizeRecovery(body.recoveryCode), secret.recovery_salt, secret.iterations)
  if (!constantTimeEqual(candidate, secret.recovery_hash)) throw new HttpError(400, 'The username or recovery code is incorrect.')
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (updateError) throw updateError
  await admin.from('tawazon_sessions').delete().eq('user_id', profile.id)
  return accountResponse(profile.id)
}

async function mergeState(userId: string, body: Record<string, unknown>) {
  const patch = body.state
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new HttpError(400, 'State must be an object.')
  const { data, error } = await admin.rpc('merge_tawazon_state', { p_user_id: userId, p_patch: patch })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as StateRow | null
  return statePayload(row)
}

async function updateProfile(userId: string, tokenHash: string, body: Record<string, unknown>) {
  const current = await profileById(userId)
  const displayName = String(body.displayName ?? current.display_name).trim().slice(0, 100)
  const username = body.username === undefined ? current.username : normalize(body.username)
  const email = body.email === undefined ? current.email : normalize(body.email)
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (displayName.length < 2) throw new HttpError(400, 'Display name must contain at least two characters.')
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new HttpError(400, 'Username must be 3–24 characters using letters, numbers, dots, dashes, or underscores.')
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.')
  if (newPassword && (newPassword.length < 8 || newPassword.length > 200)) throw new HttpError(400, 'New password must contain at least 8 characters.')

  const usernameChanged = username !== current.username
  const emailChanged = email !== current.email
  const passwordChanged = Boolean(newPassword)
  const sensitiveChange = usernameChanged || emailChanged || passwordChanged
  if (sensitiveChange) {
    if (!currentPassword) throw new HttpError(400, 'Enter your current password to save account changes.')
    const authClient = createAuthClient()
    const { data, error } = await authClient.auth.signInWithPassword({ email: current.email, password: currentPassword })
    await authClient.auth.signOut().catch(() => undefined)
    if (error || data.user?.id !== userId) throw new HttpError(401, 'Current password is incorrect.')
  }

  if (usernameChanged) {
    const { data } = await admin.from('tawazon_profiles').select('id').eq('username', username).neq('id', userId).maybeSingle()
    if (data) throw new HttpError(409, 'That username is already in use.')
  }
  if (emailChanged) {
    const { data } = await admin.from('tawazon_profiles').select('id').eq('email', email).neq('id', userId).maybeSingle()
    if (data) throw new HttpError(409, 'That email is already connected to an account.')
  }

  if (emailChanged || passwordChanged || usernameChanged || displayName !== current.display_name) {
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ...(emailChanged ? { email, email_confirm: true } : {}),
      ...(passwordChanged ? { password: newPassword } : {}),
      user_metadata: { display_name: displayName, username },
    })
    if (authError) {
      const duplicate = authError.message.toLowerCase().includes('already')
      throw new HttpError(duplicate ? 409 : 400, duplicate ? 'That email is already connected to an account.' : authError.message)
    }
  }

  const { data, error } = await admin.from('tawazon_profiles').update({
    display_name: displayName,
    username,
    email,
    updated_at: new Date().toISOString(),
  }).eq('id', userId).select('*').single()
  if (error) {
    await admin.auth.admin.updateUserById(userId, {
      ...(emailChanged ? { email: current.email, email_confirm: true } : {}),
      ...(passwordChanged ? { password: currentPassword } : {}),
      user_metadata: { display_name: current.display_name, username: current.username },
    }).catch(() => undefined)
    if (error.code === '23505') throw new HttpError(409, 'That username or email is already connected to an account.')
    throw error
  }
  if (passwordChanged) await admin.from('tawazon_sessions').delete().eq('user_id', userId).neq('token_hash', tokenHash)
  return { account: publicAccount(data as ProfileRow), usernameChanged, emailChanged, passwordChanged }
}

async function listVideos(userId: string) {
  const { data, error } = await admin.from('tawazon_training_videos').select('*').eq('user_id', userId).eq('status', 'ready').order('created_at', { ascending: true })
  if (error) throw error
  return { videos: (data as VideoRow[]).map(videoPayload) }
}

async function prepareVideoUpload(userId: string, body: Record<string, unknown>) {
  const sessionId = String(body.sessionId ?? '')
  const title = String(body.title ?? '').trim().slice(0, 120)
  const originalName = String(body.originalName ?? 'training-video').trim().slice(0, 180)
  const mimeType = String(body.mimeType ?? '').toLowerCase()
  const sizeBytes = Number(body.sizeBytes ?? 0)
  const extension = videoExtensions.get(mimeType)
  if (!trainingSessions.has(sessionId)) throw new HttpError(400, 'Choose a valid training day.')
  if (title.length < 2) throw new HttpError(400, 'Enter a video title.')
  if (!extension) throw new HttpError(415, 'Upload an MP4, MOV, or WebM video.')
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxVideoBytes) throw new HttpError(413, 'Training videos must be 100 MB or smaller.')

  const { data: current, error: listError } = await admin.from('tawazon_training_videos').select('session_id,size_bytes').eq('user_id', userId)
  if (listError) throw listError
  if (current.filter((video) => video.session_id === sessionId).length >= maxVideosPerDay) throw new HttpError(409, 'This training day already has the maximum of 50 videos.')
  const total = current.reduce((sum, video) => sum + Number(video.size_bytes), 0)
  if (total + sizeBytes > maxLibraryBytes) throw new HttpError(413, 'This account has reached its 2 GB training-library limit.')

  const id = crypto.randomUUID()
  const objectPath = `${userId}/${id}.${extension}`
  const { data: inserted, error: insertError } = await admin.from('tawazon_training_videos').insert({
    id,
    user_id: userId,
    session_id: sessionId,
    title,
    original_name: originalName,
    object_path: objectPath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    status: 'pending',
  }).select('*').single()
  if (insertError) throw insertError

  const { data: upload, error: uploadError } = await admin.storage.from(bucket).createSignedUploadUrl(objectPath)
  if (uploadError || !upload) {
    await admin.from('tawazon_training_videos').delete().eq('id', id).eq('user_id', userId)
    throw uploadError ?? new Error('Could not prepare the upload.')
  }
  return { video: videoPayload(inserted as VideoRow), upload: { path: upload.path, token: upload.token, signedUrl: upload.signedUrl } }
}

async function completeVideoUpload(userId: string, videoId: string) {
  const { data: video, error } = await admin.from('tawazon_training_videos').select('*').eq('id', videoId).eq('user_id', userId).eq('status', 'pending').maybeSingle()
  if (error) throw error
  if (!video) throw new HttpError(404, 'Training video upload not found.')
  const row = video as VideoRow
  const [folder, fileName] = row.object_path.split('/')
  const { data: objects, error: listError } = await admin.storage.from(bucket).list(folder, { search: fileName, limit: 10 })
  if (listError) throw listError
  const stored = objects.find((item) => item.name === fileName)
  if (!stored) throw new HttpError(409, 'Finish uploading the file before saving this video.')
  const actualSize = Number(stored.metadata?.size ?? row.size_bytes)
  if (!Number.isSafeInteger(actualSize) || actualSize < 1 || actualSize > maxVideoBytes) {
    await admin.storage.from(bucket).remove([row.object_path])
    await admin.from('tawazon_training_videos').delete().eq('id', videoId).eq('user_id', userId)
    throw new HttpError(413, 'Training videos must be 100 MB or smaller.')
  }
  const { data: ready, error: updateError } = await admin.from('tawazon_training_videos').update({ status: 'ready', size_bytes: actualSize, ready_at: new Date().toISOString() }).eq('id', videoId).eq('user_id', userId).select('*').single()
  if (updateError) throw updateError
  return { video: videoPayload(ready as VideoRow) }
}

async function deleteVideo(userId: string, videoId: string) {
  const { data: video, error } = await admin.from('tawazon_training_videos').select('*').eq('id', videoId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!video) throw new HttpError(404, 'Training video not found.')
  const { error: storageError } = await admin.storage.from(bucket).remove([(video as VideoRow).object_path])
  if (storageError) throw storageError
  const { error: deleteError } = await admin.from('tawazon_training_videos').delete().eq('id', videoId).eq('user_id', userId)
  if (deleteError) throw deleteError
  return { deleted: true }
}

async function moveVideo(userId: string, videoId: string, body: Record<string, unknown>) {
  const sessionId = String(body.sessionId ?? '')
  if (!trainingSessions.has(sessionId)) throw new HttpError(400, 'Choose a valid destination training day.')
  const { data: video, error } = await admin.from('tawazon_training_videos').select('*').eq('id', videoId).eq('user_id', userId).eq('status', 'ready').maybeSingle()
  if (error) throw error
  if (!video) throw new HttpError(404, 'Training video not found.')
  const current = video as VideoRow
  if (current.session_id === sessionId) return { video: videoPayload(current) }

  const { count, error: countError } = await admin.from('tawazon_training_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('session_id', sessionId).eq('status', 'ready')
  if (countError) throw countError
  if ((count ?? 0) >= maxVideosPerDay) throw new HttpError(409, 'The destination training day already has the maximum of 50 videos.')

  const { data: moved, error: updateError } = await admin.from('tawazon_training_videos').update({ session_id: sessionId }).eq('id', videoId).eq('user_id', userId).eq('status', 'ready').select('*').single()
  if (updateError) throw updateError
  return { video: videoPayload(moved as VideoRow) }
}

async function videoPlayback(userId: string, videoId: string) {
  const { data: video, error } = await admin.from('tawazon_training_videos').select('*').eq('id', videoId).eq('user_id', userId).eq('status', 'ready').maybeSingle()
  if (error) throw error
  if (!video) throw new HttpError(404, 'Training video not found.')
  const expiresIn = 60 * 60
  const { data, error: signError } = await admin.storage.from(bucket).createSignedUrl((video as VideoRow).object_path, expiresIn)
  if (signError || !data) throw signError ?? new Error('Could not create the playback URL.')
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
}

function apiPath(url: URL) {
  return url.pathname.replace(/^\/(?:functions\/v1\/)?tawazon-api/, '') || '/'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  try {
    if (!supabaseUrl || !serviceRoleKey || !publishableKey) throw new Error('Supabase function environment is incomplete.')
    const url = new URL(request.url)
    const path = apiPath(url)
    if (request.method === 'GET' && path === '/health') return json(200, { ok: true, database: 'supabase-postgres', emailConfigured: true, privateMedia: true })

    if (request.method === 'POST' && path === '/v1/auth/register') return json(201, await register(await readJson(request)))
    if (request.method === 'POST' && path === '/v1/auth/login') return json(200, await login(await readJson(request)))
    if (request.method === 'POST' && path === '/v1/recovery/request') return json(202, await requestEmailRecovery(await readJson(request)))
    if (request.method === 'POST' && path === '/v1/recovery/reset') return json(200, await resetWithEmail(await readJson(request)))
    if (request.method === 'POST' && path === '/v1/recovery/offline') return json(200, await resetWithOfflineCode(await readJson(request)))

    const session = await requireSession(request)
    if (request.method === 'POST' && path === '/v1/auth/logout') {
      await admin.from('tawazon_sessions').delete().eq('token_hash', session.tokenHash)
      return json(200, { signedOut: true })
    }
    if (request.method === 'GET' && path === '/v1/me') return json(200, await accountResponse(session.userId, false))
    if (request.method === 'GET' && path === '/v1/state') return json(200, await loadState(session.userId))
    if (request.method === 'PATCH' && path === '/v1/state') return json(200, await mergeState(session.userId, await readJson(request)))
    if (request.method === 'PATCH' && path === '/v1/account') return json(200, await updateProfile(session.userId, session.tokenHash, await readJson(request)))
    if (request.method === 'GET' && path === '/v1/training/videos') return json(200, await listVideos(session.userId))
    if (request.method === 'POST' && path === '/v1/training/videos') return json(201, await prepareVideoUpload(session.userId, await readJson(request)))

    const completeMatch = /^\/v1\/training\/videos\/([a-f0-9-]+)\/complete$/.exec(path)
    if (request.method === 'POST' && completeMatch) return json(200, await completeVideoUpload(session.userId, completeMatch[1]))
    const playbackMatch = /^\/v1\/training\/videos\/([a-f0-9-]+)\/playback$/.exec(path)
    if (request.method === 'GET' && playbackMatch) return json(200, await videoPlayback(session.userId, playbackMatch[1]))
    const videoMatch = /^\/v1\/training\/videos\/([a-f0-9-]+)$/.exec(path)
    if (request.method === 'PATCH' && videoMatch) return json(200, await moveVideo(session.userId, videoMatch[1], await readJson(request)))
    if (request.method === 'DELETE' && videoMatch) return json(200, await deleteVideo(session.userId, videoMatch[1]))
    throw new HttpError(404, 'Not found.')
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) console.error(error)
    return json(status, { error: status >= 500 ? 'Account service error.' : error instanceof Error ? error.message : 'Request failed.' })
  }
})
