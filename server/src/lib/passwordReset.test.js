import test from 'node:test'
import assert from 'node:assert/strict'
import { invalidateUnusedPasswordResets, PASSWORD_RESET_TTL_MS } from './passwordReset.js'

test('PASSWORD_RESET_TTL_MS is one hour', () => {
  assert.equal(PASSWORD_RESET_TTL_MS, 60 * 60 * 1000)
})

test('invalidateUnusedPasswordResets updates unused rows for the user', async () => {
  const calls = []
  const db = {
    query(sql, params) {
      calls.push({ sql, params })
      return { rowCount: 2 }
    },
  }
  await invalidateUnusedPasswordResets(db, 'user-123')
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /update password_resets set used_at=now\(\)/i)
  assert.match(calls[0].sql, /used_at is null/i)
  assert.deepEqual(calls[0].params, ['user-123'])
})
