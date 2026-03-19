'use server'

import { requireTelegramUser } from '@/lib/telegram-user'
import bs58 from 'bs58'
import { Keypair } from '@solana/web3.js'
import {
  getWalletByPublicKey,
  getUserWalletsWithStats,
  createWallet,
  updateWallet,
  deactivateWallet,
  saveWalletPrivateKey,
  getWalletMetaById,
} from '@/lib/database-admin'

/**
 * Secure wallet metadata/read helpers for the mini app.
 * These must derive the user identity from Telegram initData on the server.
 */

export async function getMyWalletsWithStatsAction(telegramInitData: string) {
  const { userId } = await requireTelegramUser(telegramInitData)
  return await getUserWalletsWithStats(userId)
}

export async function getMyWalletByPublicKeyAction(
  telegramInitData: string,
  publicKey: string,
) {
  const { userId } = await requireTelegramUser(telegramInitData)
  return await getWalletByPublicKey(userId, publicKey)
}

export async function createOrActivateWalletAction(
  telegramInitData: string,
  publicKey: string,
) {
  const { userId } = await requireTelegramUser(telegramInitData)

  const existing = await getWalletByPublicKey(userId, publicKey)
  if (existing) {
    if (existing.status !== 'active') {
      // We only care about status; we don't want to return any secret-bearing fields.
      await updateWallet(existing.id, { status: 'active' })
    }
    return { walletId: existing.id }
  }

  const newWallet = await createWallet({
    user_id: userId,
    public_key: publicKey,
    status: 'active',
  })

  return { walletId: newWallet.id }
}

export async function deactivateMyWalletAction(telegramInitData: string, walletId: string) {
  const { userId } = await requireTelegramUser(telegramInitData)
  const meta = await getWalletMetaById(userId, walletId)
  if (!meta) return { success: false, error: 'Wallet not found.' }

  await deactivateWallet(walletId)
  return { success: true }
}

export async function saveMyWalletPrivateKeyAction(
  telegramInitData: string,
  walletId: string,
  privateKey: string,
) {
  const { userId } = await requireTelegramUser(telegramInitData)
  const meta = await getWalletMetaById(userId, walletId)
  if (!meta) return { success: false, error: 'Wallet not found.' }

  // Validate the provided key actually matches the wallet's public key (prevents saving wrong secrets).
  let kp: Keypair
  try {
    kp = Keypair.fromSecretKey(bs58.decode(privateKey.trim()))
  } catch {
    return { success: false, error: 'Invalid private key format. Must be base58 encoded.' }
  }
  if (kp.publicKey.toString() !== meta.public_key) {
    return { success: false, error: 'Private key does not match the wallet address.' }
  }

  await saveWalletPrivateKey(walletId, privateKey)
  return { success: true }
}

