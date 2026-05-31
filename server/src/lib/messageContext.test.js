import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLinkCode, formatLinkCodeForDisplay } from './messageContext.js'

test('normalizeLinkCode accepts compact Western digits', () => {
  assert.equal(normalizeLinkCode('482917'), '482917')
})

test('normalizeLinkCode accepts spaced and hyphenated codes', () => {
  assert.equal(normalizeLinkCode('482 917'), '482917')
  assert.equal(normalizeLinkCode('482-917'), '482917')
})

test('normalizeLinkCode accepts Arabic-Indic digits with spaces', () => {
  assert.equal(normalizeLinkCode('٤٨٢ ٩١٧'), '482917')
  assert.equal(normalizeLinkCode('٤٨٢٩١٧'), '482917')
})

test('normalizeLinkCode trims surrounding whitespace', () => {
  assert.equal(normalizeLinkCode('  482917  '), '482917')
})

test('normalizeLinkCode rejects invalid codes', () => {
  assert.equal(normalizeLinkCode('12345'), null)
  assert.equal(normalizeLinkCode('1234567'), null)
  assert.equal(normalizeLinkCode('abc123'), null)
  assert.equal(normalizeLinkCode(''), null)
  assert.equal(normalizeLinkCode(null), null)
})

test('formatLinkCodeForDisplay formats six-digit codes', () => {
  assert.equal(formatLinkCodeForDisplay('482917'), '482 917')
  assert.equal(formatLinkCodeForDisplay('482 917'), '482 917')
})
