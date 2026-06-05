import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatMemorizationLines,
  formatMemorizationThumun,
  formatQalamLine,
  formatQalamOrdinal,
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

test('formatMemorizationLines supports surah-only position', () => {
  const lines = formatMemorizationLines({ memorization_surah: 'الفاتحة' }, thumuns)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /سورة الفاتحة/)
})

test('formatQalamLine uses student qalam_count (full Quran completions)', () => {
  assert.equal(formatQalamLine({ qalam_count: 1 }), 'القلم: الأول')
  assert.equal(formatQalamLine({ qalam_count: 2 }), 'القلم: الثاني')
  assert.equal(formatQalamLine({}), 'القلم: الأول')
})

test('formatQalamOrdinal maps ordinals', () => {
  assert.equal(formatQalamOrdinal(3), 'الثالث')
})
