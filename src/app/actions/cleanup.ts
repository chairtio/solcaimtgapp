'use server'

import { Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
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
const MAX_SWAPS_PER_TX = 3

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, p))
}

function amountRawToUi(amountRaw: string, decimals: number): number {
  const n = Number(amountRaw)
  if (!Number.isFinite(n)) return 0
  return n / Math.pow(10, decimals || 0)
}

async function fetchJupPrices(mints: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>()
  const ids = Array.from(new Set(mints.filter(Boolean)))
  if (ids.length === 0) return priceMap

  // Jupiter price endpoint (batch)
  const url = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids.join(','))}`
  const res = await fetch(url, { method: 'GET' })
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
  const res = await fetch(`https://quote-api.jup.ag/v6/quote?${qs.toString()}`)
  if (!res.ok) return null
  return await res.json().catch(() => null)
}

async function jupSwapInstructions(params: {
  quoteResponse: any
  userPublicKey: string
  payer: string
}): Promise<any | null> {
  const res = await fetch(`https://quote-api.jup.ag/v6/swap-instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      payer: params.payer,
      wrapAndUnwrapSol: true,
    }),
  })
  if (!res.ok) return null
  return await res.json().catch(() => null)
}

async function buildAndSendSwapTx(params: {
  user: Keypair
  feePayer: Keypair
  receiver: PublicKey
  quote: any
  swapIxs: any
}): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const lookupTableAddresses: string[] = Array.isArray(params.swapIxs?.addressLookupTableAddresses)
      ? params.swapIxs.addressLookupTableAddresses
      : []

    const luts = await Promise.all(
      lookupTableAddresses.map(async (addr) => {
        try {
          const res = await connection.getAddressLookupTable(new PublicKey(addr))
          return res.value
        } catch {
          return null
        }
      })
    )

    const toIxs = (arr: any[]) =>
      (Array.isArray(arr) ? arr : [])
        .map((ix) => {
          if (!ix?.programId || !ix?.accounts || !ix?.data) return null
          return {
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map((a: any) => ({
              pubkey: new PublicKey(a.pubkey),
              isSigner: !!a.isSigner,
              isWritable: !!a.isWritable,
            })),
            data: Buffer.from(ix.data, 'base64'),
          }
        })
        .filter(Boolean)

    const computeBudget = toIxs(params.swapIxs?.computeBudgetInstructions)
    const setup = toIxs(params.swapIxs?.setupInstructions)
    const swapIx = toIxs([params.swapIxs?.swapInstruction])
    const cleanup = toIxs(params.swapIxs?.cleanupInstruction ? [params.swapIxs.cleanupInstruction] : [])

    // Transfer SOL proceeds (minimum expected) to receiver.
    // Use otherAmountThreshold (min out) when present; else use outAmount.
    const minOut = BigInt(params.quote?.otherAmountThreshold ?? params.quote?.outAmount ?? '0')
    const transferIx =
      minOut > BigInt(0)
        ? [
            SystemProgram.transfer({
              fromPubkey: params.user.publicKey,
              toPubkey: params.receiver,
              lamports: Number(minOut),
            }),
          ]
        : []

    const { blockhash } = await connection.getLatestBlockhash()

    const message = new TransactionMessage({
      payerKey: params.feePayer.publicKey,
      recentBlockhash: blockhash,
      instructions: [...computeBudget, ...setup, ...swapIx, ...cleanup, ...transferIx] as any,
    }).compileToV0Message(luts.filter(Boolean) as any)

    const tx = new VersionedTransaction(message)
    tx.sign([params.feePayer, params.user])
    const sig = await connection.sendTransaction(tx, { maxRetries: 2 })
    return { ok: true, signature: sig }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Swap tx failed'
    return { ok: false, error: msg }
  }
}

async function buildAndSendMultiSwapTx(params: {
  user: Keypair
  feePayer: Keypair
  receiver: PublicKey
  swaps: Array<{ quote: any; swapIxs: any }>
}): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const toIxs = (arr: any[]) =>
      (Array.isArray(arr) ? arr : [])
        .map((ix) => {
          if (!ix?.programId || !ix?.accounts || !ix?.data) return null
          return {
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map((a: any) => ({
              pubkey: new PublicKey(a.pubkey),
              isSigner: !!a.isSigner,
              isWritable: !!a.isWritable,
            })),
            data: Buffer.from(ix.data, 'base64'),
          }
        })
        .filter(Boolean)

    const lookupTableAddressesSet = new Set<string>()
    for (const s of params.swaps) {
      const addrs: string[] = Array.isArray(s.swapIxs?.addressLookupTableAddresses)
        ? s.swapIxs.addressLookupTableAddresses
        : []
      for (const a of addrs) lookupTableAddressesSet.add(a)
    }
    const lookupTableAddresses = Array.from(lookupTableAddressesSet)

    const luts = await Promise.all(
      lookupTableAddresses.map(async (addr) => {
        try {
          const res = await connection.getAddressLookupTable(new PublicKey(addr))
          return res.value
        } catch {
          return null
        }
      })
    )

    const instructions: any[] = []

    for (const s of params.swaps) {
      const swapIxs = s.swapIxs

      const computeBudget = toIxs(swapIxs?.computeBudgetInstructions)
      const setup = toIxs(swapIxs?.setupInstructions)
      const swapIx = toIxs([swapIxs?.swapInstruction])
      const cleanup = toIxs(swapIxs?.cleanupInstruction ? [swapIxs.cleanupInstruction] : [])

      // Transfer SOL proceeds (minimum expected) to receiver.
      const minOut = BigInt(s.quote?.otherAmountThreshold ?? s.quote?.outAmount ?? '0')
      const transferIx =
        minOut > BigInt(0)
          ? [
              SystemProgram.transfer({
                fromPubkey: params.user.publicKey,
                toPubkey: params.receiver,
                lamports: Number(minOut),
              }),
            ]
          : []

      instructions.push(...computeBudget, ...setup, ...swapIx, ...cleanup, ...transferIx)
    }

    const { blockhash } = await connection.getLatestBlockhash()
    const message = new TransactionMessage({
      payerKey: params.feePayer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(luts.filter(Boolean) as any)

    const tx = new VersionedTransaction(message)
    tx.sign([params.feePayer, params.user])
    const sig = await connection.sendTransaction(tx, { maxRetries: 2 })
    return { ok: true, signature: sig }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Multi-swap tx failed'
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
  const tokenAccounts = await getWalletTokenAccounts(userKp.publicKey)
  const candidates = tokenAccounts.filter((t) => t.programId.toString() === TOKEN_PROGRAM_ID_STR && !t.isEmpty)

  // Batch prices
  const mintStrs = candidates.map((c) => c.mint.toString()).filter((m) => m !== SOL_MINT)
  const priceMap = await fetchJupPrices(mintStrs)

  const swapCandidates: Array<{
    mint: string
    acc: (typeof candidates)[number]
    quote: any
    swapIxs: any
    usdValue: number | null
  }> = []

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

    const quote = await jupQuote({
      inputMint: mint,
      outputMint: SOL_MINT,
      amountRaw: acc.amountRaw,
      slippageBps: params.slippageBps,
    })

    const bestRoute = quote?.data?.[0]
    if (!bestRoute) {
      // No liquidity/quote. Burn only if we can prove value < $1.
      if (usdValue != null && usdValue < 1) {
        try {
          const burnAmount = BigInt(acc.amountRaw)
          if (burnAmount > BigInt(0)) {
            const burnIx = createBurnCheckedInstruction(
              acc.address,
              acc.mint,
              userKp.publicKey,
              burnAmount,
              acc.decimals
            )
            const { blockhash } = await connection.getLatestBlockhash()
            const msg = new TransactionMessage({
              payerKey: feePayer.publicKey,
              recentBlockhash: blockhash,
              instructions: [burnIx],
            }).compileToV0Message()
            const tx = new VersionedTransaction(msg)
            tx.sign([feePayer, userKp])
            await connection.sendTransaction(tx, { maxRetries: 2 })
            summary.burned++
          } else summary.skipped++
        } catch (e) {
          summary.errors.push(`Burn failed for ${mint}: ${e instanceof Error ? e.message : 'unknown'}`)
        }
      } else {
        summary.skipped++
      }
      continue
    }

    const swapIxs = await jupSwapInstructions({
      quoteResponse: bestRoute,
      userPublicKey: userKp.publicKey.toString(),
      payer: feePayer.publicKey.toString(),
    })

    if (!swapIxs) {
      if (usdValue != null && usdValue < 1) {
        try {
          const burnAmount = BigInt(acc.amountRaw)
          if (burnAmount > BigInt(0)) {
            const burnIx = createBurnCheckedInstruction(
              acc.address,
              acc.mint,
              userKp.publicKey,
              burnAmount,
              acc.decimals
            )
            const { blockhash } = await connection.getLatestBlockhash()
            const msg = new TransactionMessage({
              payerKey: feePayer.publicKey,
              recentBlockhash: blockhash,
              instructions: [burnIx],
            }).compileToV0Message()
            const tx = new VersionedTransaction(msg)
            tx.sign([feePayer, userKp])
            await connection.sendTransaction(tx, { maxRetries: 2 })
            summary.burned++
          } else summary.skipped++
        } catch (e) {
          summary.errors.push(`Burn failed for ${mint}: ${e instanceof Error ? e.message : 'unknown'}`)
        }
      } else summary.skipped++
      continue
    }

    // Defer execution: we will attempt true multi-swap execution in chunks.
    swapCandidates.push({
      mint,
      acc,
      quote: bestRoute,
      swapIxs,
      usdValue,
    })
  }

  // Attempt multi-swap execution per chunk; fall back to per-token swaps on failure.
  for (let i = 0; i < swapCandidates.length; i += MAX_SWAPS_PER_TX) {
    const chunk = swapCandidates.slice(i, i + MAX_SWAPS_PER_TX)
    const multiRes = await buildAndSendMultiSwapTx({
      user: userKp,
      feePayer,
      receiver: receiverPk,
      swaps: chunk.map((c) => ({ quote: c.quote, swapIxs: c.swapIxs })),
    })

    if (multiRes.ok) {
      summary.sold += chunk.length
      continue
    }

    summary.errors.push(`Multi-swap tx failed: ${multiRes.error || 'unknown'}`)

    for (const c of chunk) {
      const swapRes = await buildAndSendSwapTx({
        user: userKp,
        feePayer,
        receiver: receiverPk,
        quote: c.quote,
        swapIxs: c.swapIxs,
      })

      if (swapRes.ok) {
        summary.sold++
        continue
      }

      // Swap failed; burn only if <$1
      if (c.usdValue != null && c.usdValue < 1) {
        try {
          const burnAmount = BigInt(c.acc.amountRaw)
          if (burnAmount > BigInt(0)) {
            const burnIx = createBurnCheckedInstruction(
              c.acc.address,
              c.acc.mint,
              userKp.publicKey,
              burnAmount,
              c.acc.decimals
            )
            const { blockhash } = await connection.getLatestBlockhash()
            const msg = new TransactionMessage({
              payerKey: feePayer.publicKey,
              recentBlockhash: blockhash,
              instructions: [burnIx],
            }).compileToV0Message()
            const tx = new VersionedTransaction(msg)
            tx.sign([feePayer, userKp])
            await connection.sendTransaction(tx, { maxRetries: 2 })
            summary.burned++
          } else summary.skipped++
        } catch (e) {
          summary.errors.push(`Burn failed for ${c.mint}: ${e instanceof Error ? e.message : 'unknown'}`)
        }
      } else {
        summary.skipped++
        summary.errors.push(`Sell failed for ${c.mint}: ${swapRes.error || 'unknown'}`)
      }
    }
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

