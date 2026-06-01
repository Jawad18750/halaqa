import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhoneE164, phonesEquivalent } from './phone.js'

test('normalizePhoneE164 handles Libya local numbers', () => {
  assert.equal(normalizePhoneE164('0918693658'), '+218918693658')
  assert.equal(normalizePhoneE164('918693658'), '+218918693658')
  assert.equal(normalizePhoneE164('218918693658'), '+218918693658')
})

test('normalizePhoneE164 strips extra zero after country code', () => {
  assert.equal(normalizePhoneE164('+2180918693658'), '+218918693658')
  assert.equal(normalizePhoneE164('00218918693658'), '+218918693658')
  assert.equal(normalizePhoneE164('+218 91 869 3658'), '+218918693658')
})

test('normalizePhoneE164 handles Arabic-Indic digits', () => {
  assert.equal(normalizePhoneE164('+٢١٨٩١٨٦٩٣٦٥٨'), '+218918693658')
  assert.equal(normalizePhoneE164('٠٩١٨٦٩٣٦٥٨'), '+218918693658')
})

test('phonesEquivalent treats formatting variants as same number', () => {
  assert.equal(phonesEquivalent('0918693658', '+218918693658'), true)
  assert.equal(phonesEquivalent('+2180918693658', '218918693658'), true)
  assert.notEqual(phonesEquivalent('0918693658', '0920000000'), true)
})

test('normalizePhoneE164 rejects invalid numbers', () => {
  assert.equal(normalizePhoneE164(''), null)
  assert.equal(normalizePhoneE164('123'), null)
  assert.equal(normalizePhoneE164('abc'), null)
})
