const PRODUCTION_API_BY_HOST = {
  'halaqa.abdeljawad.com': 'https://api.halaqa.abdeljawad.com',
}

function resolveApiUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined') {
    const fromHost = PRODUCTION_API_BY_HOST[window.location.hostname]
    if (fromHost) return fromHost
  }
  return fromEnv || 'http://localhost:4000'
}

const API_URL = resolveApiUrl()
const DEBUG_API =
  (import.meta.env?.DEV ?? false) ||
  String(import.meta.env?.VITE_DEBUG_API || '') === '1'

let token = localStorage.getItem('token') || ''

export function setToken(next) {
  token = next || ''
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

async function request(path, options = {}, timeoutMs = 15000) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = `${API_URL}${path}`
  if (DEBUG_API) console.log('API request →', options.method || 'GET', url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs)
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const body = isJson ? await res.json() : null
    if (!res.ok) {
      let msg = body?.error || res.statusText || 'Request failed'
      if (res.status === 401 && !body?.error) msg = 'غير مصرح'
      if (/Network timeout/i.test(String(msg))) msg = 'انتهت مهلة الشبكة'
      throw new Error(msg)
    }
    return body
  } catch (e) {
    if (e?.name === 'AbortError' || e === 'timeout') {
      throw new Error('انتهت مهلة الشبكة')
    }
    const msg = String(e?.message || '')
    if (/load failed|failed to fetch|networkerror|network error/i.test(msg)) {
      throw new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

// Auth
export const auth = {
  async register(username, password, email) {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, email }) })
    setToken(data.token)
    return data
  },
  async login(username, password) {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    setToken(data.token)
    return data
  },
  async me() {
    return await request('/auth/me')
  },
  async updateSettings(input) {
    return await request('/auth/settings', { method: 'PATCH', body: JSON.stringify(input) })
  },
  async forgot(email) {
    return await request('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async reset(token, password) {
    return await request('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) })
  },
  logout() { setToken('') }
}

// Students
export const students = {
  async list() { return await request('/students') },
  async create(input) { return await request('/students', { method: 'POST', body: JSON.stringify(input) }) },
  async update(id, input) { return await request(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) },
  async remove(id) { return await request(`/students/${id}`, { method: 'DELETE' }) },
  async uploadPhoto(id, file) {
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const form = new FormData()
    form.append('photo', file)
    const url = `${API_URL}/students/${id}/photo`
    const res = await fetch(url, { method: 'POST', headers, body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error || 'upload failed')
    return body
  }
}

// Sessions
export const sessions = {
  async create(input) { return await request('/sessions', { method: 'POST', body: JSON.stringify(input) }, 30000) },
  async forStudent(id) { return await request(`/sessions/student/${id}`) },
  async weekly() { return await request('/sessions/weekly') },
  async overview(from, to) {
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString() ? `?${params.toString()}` : ''
      return await request(`/sessions/overview${qs}`)
    } catch (e) {
      // Fallback for older server without /overview
      const w = await request('/sessions/weekly')
      return { from: w.weekStartDate, to: w.weekStartDate, sessions: w.sessions || [] }
    }
  },
  async updateTime(id, attemptAt) {
    return await request(`/sessions/${id}/time`, { method: 'PATCH', body: JSON.stringify({ attemptAt }) })
  },
  async remove(id) { return await request(`/sessions/${id}`, { method: 'DELETE' }) }
}

export function getToken() { return token }
export function getApiUrl() { return API_URL }

// Guardians
export const guardians = {
  async list() { return await request('/guardians') },
  async create(input) { return await request('/guardians', { method: 'POST', body: JSON.stringify(input) }) },
  async update(id, input) { return await request(`/guardians/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) },
  async remove(id) { return await request(`/guardians/${id}`, { method: 'DELETE' }) },
  async forStudent(studentId) { return await request(`/guardians/students/${studentId}/guardians`) },
  async linkToStudent(studentId, input) {
    return await request(`/guardians/students/${studentId}/guardians`, { method: 'POST', body: JSON.stringify(input) })
  },
  async updateLink(linkId, input) {
    return await request(`/guardians/links/${linkId}`, { method: 'PATCH', body: JSON.stringify(input) })
  },
  async removeLink(linkId) { return await request(`/guardians/links/${linkId}`, { method: 'DELETE' }) },
  async createLinkCode(guardianId) {
    return await request(`/guardians/${guardianId}/link-code`, { method: 'POST', body: '{}' })
  },
  async revokeTelegram(guardianId) {
    return await request(`/guardians/${guardianId}/telegram`, { method: 'DELETE' })
  },
}

// Notifications
export const notifications = {
  async broadcast(message, targetType, targetId, targetIds) {
    return await request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message, targetType, targetId: targetId || null, targetIds: targetIds || null }),
    })
  },
  async sendToGuardians(message, guardianIds) {
    return await request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message, targetType: 'guardians', targetIds: guardianIds }),
    })
  },
  async log(limit = 50, studentId) {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (studentId) params.set('studentId', studentId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return await request(`/notifications/log${qs}`)
  },
  async listFamilies() { return await request('/notifications/families') },
  async createFamily(name, studentIds) {
    return await request('/notifications/families', {
      method: 'POST',
      body: JSON.stringify({ name, studentIds }),
    })
  },
  async removeFamily(id) {
    return await request(`/notifications/families/${id}`, { method: 'DELETE' })
  },
}

// Backup (export/import)
export const backup = {
  async exportWithPhotos() {
    const url = `${API_URL}/backup/export?photos=1`
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || 'فشل تنزيل النسخة الاحتياطية')
    }
    const disposition = res.headers.get('content-disposition') || ''
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
    const filename = match ? match[1] : 'halaqa-backup.json'
    const blob = await res.blob()
    return { blob, filename }
  },
  async importBackup(data) {
    return await request('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}


