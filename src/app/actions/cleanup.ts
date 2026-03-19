'use server'

import { Keypair, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js'
import bs58 from 'bs58'
import { connection, getWalletTokenAccounts, getClaimableRentTotalsOnly } from '@/lib/solana'
import { getUserById, getReferrerByReferee } from '@/lib/database'
import { FEE_PAYER_PRIVATE_KEY, getCommissionWallet } from '@/lib/config'
import { closeEmptyTokenAccounts } from '@/lib/solana'
import { TOKEN_PROGRAM_ID, getAccount, createBurnCheckedInstruction } from '@solana/spl-token'
import { executeClaimOnServer } from '@/app/actions/claim'

type CleanupSummary = {
  attemptedSells: number
  sold: number
  burned: number
  skipped: number
  errors: string[]
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const TOKEN_PROGRAM_ID_STR = TOKEN_PROGRAM_ID.toString()
const BURN_BATCH_SIZE = 10
const BURN_COMPUTE_UNITS = 100_000
const BURN_COMPUTE_PRICE_MICROLAMPORTS = 50_000
const FETCH_TIMEOUT_MS = 35_000
const FETCH_RETRIES = 5
const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY?.trim() ?? ''

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = FETCH_RETRIES
): Promise<Response> {
  let lastErr: unknown
  let lastRes: Response | null = null
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)
      // Retry on transient upstream errors.
      if ((res.status === 429 || res.status >= 500) && i < retries - 1) {
        lastRes = res
        const retryAfter = res.headers.get('retry-after')
        let delayMs = 1000 * (i + 1)
        if (retryAfter) {
          const parsed = Number(retryAfter)
          if (Number.isFinite(parsed)) {
            // Retry-After can be seconds.
            delayMs = parsed * 1000
          }
        }
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      return res
    } catch (e) {
      clearTimeout(timeout)
      lastErr = e
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  if (lastRes) return lastRes
  throw lastErr
}

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, p))
}

function amountRawToUi(amountRaw: string, decimals: number): number {
  const n = Number(amountRaw)
  if (!Number.isFinite(n)) return 0
  return n / Math.pow(10, decimals || 0)
}

/** Burn candidate: one token account to burn (bot-style batch: multiple burns in one tx). */
type BurnCandidate = {
  address: PublicKey
  mint: PublicKey
  amountRaw: string
  decimals: number
  mintStr?: string
}

/** Send one or more transactions each with up to BURN_BATCH_SIZE burn instructions (like bot burnall.js). */
async function sendBatchBurns(
  params: {
    user: Keypair
    feePayer: Keypair
    candidates: BurnCandidate[]
    summary: CleanupSummary
  }
): Promise<void> {
  const { user, feePayer, candidates, summary } = params
  if (candidates.length === 0) return
  for (let i = 0; i < candidates.length; i += BURN_BATCH_SIZE) {
    const batch = candidates.slice(i, i + BURN_BATCH_SIZE)
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: BURN_COMPUTE_UNITS }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: BURN_COMPUTE_PRICE_MICROLAMPORTS }),
      ...batch.map((b) =>
        createBurnCheckedInstruction(
          b.address,
          b.mint,
          user.publicKey,
          BigInt(b.amountRaw),
          b.decimals
        )
      ),
    ]
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      const msg = new TransactionMessage({
        payerKey: feePayer.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()
      const tx = new VersionedTransaction(msg)
      tx.sign([feePayer, user])
      const sig = await connection.sendTransaction(tx, { maxRetries: 2 })
      await connection
        .confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
        .catch(() => null)
      summary.burned += batch.length
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown'
      summary.errors.push(`Burn batch failed: ${errMsg}`)
      for (const b of batch) {
        summary.errors.push(`Burn failed for ${b.mintStr ?? b.mint.toString()}: ${errMsg}`)
      }
    }
  }
}

async function fetchJupPrices(mints: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>()
  const ids = Array.from(new Set(mints.filter(Boolean)))
  if (ids.length === 0) return priceMap

  // Jupiter price endpoint (batch)
  const url = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids.join(','))}`
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SolClaim/1.0',
      ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
    },
  })
  if (!res.ok) return priceMap
  const json = await res.json().catch(() => null)
  const data = json?.data
  if (!data || typeof data !== 'object') return priceMap
  for (const mint of Object.keys(data)) {
    const p = Number(data[mint]?.price)
    if (Number.isFinite(p)) priceMap.set(mint, p)
  }
  return priceMap
}

async function jupQuote(params: {
  inputMint: string
  outputMint: string
  amountRaw: string
  slippageBps: number
}): Promise<any | null> {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountRaw,
    slippageBps: String(params.slippageBps),
  })
  const res = await fetchWithRetry(`https://quote-api.jup.ag/v6/quote?${qs.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SolClaim/1.0',
      ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
    },
  })
  if (!res.ok) return null
  return await res.json().catch(() => null)
}

/** Jupiter POST /swap: returns serialized tx (reliable, one tx per token). */
async function jupSwap(params: {
  quoteResponse: any
  userPublicKey: string
  payer: string
  nativeDestinationAccount?: string
}): Promise<{ swapTransaction: string; lastValidBlockHeight: number } | null> {
  const body: Record<string, unknown> = {
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,
    payer: params.payer,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        priorityLevel: 'high',
        maxLamports: 500_000,
      },
    },
  }
  if (params.nativeDestinationAccount) {
    body.nativeDestinationAccount = params.nativeDestinationAccount
  }
  const res = await fetchWithRetry(`https://api.jup.ag/swap/v1/swap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'SolClaim/1.0',
      ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const json = await res.json().catch(() => null)
  if (!json?.swapTransaction || json.lastValidBlockHeight == null) return null
  return {
    swapTransaction: json.swapTransaction,
    lastValidBlockHeight: Number(json.lastValidBlockHeight),
  }
}

/** Deserialize Jupiter's base64 tx, sign with payer + user, send and confirm. */
async function sendJupiterSerializedTx(params: {
  swapTransactionBase64: string
  lastValidBlockHeight: number
  feePayer: Keypair
  user: Keypair
}): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const buf = Buffer.from(params.swapTransactionBase64, 'base64')
    const tx = VersionedTransaction.deserialize(buf)
    const blockhash =
      (tx.message as { recentBlockhash?: string }).recentBlockhash ??
      (await connection.getLatestBlockhash()).blockhash
    tx.sign([params.feePayer, params.user])
    const sig = await connection.sendTransaction(tx, { maxRetries: 2 })
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight: params.lastValidBlockHeight },
      'confirmed'
    ).catch(() => null)
    return { ok: true, signature: sig }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Swap tx failed'
    return { ok: false, error: msg }
  }
}

async function cleanupWalletTokens(params: {
  userId: string
  publicKey: string
  privateKeyBase58: string
  slippageBps: number
}): Promise<CleanupSummary> {
  const summary: CleanupSummary = { attemptedSells: 0, sold: 0, burned: 0, skipped: 0, errors: [] }

  const feePayerKey = FEE_PAYER_PRIVATE_KEY?.trim()
  if (!feePayerKey) {
    summary.errors.push('FEE_PAYER_PRIVATE_KEY not set')
    return summary
  }

  let userKp: Keypair
  let feePayer: Keypair
  try {
    userKp = Keypair.fromSecretKey(bs58.decode(params.privateKeyBase58.trim()))
  } catch {
    summary.errors.push('Invalid private key')
    return summary
  }
  try {
    feePayer = Keypair.fromSecretKey(bs58.decode(feePayerKey))
  } catch {
    summary.errors.push('Invalid fee payer key')
    return summary
  }

  if (userKp.publicKey.toString() !== params.publicKey) {
    summary.errors.push('Wallet does not match public key')
    return summary
  }

  const dbUser = await getUserById(params.userId)
  const receiverWallet = dbUser?.receiver_wallet?.trim()
  if (!receiverWallet) {
    summary.errors.push('Receiver wallet not set')
    return summary
  }
  let receiverPk: PublicKey
  try {
    receiverPk = new PublicKey(receiverWallet)
  } catch {
    summary.errors.push('Invalid receiver wallet')
    return summary
  }

  // Scan token accounts (Token Program only for reliability).
  let tokenAccounts: Awaited<ReturnType<typeof getWalletTokenAccounts>>
  try {
    tokenAccounts = await getWalletTokenAccounts(userKp.publicKey)
  } catch (e) {
    summary.errors.push(e instanceof Error ? e.message : 'Failed to load token accounts')
    return summary
  }
  const candidates = tokenAccounts.filter((t) => t.programId.toString() === TOKEN_PROGRAM_ID_STR && !t.isEmpty)

  // Batch prices (best-effort; empty map only skips dust logic)
  const mintStrs = candidates.map((c) => c.mint.toString()).filter((m) => m !== SOL_MINT)
  let priceMap = new Map<string, number>()
  try {
    priceMap = await fetchJupPrices(mintStrs)
  } catch {
    // continue without prices; sells still attempted, dust burn skipped
  }

  const swapCandidates: Array<{
    mint: string
    acc: (typeof candidates)[number]
    quote: any
    usdValue: number | null
  }> = []
  const burnCandidates: BurnCandidate[] = []

  for (const acc of candidates) {
    const mint = acc.mint.toString()
    if (mint === SOL_MINT) {
      summary.skipped++
      continue
    }

    // Skip NFTs / non-fungible or weird decimals
    if (!acc.decimals || acc.decimals === 0) {
      summary.skipped++
      continue
    }

    // Skip frozen accounts
    try {
      const info = await getAccount(connection, acc.address, 'confirmed', TOKEN_PROGRAM_ID)
      if (info.isFrozen) {
        summary.skipped++
        continue
      }
    } catch {
      summary.skipped++
      continue
    }

    const price = priceMap.get(mint)
    const uiAmount = amountRawToUi(acc.amountRaw, acc.decimals)
    const usdValue = price != null ? uiAmount * price : null

    summary.attemptedSells++

    let quote: Awaited<ReturnType<typeof jupQuote>>
    try {
      quote = await jupQuote({
        inputMint: mint,
        outputMint: SOL_MINT,
        amountRaw: acc.amountRaw,
        slippageBps: params.slippageBps,
      })
    } catch (e) {
      summary.errors.push(`${mint} quote: ${e instanceof Error ? e.message : 'fetch failed'}`)
      summary.skipped++
      continue
    }

    // v6 returns the quote at top level (routePlan, outAmount, etc.), not under .data[0]
    const bestRoute =
      quote && Array.isArray(quote?.routePlan) && quote.routePlan.length > 0 ? quote : null
    if (!bestRoute) {
      // No liquidity/quote. Burn only if we can prove value < $1 (batch later).
      if (usdValue != null && usdValue < 1 && BigInt(acc.amountRaw) > BigInt(0)) {
        burnCandidates.push({
          address: acc.address,
          mint: acc.mint,
          amountRaw: acc.amountRaw,
          decimals: acc.decimals,
          mintStr: mint,
        })
      } else if (usdValue == null || usdValue >= 1) {
        summary.skipped++
      }
      continue
    }

    // Defer execution: sell via Jupiter POST /swap (serialized tx) per token for reliability.
    swapCandidates.push({
      mint,
      acc,
      quote: bestRoute,
      usdValue,
    })
  }

  // Batch burn tokens that had no route or no swap instructions (bot-style: multiple burns per tx).
  await sendBatchBurns({
    user: userKp,
    feePayer,
    candidates: burnCandidates,
    summary,
  })

  // Sell each token via Jupiter POST /swap (one serialized tx per token; reliable).
  const fallbackBurnCandidates: BurnCandidate[] = []
  const maxParallel = 5
  let cursor = 0

  await Promise.all(
    Array.from({ length: Math.min(maxParallel, swapCandidates.length) }, async () => {
      while (true) {
        const i = cursor++
        if (i >= swapCandidates.length) break
        const c = swapCandidates[i]

        let swapResult: { swapTransaction: string; lastValidBlockHeight: number } | null = null
        try {
          swapResult = await jupSwap({
            quoteResponse: c.quote,
            userPublicKey: userKp.publicKey.toString(),
            payer: feePayer.publicKey.toString(),
            nativeDestinationAccount: receiverPk.toString(),
          })
        } catch (e) {
          summary.errors.push(`${c.mint} swap: ${e instanceof Error ? e.message : 'fetch failed'}`)
        }

        if (!swapResult) {
          if (c.usdValue != null && c.usdValue < 1 && BigInt(c.acc.amountRaw) > BigInt(0)) {
            fallbackBurnCandidates.push({
              address: c.acc.address,
              mint: c.acc.mint,
              amountRaw: c.acc.amountRaw,
              decimals: c.acc.decimals,
              mintStr: c.mint,
            })
          } else {
            summary.skipped++
          }
          continue
        }

        const sendRes = await sendJupiterSerializedTx({
          swapTransactionBase64: swapResult.swapTransaction,
          lastValidBlockHeight: swapResult.lastValidBlockHeight,
          feePayer,
          user: userKp,
        })

        if (sendRes.ok) {
          summary.sold++
          continue
        }

        summary.errors.push(`Sell failed for ${c.mint}: ${sendRes.error || 'unknown'}`)
        if (c.usdValue != null && c.usdValue < 1 && BigInt(c.acc.amountRaw) > BigInt(0)) {
          fallbackBurnCandidates.push({
            address: c.acc.address,
            mint: c.acc.mint,
            amountRaw: c.acc.amountRaw,
            decimals: c.acc.decimals,
            mintStr: c.mint,
          })
        } else {
          summary.skipped++
        }
      }
    })
  )
  await sendBatchBurns({
    user: userKp,
    feePayer,
    candidates: fallbackBurnCandidates,
    summary,
  })

  // Final dust burn pass: batch burn remaining <$1 balances so accounts become closeable (bot-style).
  try {
    const finalTokenAccounts = await getWalletTokenAccounts(userKp.publicKey)
    const remainingToBurn: BurnCandidate[] = finalTokenAccounts
      .filter((t) => {
        if (t.programId.toString() !== TOKEN_PROGRAM_ID_STR) return false
        if (t.isEmpty) return false
        if (!t.decimals || t.decimals === 0) return false
        const mint = t.mint.toString()
        const price = priceMap.get(mint)
        if (price == null) return false
        const uiAmount = amountRawToUi(t.amountRaw, t.decimals)
        const usdValue = uiAmount * price
        return Number.isFinite(usdValue) && usdValue < 1 && BigInt(t.amountRaw) > BigInt(0)
      })
      .map((t) => ({
        address: t.address,
        mint: t.mint,
        amountRaw: t.amountRaw,
        decimals: t.decimals,
        mintStr: t.mint.toString(),
      }))
    await sendBatchBurns({
      user: userKp,
      feePayer,
      candidates: remainingToBurn,
      summary,
    })
  } catch (e) {
    summary.errors.push(`Final dust burn pass failed: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  return summary
}

export async function cleanupAndExecuteClaimOnServer(params: {
  privateKeyBase58: string
  walletId: string
  userId: string
  publicKey: string
  slippageBps?: number
}): Promise<{ cleanup: CleanupSummary; claim: Awaited<ReturnType<typeof executeClaimOnServer>> }> {
  let cleanup: CleanupSummary = { attemptedSells: 0, sold: 0, burned: 0, skipped: 0, errors: [] }
  try {
    cleanup = await cleanupWalletTokens({
      userId: params.userId,
      publicKey: params.publicKey,
      privateKeyBase58: params.privateKeyBase58,
      slippageBps: params.slippageBps ?? 100,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown cleanup error'
    cleanup.errors.push(msg)
    console.error('[cleanupAndExecuteClaimOnServer] cleanupWalletTokens failed:', msg)
  }

  try {
    const scan = await getClaimableRentTotalsOnly(new PublicKey(params.publicKey))
    const tokenProgramEmpties = scan.accounts
      .filter((a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR)
      .map((a) => ({
        accountAddress: a.accountAddress,
        mintAddress: a.mintAddress,
        rentAmount: a.rentAmount,
        balance: a.balance,
        isDust: a.isDust,
        programIdStr: a.programIdStr,
      }))

    const claim = await executeClaimOnServer({
      privateKeyBase58: params.privateKeyBase58,
      walletId: params.walletId,
      userId: params.userId,
      claimableAccounts: tokenProgramEmpties,
      publicKey: params.publicKey,
    })

    return { cleanup, claim }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown claim error'
    return {
      cleanup,
      claim: { success: false, error: msg },
    }
  }
}

export async function cleanupAndCloseTokenAccountsOnServer(params: {
  privateKeyBase58: string
  userId: string
  publicKey: string
  slippageBps?: number
}): Promise<{ cleanup: CleanupSummary; close: Awaited<ReturnType<typeof closeEmptyTokenAccounts>>; referrerId?: string }> {
  let cleanup: CleanupSummary = { attemptedSells: 0, sold: 0, burned: 0, skipped: 0, errors: [] }
  try {
    cleanup = await cleanupWalletTokens({
      userId: params.userId,
      publicKey: params.publicKey,
      privateKeyBase58: params.privateKeyBase58,
      slippageBps: params.slippageBps ?? 100,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown cleanup error'
    cleanup.errors.push(msg)
    console.error('[cleanupAndCloseTokenAccountsOnServer] cleanupWalletTokens failed:', msg)
  }

  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(params.privateKeyBase58.trim()))
    const dbUser = await getUserById(params.userId)
    const receiverWallet = dbUser?.receiver_wallet?.trim()
    if (!receiverWallet) {
      return {
        cleanup,
        close: { success: false, signatures: [], errors: ['Receiver wallet not set'], succeededAccounts: [] },
      }
    }

    const referrer = dbUser?.telegram_id ? await getReferrerByReferee(dbUser.telegram_id) : null
    const commissionWallet = getCommissionWallet()
    const options =
      referrer != null || commissionWallet != null
        ? {
            referrerWallet: referrer?.receiverWallet != null ? new PublicKey(referrer.receiverWallet) : undefined,
            referralPercent: clampPct(referrer?.commissionPercentage ?? 0),
            commissionWallet: commissionWallet ?? undefined,
          }
        : undefined

    // Rescan current empty accounts
    const scan = await getClaimableRentTotalsOnly(new PublicKey(params.publicKey))
    const tokenProgramEmpties = scan.accounts.filter((a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR)

    const close = await closeEmptyTokenAccounts(
      keypair,
      tokenProgramEmpties,
      params.publicKey,
      new PublicKey(receiverWallet),
      options
    )

    return { cleanup, close, referrerId: referrer?.referrerId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown close error'
    return {
      cleanup,
      close: { success: false, signatures: [], errors: [msg], succeededAccounts: [] },
    }
  }
}

