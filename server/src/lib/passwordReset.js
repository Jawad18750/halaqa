export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

/** Mark all unused reset tokens for a user as used before issuing a new one. */
export async function invalidateUnusedPasswordResets(db, userId) {
  await db.query(
    'update password_resets set used_at=now() where user_id=$1 and used_at is null',
    [userId]
  )
}
