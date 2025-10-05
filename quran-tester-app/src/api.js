const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

let token = localStorage.getItem('token') || ''

export function setToken(next) {
  token = next || ''
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = `${API_URL}${path}`
  console.log('API request →', options.method || 'GET', url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), 15000)
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
  async create(input) { return await request('/sessions', { method: 'POST', body: JSON.stringify(input) }) },
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


