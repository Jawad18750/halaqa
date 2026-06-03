import test from 'node:test'
import assert from 'node:assert/strict'
import { getCalendarStatus, todayInHalaqaTimeZone, weekdayInHalaqaTimeZone } from './halaqaCalendar.js'

test('calendar defaults mark Saturday-Wednesday as study days', () => {
  const status = getCalendarStatus('2026-06-03', {
    study_days: ['sat', 'sun', 'mon', 'tue', 'wed'],
    holiday_country: 'none',
    holiday_overrides: {},
  })
  assert.equal(status.day, 'wed')
  assert.equal(status.closed, false)
  assert.equal(status.isStudyDay, true)
})

test('calendar defaults close Friday', () => {
  const status = getCalendarStatus('2026-06-05', {
    study_days: ['sat', 'sun', 'mon', 'tue', 'wed'],
    holiday_country: 'none',
    holiday_overrides: {},
  })
  assert.equal(status.day, 'fri')
  assert.equal(status.closed, true)
  assert.ok(status.reasons.includes('خارج أيام الدراسة'))
})

test('Libya built-in holidays close otherwise open study days', () => {
  const status = getCalendarStatus('2026-02-17', {
    study_days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
    holiday_country: 'LY',
    holiday_overrides: {},
  })
  assert.equal(status.closed, true)
  assert.equal(status.builtInHoliday?.name, 'يوم الثورة')
})

test('custom open override wins over closed day and holiday', () => {
  const status = getCalendarStatus('2026-02-17', {
    study_days: ['sat', 'sun', 'mon', 'tue', 'wed'],
    holiday_country: 'LY',
    holiday_overrides: {
      open: { '2026-02-17': { reason: 'تعويض' } },
      closed: {},
    },
  })
  assert.equal(status.closed, false)
  assert.deepEqual(status.reasons, [])
  assert.equal(status.override.type, 'open')
})

test('today helper formats the Africa/Tripoli calendar date', () => {
  assert.equal(todayInHalaqaTimeZone(new Date('2026-06-02T22:30:00Z')), '2026-06-03')
})

test('weekday helper uses Africa/Tripoli for Date inputs near UTC midnight', () => {
  assert.equal(weekdayInHalaqaTimeZone(new Date('2026-06-02T22:30:00Z')), 'wed')
  const status = getCalendarStatus(new Date('2026-06-02T22:30:00Z'), {
    study_days: ['wed'],
    holiday_country: 'none',
    holiday_overrides: {},
  })
  assert.equal(status.date, '2026-06-03')
  assert.equal(status.day, 'wed')
  assert.equal(status.closed, false)
})
