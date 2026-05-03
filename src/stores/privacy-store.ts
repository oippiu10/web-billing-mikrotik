import { create } from 'zustand'

interface PrivacyState {
  privacyMode: boolean
  togglePrivacyMode: () => void
  setPrivacyMode: (value: boolean) => void
}

const STORAGE_KEY = 'privacy-mode'

const applyPrivacyClass = (value: boolean) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('privacy-mode', value)
  }
}

const initialPrivacyMode = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
applyPrivacyClass(initialPrivacyMode)

export const usePrivacyStore = create<PrivacyState>((set) => ({
  privacyMode: initialPrivacyMode,
  togglePrivacyMode: () => set((state) => {
    const next = !state.privacyMode
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next))
    applyPrivacyClass(next)
    return { privacyMode: next }
  }),
  setPrivacyMode: (value) => set(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(value))
    applyPrivacyClass(value)
    return { privacyMode: value }
  }),
}))
