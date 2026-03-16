/** Stub: userIds for forward/send utils. Override with env TELEGRAM_FORWARD_USER_IDS (comma-separated) if needed. */
export const userIds = (process.env.TELEGRAM_FORWARD_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number)
