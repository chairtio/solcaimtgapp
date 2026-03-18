'use server'

import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { closeEmptyTokenAccounts, getClaimableRent, getClaimableRentTotalsOnly, getWalletTokenAccounts, RENT_EXEMPTION_LAMPORTS } from '@/lib/solana'
import {
  getWallets,
  getUserById,
  getReferrerByReferee,
  upsertTokenAccounts,
  createTransaction,
  createReferralPayout,
} from '@/lib/database'
import { getCommissionWallet } from '@/lib/config'

/**
 * Sends a claim notification to the Telegram group claims topic.
 * Call from all claim paths (home, Add Wallet, batch). Fails silently if env not set.
 */
export async function sendClaimNotificationToGroup(params: {
  userId: string
  netAmount: number
  walletCount: number
}): Promise<void> {
  const { userId, netAmount, walletCount } = params
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID
  const topicId = parseInt(process.env.TELEGRAM_CLAIM_TOPICS_ID || '247118', 10)
  if (!token || !chatId) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Claim] TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID not set on Vercel – add them in Project Settings → Environment Variables')
    }
    return
  }
  try {
    const dbUser = await getUserById(userId)
    if (!dbUser?.telegram_id) return
    const icon = netAmount >= 0.1 ? '🟢' : netAmount >= 0.01 ? '🟡' : netAmount >= 0.0015 ? '🟠' : '🔴'
    const displayName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ').trim() || dbUser.username || 'User'
    const escapedName = displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const walletText = walletCount === 1 ? 'wallet' : 'wallets'
    const text = `${icon} New claim: ${netAmount.toFixed(4)} SOL from ${walletCount} ${walletText} by ${escapedName}`
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_thread_id: topicId, text, parse_mode: 'HTML' })
    })
    if (!res.ok) {
      console.error('[Claim] Telegram API error:', res.status, await res.text())
    }
  } catch (e) {
    console.error('[Claim] Failed to send group notification:', e)
  }
}

/** Server-side wallet scan – avoids RPC CORS when called from browser. */
export async function scanWalletForClaimableAction(publicKey: string): Promise<{
  totalRent: number
  accounts: { accountAddress: string; mintAddress: string; rentAmount: number; balance: number; tokenName?: string; tokenImage?: string; usdValue?: number; isDust?: boolean; programIdStr?: string }[]
}> {
  // Batch scan only needs totals; skip Jupiter token lookups for speed.
  const result = await getClaimableRentTotalsOnly(new PublicKey(publicKey))
  return {
    totalRent: result.totalRent,
    accounts: result.accounts,
  }
}

/** Batch scan helper: return empty accounts plus projection counts (no Jupiter). */
export async function scanWalletForBatchProjectionAction(publicKey: string): Promise<{
  closeOnlyCount: number
  cleanupEligibleCount: number
  accounts: { accountAddress: string; mintAddress: string; rentAmount: number; balance: number; programIdStr?: string }[]
}> {
  const pk = new PublicKey(publicKey)
  const tokenAccounts = await getWalletTokenAccounts(pk)
  const closeOnlyCount = tokenAccounts.filter((a) => a.isEmpty && a.programId.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').length
  const cleanupEligibleCount = tokenAccounts.filter((a) => !a.isEmpty && a.programId.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && a.decimals > 0).length

  const accounts = tokenAccounts
    .filter((a) => a.isEmpty)
    .map((a) => ({
      accountAddress: a.address.toString(),
      mintAddress: a.mint.toString(),
      rentAmount: RENT_EXEMPTION_LAMPORTS,
      balance: 0,
      programIdStr: a.programId.toString(),
    }))

  return { closeOnlyCount, cleanupEligibleCount, accounts }
}

export interface ClaimableAccountForAction {
  accountAddress: string
  mintAddress: string
  rentAmount: number
  balance: number
  isDust?: boolean
  programIdStr?: string
}

/**
 * Server action that executes the Solana claim. Runs on the server so
 * FEE_PAYER_PRIVATE_KEY is available (client bundle only gets NEXT_PUBLIC_ vars).
 */
export async function executeClaimOnServer(params: {
  privateKeyBase58?: string
  walletId: string
  userId: string
  claimableAccounts: ClaimableAccountForAction[]
  publicKey: string
}): Promise<{ success: boolean; error?: string; closedCount?: number; netAmount?: number; signatures?: string[] }> {
  try {
    const { walletId, userId, claimableAccounts, publicKey } = params

    let keypair: Keypair
    if (params.privateKeyBase58) {
      try {
        keypair = Keypair.fromSecretKey(bs58.decode(params.privateKeyBase58.trim()))
      } catch (e) {
        return { success: false, error: 'Invalid private key format.' }
      }
    } else {
      const wallets = await getWallets(userId)
      const wallet = wallets.find((w) => w.id === walletId)
      if (!wallet?.encrypted_private_key) {
        return { success: false, error: 'Private key not found. Please add it first.' }
      }
      try {
        keypair = Keypair.fromSecretKey(bs58.decode(wallet.encrypted_private_key))
      } catch (e) {
        return { success: false, error: 'Stored private key is invalid.' }
      }
    }

    if (keypair.publicKey.toString() !== publicKey) {
      return { success: false, error: 'Wallet does not match scanned address. Please rescan the correct wallet.' }
    }

    const dbUser = await getUserById(userId)
    const receiverWallet = dbUser?.receiver_wallet?.trim()
    if (!receiverWallet) {
      return { success: false, error: 'Set your receiver wallet in Settings first.' }
    }
    try {
      new PublicKey(receiverWallet)
    } catch {
      return { success: false, error: 'Invalid receiver wallet in Settings. Please update it.' }
    }

    // Look up referrer for 10% referral split (referee = dbUser.telegram_id)
    const referrer = dbUser?.telegram_id ? await getReferrerByReferee(dbUser.telegram_id) : null
    const commissionWallet = getCommissionWallet()

    const options =
      referrer != null || commissionWallet != null
        ? {
            referrerWallet:
              referrer?.receiverWallet != null ? new PublicKey(referrer.receiverWallet) : undefined,
            referralPercent: referrer?.commissionPercentage ?? 10,
            commissionWallet: commissionWallet ?? undefined,
          }
        : undefined

    const result = await closeEmptyTokenAccounts(
      keypair,
      claimableAccounts,
      publicKey,
      new PublicKey(receiverWallet),
      options
    )

    if (result.succeededAccounts.length === 0) {
      return {
        success: false,
        error: result.errors.length > 0 ? result.errors.join(', ') : 'No accounts could be closed.'
      }
    }

    const closed = result.succeededAccounts
    const actualRentLamports = closed.reduce((s, a) => s + a.rentAmount, 0)
    const actualRentSol = actualRentLamports / 1e9
    const feeAmount = result.feeAmount ?? 0
    const referrerAmount = result.referrerAmount ?? 0
    const netAmount = actualRentSol - feeAmount - referrerAmount

    const dbAccounts = closed.map((acc) => ({
      wallet_id: walletId,
      account_address: acc.accountAddress,
      mint_address: acc.mintAddress,
      balance: acc.balance,
      rent_amount: acc.rentAmount,
      is_empty: true,
      last_scanned: new Date().toISOString()
    }))

    await upsertTokenAccounts(dbAccounts)

    const tx = await createTransaction({
      wallet_id: walletId,
      signature: result.signatures[0] || 'claim_' + Date.now(),
      type: 'batch_claim',
      status: 'confirmed',
      sol_amount: netAmount,
      accounts_closed: closed.length,
      fee_amount: feeAmount
    })

    if (referrerAmount > 0 && referrer != null) {
      await createReferralPayout({
        referrer_id: referrer.referrerId,
        amount: referrerAmount,
        transaction_id: tx.id
      })
    }

    // Notify group (claims topic) on successful mini app claim
    await sendClaimNotificationToGroup({ userId, netAmount, walletCount: 1 })

    return {
      success: true,
      closedCount: closed.length,
      netAmount,
      signatures: result.signatures
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Server action that only closes token accounts (no DB). Use for Add Wallet modal
 * and batch claim - runs on server so FEE_PAYER_PRIVATE_KEY is available.
 */
export async function closeTokenAccountsOnServer(params: {
  privateKeyBase58: string
  userId: string
  claimableAccounts: ClaimableAccountForAction[]
  publicKey: string
}): Promise<{
  success: boolean
  error?: string
  signatures: string[]
  succeededAccounts: ClaimableAccountForAction[]
  feeAmount?: number
  referrerAmount?: number
  referrerId?: string
}> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(params.privateKeyBase58.trim()))
    if (keypair.publicKey.toString() !== params.publicKey) {
      return { success: false, error: 'Wallet does not match.', signatures: [], succeededAccounts: [] }
    }
    const dbUser = await getUserById(params.userId)
    const receiverWallet = dbUser?.receiver_wallet?.trim()
    if (!receiverWallet) {
      return { success: false, error: 'Set your receiver wallet in Settings first.', signatures: [], succeededAccounts: [] }
    }
    try {
      new PublicKey(receiverWallet)
    } catch {
      return { success: false, error: 'Invalid receiver wallet in Settings. Please update it.', signatures: [], succeededAccounts: [] }
    }

    const referrer = dbUser?.telegram_id ? await getReferrerByReferee(dbUser.telegram_id) : null
    const commissionWallet = getCommissionWallet()
    const options =
      referrer != null || commissionWallet != null
        ? {
            referrerWallet: referrer?.receiverWallet != null ? new PublicKey(referrer.receiverWallet) : undefined,
            referralPercent: referrer?.commissionPercentage ?? 10,
            commissionWallet: commissionWallet ?? undefined,
          }
        : undefined

    const result = await closeEmptyTokenAccounts(
      keypair,
      params.claimableAccounts,
      params.publicKey,
      new PublicKey(receiverWallet),
      options
    )
    return {
      success: result.succeededAccounts.length > 0,
      error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
      signatures: result.signatures,
      succeededAccounts: result.succeededAccounts,
      feeAmount: result.feeAmount,
      referrerAmount: result.referrerAmount,
      referrerId: referrer?.referrerId,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      signatures: [],
      succeededAccounts: [],
    }
  }
}
