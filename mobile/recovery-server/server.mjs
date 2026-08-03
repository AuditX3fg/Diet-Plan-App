import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 8787)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
const resendApiKey = process.env.RESEND_API_KEY || ''
const fromEmail = process.env.RECOVERY_FROM_EMAIL || ''
const dataFile = resolve(process.env.RECOVERY_DATA_FILE || './data/recovery-store.json')
const challengeLifetimeMs = 15 * 60 * 1000
const resendDelayMs = 60 * 1000
const maxEmailsPerHour = 5
const maxVerificationAttempts = 5

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function emptyStore() {
  return { accounts: [], challenges: {} }
}

async function loadStore() {
  try {
    const parsed = JSON.parse(await readFile(dataFile, 'utf8'))
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      challenges: parsed.challenges && typeof parsed.challenges === 'object' ? parsed.challenges : {},
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyStore()
    throw error
  }
}

async function saveStore(store) {
  await mkdir(dirname(dataFile), { recursive: true })
  const temporary = `${dataFile}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 })
  await rename(temporary, dataFile)
}

let mutationQueue = Promise.resolve()

function mutateStore(operation) {
  const pending = mutationQueue.then(async () => {
    const store = await loadStore()
    const result = await operation(store)
    await saveStore(store)
    return result
  })
  mutationQueue = pending.catch(() => undefined)
  return pending
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function codeDigest(code, salt) {
  return scryptSync(String(code), salt, 32).toString('hex')
}

function safeEqual(leftHex, rightHex) {
  const left = Buffer.from(leftHex, 'hex')
  const right = Buffer.from(rightHex, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
}

async function sendEmail({ to, displayName, code, kind, idempotencyKey }) {
  if (!resendApiKey || !fromEmail) throw new HttpError(503, 'Email delivery is not configured on the recovery server.')
  const firstName = escapeHtml(displayName || 'there')
  const safeCode = escapeHtml(code)
  const isInitial = kind === 'initial'
  const subject = isInitial ? 'Your Tawazon recovery code' : 'Your Tawazon password reset code'
  const explanation = isInitial
    ? 'Keep this offline recovery code somewhere private. You can use it if you ever lose access to your password.'
    : 'Enter this six-digit code in Tawazon to choose a new password. It expires in 15 minutes and can only be tried five times.'
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
      text: `Hello ${displayName || 'there'},\n\n${explanation}\n\nCode: ${code}\n\nIf you did not request this, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17352d"><h1 style="font-size:24px">Tawazon</h1><p>Hello ${firstName},</p><p>${explanation}</p><div style="font-size:30px;font-weight:800;letter-spacing:5px;background:#eef6f2;padding:18px;border-radius:12px;text-align:center">${safeCode}</div><p style="color:#64756f;font-size:13px">If you did not request this, you can ignore this email.</p></div>`,
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
    if (total > 20_000) throw new HttpError(413, 'Request is too large.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'Invalid JSON request.')
  }
}

function findAccount(store, identifier) {
  const value = normalize(identifier)
  return store.accounts.find((account) => account.username === value || account.email === value)
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
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
}

function json(response, status, body) {
  response.writeHead(status, responseHeaders())
  response.end(JSON.stringify(body))
}

async function registerAccount(body) {
  const accountId = String(body.accountId || '').trim()
  const username = normalize(body.username)
  const email = normalize(body.email)
  const displayName = String(body.displayName || '').trim().slice(0, 100)
  const initialRecoveryCode = body.initialRecoveryCode ? String(body.initialRecoveryCode).trim() : ''
  if (!/^[0-9a-f-]{16,64}$/i.test(accountId) || !/^[a-z0-9._-]{3,24}$/.test(username) || !isEmail(email)) throw new HttpError(400, 'Invalid account recovery details.')
  if (initialRecoveryCode && !/^[A-Z0-9-]{12,20}$/i.test(initialRecoveryCode)) throw new HttpError(400, 'Invalid initial recovery code.')

  const prepared = await mutateStore((store) => {
    const collision = store.accounts.find((item) => item.id !== accountId && (item.username === username || item.email === email))
    if (collision) throw new HttpError(409, 'That username or email is already registered for recovery.')
    const existing = store.accounts.find((item) => item.id === accountId)
    if (existing && (existing.username !== username || existing.email !== email)) throw new HttpError(409, 'Recovery identity cannot be changed through this endpoint.')
    if (existing) Object.assign(existing, { displayName, updatedAt: new Date().toISOString() })
    else store.accounts.push({ id: accountId, username, email, displayName, createdAt: new Date().toISOString(), sentAt: [] })
    const account = existing || store.accounts.at(-1)
    const shouldDeliver = Boolean(initialRecoveryCode && !account.initialRecoverySentAt)
    if (shouldDeliver) account.initialRecoverySentAt = Date.now()
    return { account, shouldDeliver }
  })

  if (prepared.shouldDeliver) {
    try {
      await sendEmail({
        to: prepared.account.email,
        displayName: prepared.account.displayName,
        code: initialRecoveryCode,
        kind: 'initial',
        idempotencyKey: `initial-${prepared.account.id}-${prepared.account.initialRecoverySentAt}`,
      })
    } catch (error) {
      await mutateStore((store) => {
        const account = store.accounts.find((item) => item.id === accountId)
        if (account?.initialRecoverySentAt === prepared.account.initialRecoverySentAt) delete account.initialRecoverySentAt
      })
      throw error
    }
  }
  return { registered: true, delivered: prepared.shouldDeliver }
}

async function requestRecovery(body) {
  const identifier = normalize(body.identifier)
  if (!identifier) throw new HttpError(400, 'Enter your username or email.')
  const generatedCode = String(randomInt(100000, 1000000))
  const now = Date.now()
  const prepared = await mutateStore((store) => {
    const account = findAccount(store, identifier)
    if (!account) return null
    const recent = (account.sentAt || []).filter((timestamp) => timestamp > now - 60 * 60 * 1000)
    const latest = recent.at(-1) || 0
    if (now - latest < resendDelayMs) throw new HttpError(429, 'Please wait one minute before requesting another code.')
    if (recent.length >= maxEmailsPerHour) throw new HttpError(429, 'Too many recovery emails. Please try again in one hour.')
    const salt = randomBytes(16).toString('hex')
    store.challenges[account.id] = {
      salt,
      digest: codeDigest(generatedCode, salt),
      expiresAt: now + challengeLifetimeMs,
      attempts: 0,
    }
    account.sentAt = [...recent, now]
    return { accountId: account.id, email: account.email, displayName: account.displayName }
  })
  if (!prepared) return { accepted: true }
  try {
    await sendEmail({
      to: prepared.email,
      displayName: prepared.displayName,
      code: generatedCode,
      kind: 'reset',
      idempotencyKey: `reset-${prepared.accountId}-${now}`,
    })
  } catch (error) {
    await mutateStore((store) => {
      delete store.challenges[prepared.accountId]
      const account = store.accounts.find((item) => item.id === prepared.accountId)
      if (account) account.sentAt = (account.sentAt || []).filter((timestamp) => timestamp !== now)
    })
    throw error
  }
  return { accepted: true }
}

async function verifyRecovery(body) {
  const identifier = normalize(body.identifier)
  const code = String(body.code || '').trim()
  if (!identifier || !/^\d{6}$/.test(code)) throw new HttpError(400, 'The email code is invalid or expired.')
  return mutateStore((store) => {
    const account = findAccount(store, identifier)
    const challenge = account ? store.challenges[account.id] : undefined
    if (!account || !challenge || challenge.expiresAt < Date.now() || challenge.attempts >= maxVerificationAttempts) {
      if (account) delete store.challenges[account.id]
      throw new HttpError(400, 'The email code is invalid or expired.')
    }
    challenge.attempts += 1
    if (!safeEqual(codeDigest(code, challenge.salt), challenge.digest)) throw new HttpError(400, 'The email code is invalid or expired.')
    delete store.challenges[account.id]
    return { accountId: account.id }
  })
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return json(response, 204, {})
    if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ok: true, emailConfigured: Boolean(resendApiKey && fromEmail) })
    if (request.method !== 'POST') throw new HttpError(404, 'Not found.')
    enforceIpLimit(request)
    const body = await readJson(request)
    if (request.url === '/v1/accounts/register') return json(response, 200, await registerAccount(body))
    if (request.url === '/v1/recovery/request') return json(response, 202, await requestRecovery(body))
    if (request.url === '/v1/recovery/verify') return json(response, 200, await verifyRecovery(body))
    throw new HttpError(404, 'Not found.')
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) console.error(error instanceof HttpError ? error.message : error)
    json(response, status, { error: status === 500 ? 'Recovery service error.' : error.message })
  }
})

server.listen(port, host, () => {
  console.log(`Tawazon recovery service listening on http://${host}:${port}`)
  if (!resendApiKey || !fromEmail) console.warn('Email delivery is disabled until RESEND_API_KEY and RECOVERY_FROM_EMAIL are configured.')
})
