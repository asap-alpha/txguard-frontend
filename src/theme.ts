import { computed, ref, watchEffect } from 'vue'

// Theme preference. 'system' follows the OS setting; 'light'/'dark' pin it.
export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'txguard.theme'
const media = window.matchMedia('(prefers-color-scheme: light)')

function loadPref(): ThemePref {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

const pref = ref<ThemePref>(loadPref())
// Tracks the OS setting so 'system' mode stays reactive to changes.
const systemLight = ref(media.matches)
media.addEventListener('change', e => { systemLight.value = e.matches })

/** The theme actually in effect once 'system' is resolved. */
export const resolvedTheme = computed<Theme>(() =>
  pref.value === 'system' ? (systemLight.value ? 'light' : 'dark') : pref.value)

export const themePref = computed<ThemePref>(() => pref.value)

// Reflect the resolved theme onto <html> so CSS (and native form controls via
// color-scheme) pick it up. Runs immediately and on every change.
watchEffect(() => { document.documentElement.dataset.theme = resolvedTheme.value })

export function setTheme(next: ThemePref) {
  pref.value = next
  if (next === 'system') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, next)
}

/** Toggle between light and dark, pinning the choice (leaves 'system'). */
export function toggleTheme() {
  setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
}
