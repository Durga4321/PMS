import { useSyncExternalStore } from 'react'
import { translateTelugu } from './telugu.js'

const STORAGE_KEY = 'pms_language'
const listeners = new Set()
let fallbackLanguage = 'en'
export const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'te', label: 'తెలుగు (Telugu)' }]

export function getLanguage() {
  try { return localStorage.getItem(STORAGE_KEY) === 'te' ? 'te' : 'en' } catch { return fallbackLanguage }
}

function publish() {
  document.documentElement.lang = getLanguage()
  listeners.forEach((listener) => listener())
}

export function setLanguage(value) {
  const language = value === 'te' ? 'te' : 'en'
  fallbackLanguage = language
  try { localStorage.setItem(STORAGE_KEY, language) } catch { /* Keep the UI usable when storage is unavailable. */ }
  publish()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}

export function translate(text, language) {
  return language === 'te' && typeof text === 'string' ? translateTelugu(text) : text
}

if (typeof window !== 'undefined') {
  document.documentElement.lang = getLanguage()
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) publish()
  })
}
