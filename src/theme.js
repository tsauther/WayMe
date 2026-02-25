import { writable } from 'svelte/store'

// Initialize theme from localStorage or system preference
function initTheme() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('wayme-theme')
    if (saved) {
      return saved
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'waymeM3dark'
    }
  }
  return 'waymeM3'
}

export const theme = writable(initTheme())

theme.subscribe(value => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wayme-theme', value)
    const html = document.documentElement
    html.setAttribute('data-theme', value)
  }
})
