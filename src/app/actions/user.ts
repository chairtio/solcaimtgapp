'use server'

import { updateUser } from '@/lib/database-admin'
import { requireTelegramUser } from '@/lib/telegram-user'

/**
 * Updates the user's receiver wallet address. Validates format before saving.
 */
export async function updateReceiverWallet(
  telegramInitData: string,
  receiverWallet: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = receiverWallet?.trim()
  if (!trimmed) {
    return { success: false, error: 'Receiver wallet is required.' }
  }
  try {
    const { PublicKey } = await import('@solana/web3.js')
    new PublicKey(trimmed)
  } catch {
    return { success: false, error: 'Invalid Solana address.' }
  }
  try {
    const { telegramId } = await requireTelegramUser(telegramInitData)
    await updateUser(telegramId, { receiver_wallet: trimmed })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
