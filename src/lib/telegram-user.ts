import { validateInitData } from './telegram-auth'
import { getUser } from './database'

export async function requireTelegramUser(initData: string): Promise<{ userId: string; telegramId: string }> {
  const validated = validateInitData(initData)
  if (!validated) {
    throw new Error('Unauthorized: invalid Telegram init data')
  }

  const telegramId = validated.user.id.toString()
  const user = await getUser(telegramId)
  if (!user) {
    throw new Error('Unauthorized: user not registered')
  }

  return { userId: user.id, telegramId }
}

