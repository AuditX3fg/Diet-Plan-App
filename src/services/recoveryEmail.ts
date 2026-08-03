import type { UserAccount } from '../types'

const configuredUrl = import.meta.env.VITE_RECOVERY_API_URL?.trim().replace(/\/$/, '')

export function isWelcomeEmailConfigured() {
  return Boolean(configuredUrl)
}

export async function sendWelcomeEmail(account: UserAccount, offlineRecoveryCode: string) {
  if (!configuredUrl || !account.email) return false
  const response = await fetch(`${configuredUrl}/v1/accounts/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      accountId: account.id,
      username: account.username,
      email: account.email,
      displayName: account.displayName,
      initialRecoveryCode: offlineRecoveryCode,
    }),
  })
  if (!response.ok) throw new Error('Your account was created, but the welcome email could not be delivered.')
  return true
}
