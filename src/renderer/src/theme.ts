export type Theme = 'light' | 'dark'

const KEY = 'neoavdc.theme'

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const app = document.querySelector('.app') as HTMLElement | null
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  if (app) app.setAttribute('data-theme', theme)
  window.localStorage.setItem(KEY, theme)
}

export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
