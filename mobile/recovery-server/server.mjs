import { createServer } from 'node:http'
import { randomInt, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { authenticate, createSession, createTrainingVideo, createUser, deleteTrainingVideo, emailEvents, findUser, getState, listTrainingVideos, mergeState, publicAccount, recordEmailEvent, replacePassword, revokeSession, storeChallenge, trainingVideoFile, updateUser, verifyChallenge, verifyOfflineRecovery, verifyPassword } from './database.mjs'

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 8787)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
const resendApiKey = process.env.RESEND_API_KEY || ''
const fromEmail = process.env.RECOVERY_FROM_EMAIL || ''
const mediaRoot = resolve(process.env.TAWAZON_MEDIA_DIR || './data/training-videos')
const challengeLifetimeMs = 15 * 60 * 1000
const resendDelayMs = 60 * 1000
const maxEmailsPerHour = 5
const maxVerificationAttempts = 5
const maxTrainingVideoBytes = 100 * 1024 * 1024
const maxTrainingLibraryBytes = 2 * 1024 * 1024 * 1024
const maxTrainingVideosPerDay = 50
const trainingSessions = new Set(['day-1', 'day-2', 'day-3', 'day-4', 'abs'])
const videoMimeExtensions = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
])

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
}

async function sendEmail({ to, displayName, username, code, kind, idempotencyKey }) {
  if (!resendApiKey || !fromEmail) throw new HttpError(503, 'Email delivery is not configured on the recovery server.')
  const firstName = escapeHtml(displayName || 'there')
  const safeUsername = escapeHtml(username || '')
  const safeCode = escapeHtml(code)
  const isInitial = kind === 'initial'
  const subject = isInitial ? 'Welcome to Tawazon — your account is ready' : 'Your Tawazon password reset code'
  const explanation = isInitial
    ? 'Your private nutrition workspace is ready. Keep the offline recovery code below somewhere secure; it can restore access if you forget your password.'
    : 'Enter this six-digit code in Tawazon to choose a new password. It expires in 15 minutes and can only be tried five times.'
  const text = isInitial
    ? `Hello ${displayName || 'there'},\n\nWelcome to Tawazon. Your private nutrition workspace is ready.\n\nUSERNAME\n@${username}\n\nPASSWORD\nThe password you created (Tawazon never emails or stores it in readable form)\n\nOFFLINE RECOVERY CODE\n${code}\n\nStore this code somewhere private. Anyone with this code may be able to reset your password.\n\nYour plan, your way.\nTawazon`
    : `Hello ${displayName || 'there'},\n\n${explanation}\n\nCode: ${code}\n\nIf you did not request this, you can ignore this email.`
  const html = isInitial
    ? `<div style="margin:0;padding:34px 16px;background:#f4f2eb;font-family:Arial,sans-serif;color:#15362e"><div style="max-width:560px;margin:auto;overflow:hidden;border:1px solid #dfe8e3;border-radius:24px;background:#ffffff;box-shadow:0 18px 50px rgba(23,60,50,.10)"><div style="padding:30px 34px;background:linear-gradient(135deg,#173c32,#2f8069);color:#ffffff"><div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;opacity:.78">Tawazon</div><h1 style="margin:10px 0 5px;font-size:30px;line-height:1.15">Welcome, ${firstName}.</h1><p style="margin:0;font-size:14px;line-height:1.6;opacity:.88">Your private nutrition workspace is ready.</p></div><div style="padding:30px 34px"><p style="margin:0 0 22px;color:#5f716b;font-size:14px;line-height:1.7">Use these details to access your account. Your password is deliberately not included because Tawazon never stores it in readable form.</p><div style="margin-bottom:12px;padding:16px 18px;border:1px solid #e0e8e4;border-radius:14px;background:#f8faf9"><div style="color:#7b8a85;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">Username</div><div style="margin-top:6px;font-size:18px;font-weight:800">@${safeUsername}</div></div><div style="margin-bottom:22px;padding:16px 18px;border:1px solid #e0e8e4;border-radius:14px;background:#f8faf9"><div style="color:#7b8a85;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">Password</div><div style="margin-top:6px;font-size:14px;font-weight:700">The password you created</div><div style="margin-top:4px;color:#7b8a85;font-size:11px">Not emailed or stored in readable form</div></div><div style="padding:22px;border-radius:16px;background:#eaf4ef;text-align:center"><div style="color:#36735f;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">Offline recovery code</div><div style="margin-top:10px;color:#173c32;font-family:monospace;font-size:27px;font-weight:900;letter-spacing:4px">${safeCode}</div></div><p style="margin:18px 0 0;color:#a05449;font-size:12px;line-height:1.6"><strong>Keep this code private.</strong> Anyone with it may be able to reset your password.</p></div><div style="padding:18px 34px;border-top:1px solid #edf1ef;color:#7b8a85;font-size:11px;text-align:center">Your plan, your way · Tawazon</div></div></div>`
    : `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17352d"><h1 style="font-size:24px">Tawazon</h1><p>Hello ${firstName},</p><p>${explanation}</p><div style="font-size:30px;font-weight:800;letter-spacing:5px;background:#eef6f2;padding:18px;border-radius:12px;text-align:center">${safeCode}</div><p style="color:#64756f;font-size:13px">If you did not request this, you can ignore this email.</p></div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text,
      html,
      tags: [{ name: 'category', value: isInitial ? 'recovery_backup' : 'password_reset' }],
    }),
  })
  if (!response.ok) {
    console.error(`Email provider returned HTTP ${response.status}.`)
    throw new HttpError(502, 'The recovery email could not be delivered. Please try again later.')
  }
}

async function readJson(request) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > 2_000_000) throw new HttpError(413, 'Request is too large.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'Invalid JSON request.')
  }
}

const ipWindows = new Map()

function enforceIpLimit(request) {
  const key = request.socket.remoteAddress || 'unknown'
  const cutoff = Date.now() - 60 * 60 * 1000
  const recent = (ipWindows.get(key) || []).filter((timestamp) => timestamp > cutoff)
  if (recent.length >= 40) throw new HttpError(429, 'Too many requests. Please try again later.')
  recent.push(Date.now())
  ipWindows.set(key, recent)
}

function responseHeaders() {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Range',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
}

function trainingVideoPayload(video) {
  if (!video) return null
  const { storedName: _storedName, ...payload } = video
  return payload
}

async function uploadTrainingVideo(request, session, url) {
  const sessionId = String(url.searchParams.get('sessionId') || '')
  const title = String(url.searchParams.get('title') || '').trim().slice(0, 120)
  const originalName = String(url.searchParams.get('originalName') || 'training-video').trim().slice(0, 180)
  const mimeType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  const extension = videoMimeExtensions.get(mimeType)
  const announcedSize = Number(request.headers['content-length'] || 0)
  if (!trainingSessions.has(sessionId)) throw new HttpError(400, 'Choose a valid training day.')
  if (title.length < 2) throw new HttpError(400, 'Enter a video title.')
  if (!extension) throw new HttpError(415, 'Upload an MP4, MOV, or WebM video.')
  if (announcedSize > maxTrainingVideoBytes) throw new HttpError(413, 'Training videos must be 100 MB or smaller.')
  const currentVideos = listTrainingVideos(session.userId)
  if (currentVideos.filter((video) => video.sessionId === sessionId).length >= maxTrainingVideosPerDay) throw new HttpError(409, 'This training day already has the maximum of 50 videos.')
  const currentLibraryBytes = currentVideos.reduce((total, video) => total + video.sizeBytes, 0)
  if (announcedSize && currentLibraryBytes + announcedSize > maxTrainingLibraryBytes) throw new HttpError(413, 'This account has reached its 2 GB training-library limit.')

  const id = randomUUID()
  const userDirectory = join(mediaRoot, session.userId)
  const storedName = `${id}${extension}`
  const finalPath = join(userDirectory, storedName)
  const temporaryPath = `${finalPath}.uploading`
  await mkdir(userDirectory, { recursive: true })
  const handle = await open(temporaryPath, 'wx')
  let sizeBytes = 0
  try {
    for await (const chunk of request) {
      sizeBytes += chunk.length
      if (sizeBytes > maxTrainingVideoBytes) throw new HttpError(413, 'Training videos must be 100 MB or smaller.')
      await handle.write(chunk)
    }
  } catch (error) {
    await handle.close().catch(() => undefined)
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
  await handle.close()
  if (!sizeBytes) {
    await rm(temporaryPath, { force: true })
    throw new HttpError(400, 'The selected video is empty.')
  }
  if (currentLibraryBytes + sizeBytes > maxTrainingLibraryBytes) {
    await rm(temporaryPath, { force: true })
    throw new HttpError(413, 'This account has reached its 2 GB training-library limit.')
  }
  await rename(temporaryPath, finalPath)
  try {
    return trainingVideoPayload(createTrainingVideo({ id, userId: session.userId, sessionId, title, originalName, storedName, mimeType, sizeBytes }))
  } catch (error) {
    await rm(finalPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function removeTrainingVideo(session, videoId) {
  const video = trainingVideoFile(session.userId, videoId)
  if (!video) throw new HttpError(404, 'Training video not found.')
  await rm(join(mediaRoot, session.userId, video.storedName), { force: true })
  deleteTrainingVideo(session.userId, videoId)
}

async function streamTrainingVideo(request, response, session, videoId) {
  const video = trainingVideoFile(session.userId, videoId)
  if (!video) throw new HttpError(404, 'Training video not found.')
  const filePath = join(mediaRoot, session.userId, video.storedName)
  let fileSize
  try { fileSize = (await stat(filePath)).size }
  catch { throw new HttpError(404, 'Training video file is unavailable.') }

  const rangeHeader = String(request.headers.range || '')
  let start = 0
  let end = fileSize - 1
  let status = 200
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
    if (!match) throw new HttpError(416, 'Invalid video range.')
    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2])
      start = Math.max(0, fileSize - suffixLength)
    } else {
      start = Number(match[1] || 0)
      end = match[2] ? Number(match[2]) : end
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= fileSize) throw new HttpError(416, 'Invalid video range.')
    end = Math.min(end, fileSize - 1)
    status = 206
  }

  response.writeHead(status, {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Range',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Type': video.mimeType,
    'Content-Length': String(end - start + 1),
    ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${fileSize}` } : {}),
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(filePath, { start, end }).on('error', () => response.destroy()).pipe(response)
}

function json(response, status, body) {
  response.writeHead(status, responseHeaders())
  response.end(JSON.stringify(body))
}

function validateAccountInput(body) {
  const displayName = String(body.displayName || '').trim().slice(0, 100)
  const username = normalize(body.username)
  const email = normalize(body.email)
  const password = String(body.password || '')
  const recoveryCode = String(body.recoveryCode || '').trim()
  if (displayName.length < 2) throw new HttpError(400, 'Enter your full name.')
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new HttpError(400, 'Username must be 3–24 characters using letters, numbers, dots, dashes, or underscores.')
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must contain at least 8 characters.')
  if (!/^[A-Z0-9-]{12,20}$/i.test(recoveryCode)) throw new HttpError(400, 'Invalid offline recovery code.')
  return { displayName, username, email, password, recoveryCode }
}

async function registerUser(body) {
  const input = validateAccountInput(body)
  let account
  try { account = createUser({ id: randomUUID(), ...input }) }
  catch (error) {
    if (String(error?.message).includes('UNIQUE')) throw new HttpError(409, 'That username or email is already connected to an account.')
    throw error
  }
  const session = createSession(account.id)
  let welcomeEmailSent = false
  if (resendApiKey && fromEmail) {
    try {
      await sendEmail({ to: account.email, displayName: account.displayName, username: account.username, code: input.recoveryCode, kind: 'initial', idempotencyKey: `welcome-${account.id}` })
      recordEmailEvent(account.id, 'welcome')
      welcomeEmailSent = true
    } catch (error) {
      console.error('Welcome email failed after account creation:', error instanceof Error ? error.message : error)
    }
  }
  return { account, state: getState(account.id), ...session, welcomeEmailSent }
}

function loginUser(body) {
  const identifier = normalize(body.identifier)
  const password = String(body.password || '')
  if (!identifier || !password) throw new HttpError(400, 'Enter your username and password.')
  const account = verifyPassword(identifier, password)
  if (!account) throw new HttpError(401, 'Username or password is incorrect.')
  return { account, state: getState(account.id), ...createSession(account.id) }
}

function bearerToken(request) {
  const header = request.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function requireSession(request) {
  const token = bearerToken(request)
  const session = authenticate(token)
  if (!session) throw new HttpError(401, 'Your session has expired. Sign in again.')
  return { ...session, token }
}

async function requestRecovery(body) {
  const identifier = normalize(body.identifier)
  if (!identifier) throw new HttpError(400, 'Enter your username or email.')
  const user = findUser(identifier)
  if (!user) return { accepted: true }
  const now = Date.now()
  const recent = emailEvents(user.id, 'reset', new Date(now - 60 * 60 * 1000).toISOString())
  const latest = recent.at(-1)?.created_at ? new Date(recent.at(-1).created_at).getTime() : 0
  if (now - latest < resendDelayMs) throw new HttpError(429, 'Please wait one minute before requesting another code.')
  if (recent.length >= maxEmailsPerHour) throw new HttpError(429, 'Too many recovery emails. Please try again in one hour.')
  const generatedCode = String(randomInt(100000, 1000000))
  storeChallenge(user.id, generatedCode, now + challengeLifetimeMs)
  await sendEmail({ to: user.email, displayName: user.display_name, username: user.username, code: generatedCode, kind: 'reset', idempotencyKey: `reset-${user.id}-${now}` })
  recordEmailEvent(user.id, 'reset')
  return { accepted: true, maskedEmail: maskEmail(user.email) }
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@')
  return `${local.slice(0, Math.min(2, local.length))}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`
}

function resetWithEmail(body) {
  const identifier = normalize(body.identifier)
  const code = String(body.code || '').trim()
  const password = String(body.password || '')
  const user = findUser(identifier)
  if (!user || !/^\d{6}$/.test(code) || !verifyChallenge(user.id, code, maxVerificationAttempts)) throw new HttpError(400, 'The email code is invalid or expired.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'New password must contain at least 8 characters.')
  replacePassword(user.id, password)
  return { account: publicAccount(user.id), state: getState(user.id), ...createSession(user.id) }
}

function resetWithOfflineCode(body) {
  const password = String(body.password || '')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'New password must contain at least 8 characters.')
  const account = verifyOfflineRecovery(body.identifier, body.recoveryCode)
  if (!account) throw new HttpError(400, 'The username or recovery code is incorrect.')
  replacePassword(account.id, password)
  return { account, state: getState(account.id), ...createSession(account.id) }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return json(response, 204, {})
    const url = new URL(request.url || '/', 'http://localhost')
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, database: 'sqlite', emailConfigured: Boolean(resendApiKey && fromEmail), privateMedia: true })
    const contentMatch = /^\/v1\/training\/videos\/([a-f0-9-]+)\/content$/.exec(url.pathname)
    if (request.method === 'GET' && contentMatch) return await streamTrainingVideo(request, response, requireSession(request), contentMatch[1])
    enforceIpLimit(request)
    if (request.method === 'GET' && url.pathname === '/v1/me') {
      const session = requireSession(request)
      return json(response, 200, { account: publicAccount(session.userId), state: getState(session.userId) })
    }
    if (request.method === 'GET' && url.pathname === '/v1/state') {
      const session = requireSession(request)
      return json(response, 200, getState(session.userId))
    }
    if (request.method === 'GET' && url.pathname === '/v1/training/videos') {
      const session = requireSession(request)
      return json(response, 200, { videos: listTrainingVideos(session.userId) })
    }
    if (request.method === 'POST' && url.pathname === '/v1/training/videos') {
      const session = requireSession(request)
      return json(response, 201, { video: await uploadTrainingVideo(request, session, url) })
    }
    const deleteMatch = /^\/v1\/training\/videos\/([a-f0-9-]+)$/.exec(url.pathname)
    if (request.method === 'DELETE' && deleteMatch) {
      const session = requireSession(request)
      await removeTrainingVideo(session, deleteMatch[1])
      return json(response, 200, { deleted: true })
    }
    const body = await readJson(request)
    if (request.method === 'POST' && url.pathname === '/v1/auth/register') return json(response, 201, await registerUser(body))
    if (request.method === 'POST' && url.pathname === '/v1/auth/login') return json(response, 200, loginUser(body))
    if (request.method === 'POST' && url.pathname === '/v1/auth/logout') { const session = requireSession(request); revokeSession(session.token); return json(response, 200, { signedOut: true }) }
    if (request.method === 'POST' && url.pathname === '/v1/recovery/request') return json(response, 202, await requestRecovery(body))
    if (request.method === 'POST' && url.pathname === '/v1/recovery/reset') return json(response, 200, resetWithEmail(body))
    if (request.method === 'POST' && url.pathname === '/v1/recovery/offline') return json(response, 200, resetWithOfflineCode(body))
    if (request.method === 'PATCH' && url.pathname === '/v1/state') {
      const session = requireSession(request)
      if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) throw new HttpError(400, 'State must be an object.')
      return json(response, 200, mergeState(session.userId, body.state))
    }
    if (request.method === 'PATCH' && url.pathname === '/v1/account') {
      const session = requireSession(request)
      return json(response, 200, { account: updateUser(session.userId, body) })
    }
    throw new HttpError(404, 'Not found.')
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) console.error(error instanceof HttpError ? error.message : error)
    json(response, status, { error: status === 500 ? 'Account service error.' : error.message })
  }
})

server.listen(port, host, () => {
  console.log(`Tawazon account service listening on http://${host}:${port}`)
  if (!resendApiKey || !fromEmail) console.warn('Email delivery is disabled until RESEND_API_KEY and RECOVERY_FROM_EMAIL are configured.')
})
