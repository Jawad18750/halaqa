const STORAGE_KEY = 'halaqa-app-version'

/** Force one reload when a new build is deployed (clears stale index.html / JS cache). */
export function enforceAppVersionReload() {
  const current = import.meta.env.VITE_BUILD_TAG || 'dev'
  if (current === 'dev') return

  let previous = ''
  try {
    previous = localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return
  }

  if (!previous) {
    try { localStorage.setItem(STORAGE_KEY, current) } catch { /* ignore */ }
    return
  }

  if (previous === current) return

  try {
    localStorage.setItem(STORAGE_KEY, current)
  } catch { /* ignore */ }

  const url = new URL(window.location.href)
  if (url.searchParams.get('app_reload') === current) return

  url.searchParams.set('app_reload', current)
  window.location.replace(url.toString())
}
