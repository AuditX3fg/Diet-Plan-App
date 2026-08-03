import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored) return JSON.parse(stored) as T
    } catch {
      // A private browsing policy can disable storage; the app still works in memory.
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Keep the app usable when storage is unavailable.
    }
  }, [key, value])

  return [value, setValue] as const
}
