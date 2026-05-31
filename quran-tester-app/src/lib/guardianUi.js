import {
  INVITE_CHANNELS,
  buildTelegramInviteMessage,
  buildInviteMessageForChannel,
  getInviteUrl,
  openGuardianInvite,
  inviteChannelToast,
} from './guardianInvite.js'

export {
  INVITE_CHANNELS,
  buildTelegramInviteMessage,
  buildInviteMessageForChannel,
  getInviteUrl,
  openGuardianInvite,
  inviteChannelToast,
}

export function telegramStatus(row) {
  if (!row?.telegram_linked) return { label: 'غير مربوط', className: 'guardian-badge--muted', filter: 'unlinked' }
  if (row.telegram_opt_out) return { label: 'إشعارات متوقفة', className: 'guardian-badge--warn', filter: 'optout' }
  return { label: 'مربوط ✓', className: 'guardian-badge--ok', filter: 'linked' }
}

export function isTelegramActive(row) {
  return row?.telegram_linked && !row?.telegram_opt_out
}

export function telegramNotificationStatusLabel(row) {
  if (!row?.telegram_linked) return null
  return row.telegram_opt_out ? 'متوقفة' : 'نشطة'
}

export function formatTelegramLinkedAt(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      numberingSystem: 'latn',
    })
  } catch {
    return null
  }
}

export function formatTelegramAccountLabel(row) {
  if (!row?.telegram_linked) return null
  const display = String(row.telegram_display_name || '').trim()
  const username = String(row.telegram_username || '').trim().replace(/^@/, '')
  if (display && username) return `${display} (@${username})`
  if (display) return display
  if (username) return `@${username}`
  return 'حساب Telegram'
}

export function needsInvite(row) {
  return !isTelegramActive(row)
}

export function guardianInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[parts.length - 1][0]
}

export function guardianDisplayName(row) {
  const name = String(row?.name || '').trim()
  return name || 'ولي أمر'
}

export function isPlaceholderGuardianName(name) {
  const n = String(name || '').trim()
  if (!n || n === 'ولي أمر') return true
  if (/^ولي\s*[–\-—]\s*\d/.test(n)) return true
  if (/^guardian\s/i.test(n)) return true
  return false
}

export function formatPhoneShort(phoneE164) {
  const p = String(phoneE164 || '').trim()
  if (!p) return ''
  if (p.startsWith('+218') && p.length >= 12) return `0${p.slice(4)}`
  return p
}

export function formatGuardianStudentsPreview(students, limit = 3) {
  const list = (students || []).filter(s => s?.name)
  if (!list.length) return ''
  const shown = list.slice(0, limit).map(s => {
    const num = s.number != null ? String(s.number) : ''
    return num ? `${num} · ${s.name}` : s.name
  })
  const rest = list.length - limit
  if (rest > 0) return `${shown.join('، ')} +${rest}`
  return shown.join('، ')
}

/** Card title when list names alone are ambiguous (e.g. «ولي – 09…»). */
export function guardianCardTitle(row, students = []) {
  const name = String(row?.name || '').trim()
  const list = (students || []).filter(s => s?.name)
  if (!isPlaceholderGuardianName(name)) return name
  if (list.length === 1) return `ولي ${list[0].name}`
  if (list.length > 1) return `ولي ${list[0].name} (+${list.length - 1})`
  const phone = formatPhoneShort(row?.phone_e164)
  return phone ? `ولي أمر · ${phone}` : 'ولي أمر'
}

export function guardianCardSubtitle(row, students = []) {
  if (row?.notes?.trim()) return row.notes.trim()
  return null
}

export function parseFamilyStudents(family) {
  if (!family?.students) return []
  if (Array.isArray(family.students)) return family.students
  if (typeof family.students === 'string') {
    try { return JSON.parse(family.students) } catch { return [] }
  }
  return []
}

export function formatFamilyLabel(family) {
  const students = parseFamilyStudents(family)
  const count = students.length
  if (!count) return family.name
  const preview = students.slice(0, 2).map(s => s.name).filter(Boolean).join('، ')
  return `${family.name} (${count} ${count === 1 ? 'طالب' : 'طلاب'}${preview ? `: ${preview}` : ''}${count > 2 ? '…' : ''})`
}

export function filterGuardians(list, { query = '', status = 'all' } = {}) {
  const q = query.trim().toLowerCase()
  return (list || []).filter(row => {
    if (status === 'linked' && !isTelegramActive(row)) return false
    if (status === 'unlinked' && row.telegram_linked) return false
    if (status === 'optout' && !(row.telegram_linked && row.telegram_opt_out)) return false
    if (status === 'needs_invite' && !needsInvite(row)) return false
    if (!q) return true
    const studentHay = (row.students || []).map(s => `${s.name || ''} ${s.number || ''}`).join(' ')
    const hay = `${row.name || ''} ${row.phone_e164 || ''} ${row.notes || ''} ${studentHay}`.toLowerCase()
    return hay.includes(q)
  })
}

export function guardianStats(list) {
  const rows = list || []
  const linked = rows.filter(isTelegramActive).length
  const needs = rows.filter(needsInvite).length
  return { total: rows.length, linked, needsInvite: needs }
}

export function linkedStudentIdSet(guardiansList) {
  const ids = new Set()
  for (const g of guardiansList || []) {
    for (const s of g.students || []) {
      if (s?.id) ids.add(s.id)
    }
  }
  return ids
}

export function studentsMissingGuardian(guardiansList, studentsList) {
  const linkedStudentIds = linkedStudentIdSet(guardiansList)
  return (studentsList || []).filter(s => !linkedStudentIds.has(s.id))
}

export function guardianCoverageStats(guardiansList, studentsList) {
  const students = studentsList || []
  const withoutGuardian = studentsMissingGuardian(guardiansList, students).length
  return {
    ...guardianStats(guardiansList),
    studentsWithoutGuardian: withoutGuardian,
    studentsTotal: students.length,
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function emptyGuardianRow(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    mode: 'new',
    guardianId: '',
    name: '',
    phone: '',
    relationship: '',
    isPrimary: true,
    notifyOnResult: true,
    ...overrides,
  }
}

const SIBLING_TEMPLATE_KEY = 'quranTester.guardianSiblingTemplate'

export function saveSiblingGuardianTemplate(rows) {
  try {
    const payload = rows.map(r => ({
      mode: r.mode,
      guardianId: r.guardianId,
      name: r.name,
      phone: r.phone,
      relationship: r.relationship,
      isPrimary: r.isPrimary,
      notifyOnResult: r.notifyOnResult,
    }))
    sessionStorage.setItem(SIBLING_TEMPLATE_KEY, JSON.stringify(payload))
  } catch {}
}

export function loadSiblingGuardianTemplate() {
  try {
    const raw = sessionStorage.getItem(SIBLING_TEMPLATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.map(r => emptyGuardianRow(r))
  } catch {
    return null
  }
}
