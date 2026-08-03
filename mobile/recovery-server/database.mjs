import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const databaseFile = resolve(process.env.TAWAZON_DB_FILE || './data/tawazon.sqlite')
mkdirSync(dirname(databaseFile), { recursive: true })

export const db = new DatabaseSync(databaseFile)
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000

function nowIso() { return new Date().toISOString() }
function normalize(value) { return String(value || '').trim().toLowerCase() }
function secretHash(value, salt) { return scryptSync(String(value), salt, 64).toString('hex') }
function tokenHash(token) { return createHash('sha256').update(token).digest('hex') }
function safeHexEqual(left, right) {
  const a = Buffer.from(left || '', 'hex')
  const b = Buffer.from(right || '', 'hex')
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
}

function accountFromRow(row) {
  return row ? { id: row.id, username: row.username, email: row.email, displayName: row.display_name, createdAt: row.created_at } : null
}

export function publicAccount(userId) {
  return accountFromRow(db.prepare('SELECT * FROM users WHERE id = ?').get(userId))
}

export function findUser(identifier) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE').get(normalize(identifier), normalize(identifier))
}

export function createUser({ id, username, email, displayName, password, recoveryCode }) {
  const createdAt = nowIso()
  const passwordSalt = randomBytes(16).toString('hex')
  const recoverySalt = randomBytes(16).toString('hex')
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT INTO users (id, username, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, normalize(username), normalize(email), displayName.trim(), createdAt, createdAt)
    db.prepare('INSERT INTO credentials (user_id, password_salt, password_hash, recovery_salt, recovery_hash, password_updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, passwordSalt, secretHash(password, passwordSalt), recoverySalt, secretHash(normalizeRecovery(recoveryCode), recoverySalt), createdAt)
    db.prepare("INSERT INTO user_state (user_id, revision, state_json, updated_at) VALUES (?, 0, '{}', ?)").run(id, createdAt)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return publicAccount(id)
}

export function verifyPassword(identifier, password) {
  const row = db.prepare('SELECT u.*, c.password_salt, c.password_hash FROM users u JOIN credentials c ON c.user_id = u.id WHERE u.username = ? COLLATE NOCASE OR u.email = ? COLLATE NOCASE').get(normalize(identifier), normalize(identifier))
  if (!row) return null
  return safeHexEqual(secretHash(password, row.password_salt), row.password_hash) ? accountFromRow(row) : null
}

export function verifyOfflineRecovery(identifier, recoveryCode) {
  const row = db.prepare('SELECT u.*, c.recovery_salt, c.recovery_hash FROM users u JOIN credentials c ON c.user_id = u.id WHERE u.username = ? COLLATE NOCASE OR u.email = ? COLLATE NOCASE').get(normalize(identifier), normalize(identifier))
  if (!row) return null
  return safeHexEqual(secretHash(normalizeRecovery(recoveryCode), row.recovery_salt), row.recovery_hash) ? accountFromRow(row) : null
}

export function replacePassword(userId, password) {
  const salt = randomBytes(16).toString('hex')
  const updatedAt = nowIso()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('UPDATE credentials SET password_salt = ?, password_hash = ?, password_updated_at = ? WHERE user_id = ?').run(salt, secretHash(password, salt), updatedAt, userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM recovery_challenges WHERE user_id = ?').run(userId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString()
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)').run(tokenHash(token), userId, createdAt, expiresAt, createdAt)
  return { token, expiresAt }
}

export function authenticate(token) {
  if (!token) return null
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso())
  const row = db.prepare('SELECT s.user_id, s.expires_at FROM sessions s WHERE s.token_hash = ?').get(tokenHash(token))
  if (!row) return null
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash(token))
  return { userId: row.user_id, expiresAt: row.expires_at }
}

export function revokeSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
}

export function getState(userId) {
  const row = db.prepare('SELECT revision, state_json, updated_at FROM user_state WHERE user_id = ?').get(userId)
  return { revision: row?.revision ?? 0, state: JSON.parse(row?.state_json || '{}'), updatedAt: row?.updated_at ?? nowIso() }
}

export function mergeState(userId, patch) {
  const current = getState(userId)
  const state = { ...current.state }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete state[key]
    else state[key] = value
  }
  const revision = current.revision + 1
  const updatedAt = nowIso()
  db.prepare('INSERT INTO user_state (user_id, revision, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, state_json = excluded.state_json, updated_at = excluded.updated_at').run(userId, revision, JSON.stringify(state), updatedAt)
  return { revision, state, updatedAt }
}

export function updateUser(userId, patch) {
  const current = publicAccount(userId)
  if (!current) return null
  const displayName = String(patch.displayName || current.displayName).trim().slice(0, 100)
  db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(displayName, nowIso(), userId)
  return publicAccount(userId)
}

export function storeChallenge(userId, code, expiresAt) {
  const salt = randomBytes(16).toString('hex')
  const createdAt = nowIso()
  db.prepare('INSERT INTO recovery_challenges (user_id, code_salt, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(user_id) DO UPDATE SET code_salt = excluded.code_salt, code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at').run(userId, salt, secretHash(code, salt), new Date(expiresAt).toISOString(), createdAt)
}

export function verifyChallenge(userId, code, maxAttempts = 5) {
  const row = db.prepare('SELECT * FROM recovery_challenges WHERE user_id = ?').get(userId)
  if (!row || row.expires_at <= nowIso() || row.attempts >= maxAttempts) { db.prepare('DELETE FROM recovery_challenges WHERE user_id = ?').run(userId); return false }
  db.prepare('UPDATE recovery_challenges SET attempts = attempts + 1 WHERE user_id = ?').run(userId)
  if (!safeHexEqual(secretHash(code, row.code_salt), row.code_hash)) return false
  db.prepare('DELETE FROM recovery_challenges WHERE user_id = ?').run(userId)
  return true
}

export function emailEvents(userId, kind, sinceIso) {
  return db.prepare('SELECT created_at FROM email_events WHERE user_id = ? AND kind = ? AND created_at >= ? ORDER BY created_at').all(userId, kind, sinceIso)
}

export function recordEmailEvent(userId, kind) {
  db.prepare('INSERT INTO email_events (user_id, kind, created_at) VALUES (?, ?, ?)').run(userId, kind, nowIso())
}

function trainingVideoFromRow(row) {
  return row ? {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  } : null
}

export function listTrainingVideos(userId) {
  return db.prepare('SELECT * FROM training_videos WHERE user_id = ? ORDER BY created_at, id').all(userId).map(trainingVideoFromRow)
}

export function trainingVideoFile(userId, videoId) {
  const row = db.prepare('SELECT * FROM training_videos WHERE id = ? AND user_id = ?').get(videoId, userId)
  return row ? { ...trainingVideoFromRow(row), storedName: row.stored_name } : null
}

export function createTrainingVideo({ id, userId, sessionId, title, originalName, storedName, mimeType, sizeBytes }) {
  const createdAt = nowIso()
  db.prepare('INSERT INTO training_videos (id, user_id, session_id, title, original_name, stored_name, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, userId, sessionId, title, originalName, storedName, mimeType, sizeBytes, createdAt)
  return trainingVideoFile(userId, id)
}

export function deleteTrainingVideo(userId, videoId) {
  const video = trainingVideoFile(userId, videoId)
  if (!video) return null
  db.prepare('DELETE FROM training_videos WHERE id = ? AND user_id = ?').run(videoId, userId)
  return video
}

export function normalizeRecovery(value) { return String(value || '').trim().replace(/[\s-]/g, '').toUpperCase() }
