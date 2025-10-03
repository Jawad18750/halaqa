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
  const res = await fetch(url, { ...options, headers })
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) {
    const msg = body?.error || res.statusText
    throw new Error(msg)
  }
  return body
}

// Auth
export const auth = {
  async register(username, password) {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
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
  logout() { setToken('') }
}

// Students
export const students = {
  async list() { return await request('/students') },
  async create(input) { return await request('/students', { method: 'POST', body: JSON.stringify(input) }) },
  async update(id, input) { return await request(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) },
  async remove(id) { return await request(`/students/${id}`, { method: 'DELETE' }) }
}

// Sessions
export const sessions = {
  async create(input) { return await request('/sessions', { method: 'POST', body: JSON.stringify(input) }) },
  async forStudent(id) { return await request(`/sessions/student/${id}`) },
  async weekly() { return await request('/sessions/weekly') }
}

export function getToken() { return token }
export function getApiUrl() { return API_URL }


