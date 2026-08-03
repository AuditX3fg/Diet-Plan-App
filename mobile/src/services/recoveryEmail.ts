import type { UserAccount } from '../types'

const configuredUrl = process.env.EXPO_PUBLIC_RECOVERY_API_URL?.trim().replace(/\/$/, '')

interface ApiErrorBody {
  error?: string
  message?: string
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!configuredUrl) {
    throw new Error('Email recovery is not configured in this build. Use your saved recovery code or ask the app administrator to configure the recovery service.')
  }

  let response: Response
  try {
    response = await fetch(`${configuredUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the email recovery service. Check your connection and try again.')
  }

  const payload = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new Error(payload.error ?? payload.message ?? 'Email recovery could not be completed. Please try again.')
  return payload
}

export function isEmailRecoveryConfigured() {
  return Boolean(configuredUrl)
}

export async function registerRecoveryEmail(account: UserAccount, initialRecoveryCode?: string) {
  if (!account.email) throw new Error('Add an email address before enabling email recovery.')
  await post<{ delivered?: boolean }>('/v1/accounts/register', {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.displayName,
    initialRecoveryCode,
  })
}

export async function requestRecoveryEmail(identifier: string) {
  await post<{ accepted: boolean }>('/v1/recovery/request', { identifier })
}

export async function verifyRecoveryEmail(identifier: string, code: string) {
  return post<{ accountId: string }>('/v1/recovery/verify', { identifier, code })
}
