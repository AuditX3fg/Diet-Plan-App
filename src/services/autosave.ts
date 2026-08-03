import { saveCloudState } from './cloud'

interface AutosaveJob {
  accountId: string
  version: number
  state: Record<string, unknown>
}

const pendingPrefix = 'tawazon-pending-cloud-state-v1:'
const retryDelayMs = 5_000
let lastVersion = 0
let activeAccountId = ''
let queuedJob: AutosaveJob | null = null
let draining: Promise<void> | null = null
let retryTimer: number | undefined

function pendingKey(accountId: string) {
  return `${pendingPrefix}${accountId}`
}

function nextVersion() {
  lastVersion = Math.max(Date.now(), lastVersion + 1)
  return lastVersion
}

function readJob(accountId: string): AutosaveJob | null {
  try {
    const stored = window.localStorage.getItem(pendingKey(accountId))
    if (!stored) return null
    const parsed = JSON.parse(stored) as AutosaveJob
    return parsed.accountId === accountId && parsed.state && typeof parsed.state === 'object' ? parsed : null
  } catch {
    return null
  }
}

function storeJob(job: AutosaveJob) {
  try { window.localStorage.setItem(pendingKey(job.accountId), JSON.stringify(job)) } catch { /* Local state hooks still preserve each field when storage is available. */ }
}

function clearJob(job: AutosaveJob) {
  try {
    const stored = readJob(job.accountId)
    if (stored?.version === job.version) window.localStorage.removeItem(pendingKey(job.accountId))
  } catch { /* A future save or launch will retry the pending snapshot. */ }
}

function scheduleRetry() {
  if (retryTimer !== undefined) return
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined
    void drainQueue()
  }, retryDelayMs)
}

function drainQueue() {
  if (draining) return draining
  draining = (async () => {
    while (queuedJob && queuedJob.accountId === activeAccountId) {
      const job = queuedJob
      queuedJob = null
      try {
        const saved = await saveCloudState(job.state)
        if (!saved) throw new Error('Cloud session unavailable.')
        clearJob(job)
      } catch {
        const newerQueued = queuedJob as AutosaveJob | null
        if (!newerQueued || newerQueued.version < job.version) queuedJob = job
        scheduleRetry()
        break
      }
    }
  })().finally(() => {
    draining = null
    if (queuedJob && retryTimer === undefined) void drainQueue()
  })
  return draining
}

export function pendingAutosaveState(accountId: string) {
  return readJob(accountId)?.state ?? null
}

export function queueAutosave(accountId: string, state: Record<string, unknown>) {
  activeAccountId = accountId
  const job: AutosaveJob = { accountId, version: nextVersion(), state }
  storeJob(job)
  queuedJob = job
  void drainQueue()
}

export async function flushAutosave(accountId: string) {
  activeAccountId = accountId
  const stored = readJob(accountId)
  if (stored && (!queuedJob || stored.version > queuedJob.version)) queuedJob = stored
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer)
    retryTimer = undefined
  }
  await drainQueue()
}

export function pauseAutosave(accountId: string) {
  if (activeAccountId !== accountId) return
  activeAccountId = ''
  if (queuedJob?.accountId === accountId) queuedJob = null
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer)
    retryTimer = undefined
  }
}
