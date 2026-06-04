import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatMemorizationLines,
  formatMemorizationThumun,
  formatQalamLine,
} from './memorizationContext.js'

const thumuns = [
  { id: 142, name: 'من ثمن 142', surah: 'النساء', surahNumber: 4, naqza: 12 },
]

test('formatMemorizationThumun includes surah and thumun id', () => {
  const text = formatMemorizationThumun(142, thumuns)
  assert.match(text, /سورة النساء/)
  assert.match(text, /ثمن 142/)
})

test('formatMemorizationLines returns empty when unset', () => {
  assert.deepEqual(formatMemorizationLines({}, thumuns), [])
  assert.deepEqual(formatMemorizationLines({ memorization_thumun_id: null }, thumuns), [])
})

test('formatMemorizationLines returns مستوى الحفظ line', () => {
  const lines = formatMemorizationLines({ memorization_thumun_id: 142 }, thumuns)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /مستوى الحفظ الحالي/)
})

test('formatQalamLine uses Arabic ordinals for small numbers', () => {
  assert.match(formatQalamLine({ test_try_number: 1 }), /الأولى/)
  assert.match(formatQalamLine({ test_try_number: 2 }), /الثانية/)
})
