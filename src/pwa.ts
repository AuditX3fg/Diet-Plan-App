export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredInstallPrompt: InstallPromptEvent | null = null
const listeners = new Set<(prompt: InstallPromptEvent | null) => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener(deferredInstallPrompt))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as InstallPromptEvent
    notifyListeners()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    notifyListeners()
  })
}

export function getInstallPrompt() {
  return deferredInstallPrompt
}

export function clearInstallPrompt() {
  deferredInstallPrompt = null
  notifyListeners()
}

export function subscribeToInstallPrompt(listener: (prompt: InstallPromptEvent | null) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
