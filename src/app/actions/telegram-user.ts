'use server'

import { validateInitData } from '@/lib/telegram-auth'
import { getUser, createUser, updateUser, type User } from '@/lib/database-admin'

export async function upsertTelegramUserAction(initData: string): Promise<User> {
  const validated = validateInitData(initData)
  if (!validated) {
    throw new Error('Unauthorized: invalid Telegram init data')
  }

  const telegramUser = validated.user
  const telegramId = telegramUser.id.toString()

  let dbUser = await getUser(telegramId)

  if (!dbUser) {
    dbUser = await createUser({
      telegram_id: telegramId,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      photo_url: telegramUser.photo_url,
      is_premium: telegramUser.is_premium || false,
    })
    return dbUser
  }

  const needsUpdate =
    (dbUser.username ?? '') !== (telegramUser.username ?? '') ||
    (dbUser.first_name ?? '') !== (telegramUser.first_name ?? '') ||
    (dbUser.last_name ?? '') !== (telegramUser.last_name ?? '') ||
    (dbUser.photo_url ?? '') !== (telegramUser.photo_url ?? '') ||
    (dbUser.is_premium ?? false) !== (telegramUser.is_premium || false)

  if (needsUpdate) {
    dbUser = await updateUser(telegramId, {
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      photo_url: telegramUser.photo_url,
      is_premium: telegramUser.is_premium || false,
    })
  }

  return dbUser
}

