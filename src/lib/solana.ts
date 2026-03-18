import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram
} from '@solana/web3.js'
import {
  hasPlatformCommission,
  getCommissionWallet,
  hasReferralProgram,
  SOLCLAIM_RENT_PER_ACCOUNT,
  SOLCLAIM_COMMISSION_PER_ACCOUNT,
  SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL,
  SOLCLAIM_REFERRAL_PERCENT
} from './config'

export interface CloseEmptyTokenAccountsOptions {
  /** Referrer's receiver wallet - when set, referrer gets referralPercent of user payout */
  referrerWallet?: PublicKey
  /** Referral percent (0-100). Uses config default when not provided. */
  referralPercent?: number
  /** Commission wallet - required when platform commission > 0 */
  commissionWallet?: PublicKey
  /** Platform commission percent (0-100). Uses config when not provided. */
  commissionPercent?: number
}

import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createCloseAccountInstruction,
  closeAccount as closeAccountHelper
} from '@solana/spl-token'
import bs58 from 'bs58'

// Solana connection
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

// Rent exemption constants
export const RENT_EXEMPTION_LAMPORTS = 2039280 // ~0.002 SOL for token accounts

export interface TokenAccountInfo {
  address: PublicKey
  mint: PublicKey
  balance: number
  amountRaw: string
  decimals: number
  rentAmount: number
  isEmpty: boolean
  programId: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID
}

const TOKEN_2022_STR = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

export interface ClaimableAccount {
  accountAddress: string
  mintAddress: string
  rentAmount: number
  balance: number
  tokenName?: string
  tokenImage?: string
  usdValue?: number
  isDust?: boolean
  programId?: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID
  /** String fallback for programId ( survives React state when PublicKey ref is lost ) */
  programIdStr?: string
}

/**
 * Validates a Solana public key
 */
export function isValidPublicKey(publicKey: string): boolean {
  try {
    new PublicKey(publicKey)
    return true
  } catch {
    return false
  }
}

// Cache Jupiter token metadata to avoid repeated lookups in-session
const jupiterTokenMetaCache = new Map<string, { name: string; logoURI: string }>()

/**
 * Gets all token accounts for a wallet (both Token Program and Token-2022)
 */
export async function getWalletTokenAccounts(publicKey: PublicKey): Promise<TokenAccountInfo[]> {
  const accounts: TokenAccountInfo[] = []

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      // Fast path: a single RPC call for all token accounts (no per-account getAccount()).
      // Matches the bot approach and is dramatically faster on wallets with many accounts.
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId })

      for (const item of tokenAccounts.value) {
        try {
          const parsed = (item.account.data as any)?.parsed
          const info = parsed?.info
          const mintStr = info?.mint
          const amountStr = info?.tokenAmount?.amount
          const decimals = info?.tokenAmount?.decimals

          if (!mintStr || typeof mintStr !== 'string' || typeof amountStr !== 'string') continue
          const decimalsNum = typeof decimals === 'number' && Number.isFinite(decimals) ? decimals : 0

          const isEmpty = amountStr === '0'
          // Keep backward-compatible number type; only zero-ness matters for claimable checks.
          const balance = isEmpty ? 0 : Number(amountStr)

          accounts.push({
            address: item.pubkey,
            mint: new PublicKey(mintStr),
            balance,
            amountRaw: amountStr,
            decimals: decimalsNum,
            rentAmount: RENT_EXEMPTION_LAMPORTS,
            isEmpty,
            programId
          })
        } catch (error) {
          console.error(`Error processing parsed token account ${item.pubkey.toString()}:`, error)
        }
      }
    } catch (error) {
      console.error(`Error fetching token accounts for program ${programId.toString()}:`, error)
    }
  }

  return accounts
}

/**
 * Gets claimable rent amount for a wallet, including checking token values
 */
export async function getClaimableRent(publicKey: PublicKey): Promise<{
  totalRent: number
  accounts: ClaimableAccount[]
}> {
  const tokenAccounts = await getWalletTokenAccounts(publicKey)
  
  // Only empty accounts are claimable and shown; keep single-scan fast by processing empties only.
  const accountsToProcess = tokenAccounts.filter((a) => a.isEmpty)
  
  // Fetch Jupiter token list for metadata enrichment
  let tokenMap = new Map<string, {name: string, logoURI: string}>()
  try {
    // Collect all unique mints
    const uniqueMints = Array.from(new Set(accountsToProcess.map(acc => acc.mint.toString())))

    // Seed tokenMap from cache and only fetch missing mints
    const missingMints: string[] = []
    for (const mint of uniqueMints) {
      const cached = jupiterTokenMetaCache.get(mint)
      if (cached) tokenMap.set(mint, cached)
      else missingMints.push(mint)
    }

    if (missingMints.length === 0) {
      // fully satisfied from cache
    } else {
    const chunkSize = 100
    const chunks: string[][] = []
      for (let i = 0; i < missingMints.length; i += chunkSize) {
        chunks.push(missingMints.slice(i, i + chunkSize))
      }

      await Promise.all(chunks.map(async (mints) => {
        try {
          const query = encodeURIComponent(mints.join(','))
          const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${query}`, {
            headers: {
              'x-api-key': process.env.NEXT_PUBLIC_JUPITER_API_KEY || 'a83f2167-a6bb-473c-99fd-1a644392bd35'
            }
          })
          if (!response.ok) return
          const tokens = await response.json()
          if (!Array.isArray(tokens) || tokens.length === 0) return
          for (const t of tokens) {
            if (!t?.id) continue
            const id = String(t.id)
            const meta = { name: t.symbol || t.name, logoURI: t.icon || t.logoURI }
            tokenMap.set(id, meta)
            jupiterTokenMetaCache.set(id, meta)
          }
        } catch (err) {
          console.error('Failed to fetch token metadata batch from Jupiter', err)
        }
      }))
    }
  } catch (e) {
    console.error('Failed to fetch token metadata from Jupiter', e)
  }

  const accounts: ClaimableAccount[] = accountsToProcess.map(acc => {
    const mintStr = acc.mint.toString()
    const meta = tokenMap.get(mintStr)
    
    // If we don't have the token in the strict list, we can at least show a better fallback
    // than "Unknown Token" by using the first few chars of the mint address
    const fallbackName = `Token ${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`
    
    // Claimable accounts are empty by definition; USD/dust is not relevant here.
    const usdValue = 0
    const isDust = true
    
    return {
      accountAddress: acc.address.toString(),
      mintAddress: mintStr,
      rentAmount: acc.rentAmount,
      balance: acc.balance,
      tokenName: meta?.name || fallbackName,
      tokenImage: meta?.logoURI,
      usdValue,
      isDust,
      programId: acc.programId,
      programIdStr: acc.programId?.toString()
    }
  })

  const totalRent = accounts.reduce((sum, acc) => sum + acc.rentAmount, 0)

  return { totalRent, accounts }
}

/**
 * Gets claimable rent amount for a wallet WITHOUT any Jupiter enrichment.
 * Intended for batch scan where we only show totals (fastest path).
 */
export async function getClaimableRentTotalsOnly(publicKey: PublicKey): Promise<{
  totalRent: number
  accounts: ClaimableAccount[]
}> {
  const tokenAccounts = await getWalletTokenAccounts(publicKey)
  const claimableAccounts: ClaimableAccount[] = tokenAccounts
    .filter((acc) => acc.isEmpty)
    .map((acc) => ({
      accountAddress: acc.address.toString(),
      mintAddress: acc.mint.toString(),
      rentAmount: acc.rentAmount,
      balance: acc.balance,
      // Only used by claim flows; keep stable shape without extra lookups.
      programId: acc.programId,
      programIdStr: acc.programId?.toString(),
    }))

  const totalRent = claimableAccounts.reduce((sum, acc) => sum + acc.rentAmount, 0)
  return { totalRent, accounts: claimableAccounts }
}

/**
 * Resolve token program ID for an account. If not in ClaimableAccount, detect from chain.
 */
async function resolveTokenProgram(accountPubkey: PublicKey, acc: ClaimableAccount): Promise<typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID> {
  if (acc.programId) return acc.programId
  if (acc.programIdStr === TOKEN_2022_PROGRAM_ID.toString()) return TOKEN_2022_PROGRAM_ID
  if (acc.programIdStr === TOKEN_PROGRAM_ID.toString()) return TOKEN_PROGRAM_ID
  const info = await connection.getAccountInfo(accountPubkey)
  if (!info) throw new Error(`Account ${accountPubkey.toString()} not found`)
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID
  return TOKEN_PROGRAM_ID
}

export interface CloseAccountsResult {
  transactions: Transaction[]
  /** For each transaction, the account that was included (same length as transactions) */
  accountsPerTx: ClaimableAccount[][]
}

const COMPUTE_UNIT_LIMIT = 100000
const COMPUTE_UNIT_PRICE_MICROLAMPORTS = 50000

/**
 * Creates a transaction to close empty token accounts (balance=0).
 * Only empty accounts - no burning.
 */
export async function createCloseAccountsTransaction(
  walletPublicKey: PublicKey,
  accountsToClose: ClaimableAccount[],
  _batchSize?: number,
  conservativeMode: boolean = true
): Promise<CloseAccountsResult> {
  const transactions: Transaction[] = []
  const accountsPerTx: ClaimableAccount[][] = []

  // Conservative: only empty Token Program accounts (avoids Token-2022 / burn+close issues)
  const toProcess = conservativeMode
    ? accountsToClose.filter(a => a.balance === 0 && (a.programIdStr === TOKEN_PROGRAM_ID.toString() || !a.programIdStr))
    : accountsToClose

  // Only empty accounts - no burning
  const empty = toProcess.filter(a => a.balance === 0)
  const emptyBatches = chunkArray(empty, 1)

  for (const batch of emptyBatches) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const transaction = new Transaction({
      feePayer: walletPublicKey,
      blockhash,
      lastValidBlockHeight
    })
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS })
    )
    const accountsInThisTx: ClaimableAccount[] = []

    for (const acc of batch) {
      const accountPubkey = new PublicKey(acc.accountAddress)
      const mintPubkey = new PublicKey(acc.mintAddress)
      let programId: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID
      try {
        programId = await resolveTokenProgram(accountPubkey, acc)
      } catch (e) {
        console.warn(`Skipping ${acc.accountAddress}: could not resolve program`, e)
        continue
      }
      // Conservative: skip Token-2022 (can cause "owner does not match" / extension issues)
      if (conservativeMode && programId.equals(TOKEN_2022_PROGRAM_ID)) {
        console.warn(`Skipping ${acc.accountAddress}: Token-2022 disabled in conservative mode`)
        continue
      }

      // Verify owner via getAccount (reliable for both Token and Token-2022)
      let accountInfo: Awaited<ReturnType<typeof getAccount>>
      try {
        accountInfo = await getAccount(connection, accountPubkey, 'confirmed', programId)
      } catch (e) {
        console.warn(`Skipping ${acc.accountAddress}: could not load account`, e)
        continue
      }
      const onChainOwner = accountInfo.owner
      if (onChainOwner.toString() !== walletPublicKey.toString()) {
        console.warn(`Skipping ${acc.accountAddress}: owner ${onChainOwner.toString()} != wallet ${walletPublicKey.toString()}`)
        continue
      }
      const liveBalance = Number(accountInfo.amount)

      // Only close empty accounts - skip non-empty (no burning)
      if (liveBalance > 0) continue

      // Close: owner = signer (keypair). Docs: "Only the token account owner can execute"
      transaction.add(
        createCloseAccountInstruction(
          accountPubkey,
          walletPublicKey, // destination for rent (owner receives it)
          walletPublicKey, // authority/owner - MUST be signer (we verify onChainOwner matches above)
          [],
          programId
        )
      )
      accountsInThisTx.push(acc)
    }

    if (transaction.instructions.length > 0) {
      transactions.push(transaction)
      accountsPerTx.push(accountsInThisTx)
    }
  }

  return { transactions, accountsPerTx }
}

export interface CloseEmptyTokenAccountsResult {
  success: boolean
  signatures: string[]
  errors: string[]
  /** Accounts that were successfully closed (for partial success handling) */
  succeededAccounts: ClaimableAccount[]
  /** Total fee/commission amount (SOL) when platform commission taken */
  feeAmount?: number
  /** Total referrer amount (SOL) when referral payout made */
  referrerAmount?: number
}

/** Options for commission and referral splits. When omitted, uses config defaults. */
export interface CloseEmptyTokenAccountsOptions {
  referrerWallet?: PublicKey
  referralPercent?: number
  commissionWallet?: PublicKey
  commissionPercent?: number
}

const COMPUTE_UNITS = 120000
const COMPUTE_PRICE = 50000
const BATCH_SIZE_EMPTY = 5  // multiple close instructions per tx

/** Fee payer keypair from env - pays gas so user wallet can have 0 SOL */
function getFeePayerKeypair(): Keypair | null {
  const key = process.env.FEE_PAYER_PRIVATE_KEY
  if (!key?.trim()) return null
  try {
    return Keypair.fromSecretKey(bs58.decode(key.trim()))
  } catch {
    console.warn('FEE_PAYER_PRIVATE_KEY invalid, using user wallet for fees')
    return null
  }
}

/**
 * Closes token accounts. Batches multiple accounts per tx when possible.
 * Uses fee payer wallet (FEE_PAYER_PRIVATE_KEY) when set - user can have 0 SOL.
 * Rent is sent to receiverPublicKey (user's receiver wallet), not the keypair.
 * @param expectedOwner - Wallet address that owns the accounts. Must match keypair.publicKey.
 * @param receiverPublicKey - Where rent lamports are sent. User's receiver wallet from Settings.
 * @param options - Commission/referral splits. When omitted, 100% goes to user.
 */
export async function closeEmptyTokenAccounts(
  keypair: Keypair,
  accountsToClose: ClaimableAccount[],
  expectedOwner: string | undefined,
  receiverPublicKey: PublicKey,
  options?: CloseEmptyTokenAccountsOptions
): Promise<CloseEmptyTokenAccountsResult> {
  if (accountsToClose.length === 0) {
    return { success: true, signatures: [], errors: [], succeededAccounts: [] }
  }

  const signerAddress = keypair.publicKey.toString()
  if (expectedOwner && signerAddress !== expectedOwner) {
    return {
      success: false,
      signatures: [],
      errors: [`Keypair (${signerAddress}) does not match expected owner (${expectedOwner}). Wrong private key?`],
      succeededAccounts: []
    }
  }

  const feePayer = getFeePayerKeypair()
  const useFeePayer = !!feePayer

  // When no fee payer, user wallet must have SOL for fees
  if (!useFeePayer) {
    const MIN_LAMPORTS_FOR_FEES = 2_000_000
    const solBalance = await connection.getBalance(keypair.publicKey)
    if (solBalance < MIN_LAMPORTS_FOR_FEES) {
      return {
        success: false,
        signatures: [],
        errors: [
          `Insufficient SOL for fees. Your wallet has ${(solBalance / 1e9).toFixed(6)} SOL. ` +
          `Need ~0.002 SOL, or add FEE_PAYER_PRIVATE_KEY to enable gas sponsorship.`
        ],
        succeededAccounts: []
      }
    }
  }

  const signatures: string[] = []
  const errors: string[] = []
  const succeededAccounts: ClaimableAccount[] = []
  let totalFeeAmount = 0
  let totalReferrerAmount = 0
  const feePayerPubkey = useFeePayer ? feePayer!.publicKey : keypair.publicKey
  const signers = useFeePayer ? [feePayer!, keypair] : [keypair]

  // --- Phase 1: Collect valid empty accounts (batch into txs) ---
  const emptyAccounts: { acc: ClaimableAccount; programId: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID }[] = []
  for (let i = 0; i < accountsToClose.length; i++) {
    const acc = accountsToClose[i]
    const accountPubkey = new PublicKey(acc.accountAddress)
    const mintPubkey = new PublicKey(acc.mintAddress)
    let programId: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID
    try {
      programId = await resolveTokenProgram(accountPubkey, acc)
    } catch {
      errors.push(`Account ${i + 1} (${acc.accountAddress}): could not resolve token program`)
      continue
    }

    // Skip non-empty accounts - we only close empty token accounts (no burning)
    if (acc.balance > 0) continue

    // Empty accounts: collect for batched processing
    const rawInfo = await connection.getAccountInfo(accountPubkey, 'confirmed')
    if (!rawInfo?.data || rawInfo.data.length < 64) {
      errors.push(`Account ${i + 1} (${acc.accountAddress}): invalid account data`)
      continue
    }
    const rawOwner = new PublicKey(rawInfo.data.subarray(32, 64)).toString()
    if (rawOwner !== signerAddress) {
      errors.push(`Account ${i + 1}: owned by ${rawOwner}, your keypair: ${signerAddress}`)
      continue
    }

    const accountInfo = await getAccount(connection, accountPubkey, 'confirmed', programId)
    if (Number(accountInfo.amount) > 0) {
      errors.push(`Account ${i + 1} (${acc.accountAddress}): balance must be 0 before close`)
      continue
    }

    emptyAccounts.push({ acc, programId })
  }

  // Determine if we need commission/referral split (close to keypair + transfers)
  const referrerWallet = options?.referrerWallet ?? null
  const commissionWallet = options?.commissionWallet ?? getCommissionWallet()
  const referralPercent = options?.referralPercent ?? SOLCLAIM_REFERRAL_PERCENT
  const commissionPercent = options?.commissionPercent
  const needSplit = referrerWallet != null || (commissionWallet != null && (commissionPercent === undefined ? hasPlatformCommission : commissionPercent > 0))

  // --- Phase 2: Batch and send empty account closes ---
  const emptyBatches = chunkArray(emptyAccounts, BATCH_SIZE_EMPTY)
  for (const batch of emptyBatches) {
    try {
      const n = batch.length
      const totalRent = n * SOLCLAIM_RENT_PER_ACCOUNT
      const commissionAmount = commissionWallet && (commissionPercent === undefined ? hasPlatformCommission : commissionPercent > 0)
        ? n * (commissionPercent !== undefined ? SOLCLAIM_RENT_PER_ACCOUNT * (commissionPercent / 100) : SOLCLAIM_COMMISSION_PER_ACCOUNT)
        : 0
      const userPayoutBeforeReferral = totalRent - commissionAmount
      const referrerAmount = referrerWallet
        ? (commissionAmount > 0
          ? commissionAmount * (referralPercent / 100)
          : userPayoutBeforeReferral * (referralPercent / 100))
        : 0
      const userReceives = userPayoutBeforeReferral - referrerAmount

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      const tx = new Transaction({
        feePayer: feePayerPubkey,
        blockhash,
        lastValidBlockHeight
      })
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS * n }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_PRICE })
      )

      const closeDestination = needSplit ? keypair.publicKey : receiverPublicKey
      for (const { acc, programId } of batch) {
        const accountPubkey = new PublicKey(acc.accountAddress)
        tx.add(
          createCloseAccountInstruction(
            accountPubkey,
            closeDestination,
            keypair.publicKey,
            [],
            programId
          )
        )
      }

      if (needSplit) {
        const userLamports = Math.round(userReceives * LAMPORTS_PER_SOL)
        tx.add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: receiverPublicKey,
            lamports: userLamports
          })
        )
        if (referrerAmount > 0 && referrerWallet) {
          totalReferrerAmount += referrerAmount
          tx.add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: referrerWallet,
              lamports: Math.round(referrerAmount * LAMPORTS_PER_SOL)
            })
          )
        }
        if (commissionAmount > 0 && commissionWallet) {
          totalFeeAmount += commissionAmount
          tx.add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: commissionWallet,
              lamports: Math.round(commissionAmount * LAMPORTS_PER_SOL)
            })
          )
        }
      }

      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        signers,
        { commitment: 'confirmed', skipPreflight: true }
      )
      signatures.push(sig)
      for (const { acc } of batch) succeededAccounts.push(acc)
    } catch (error) {
      const errDetail = error instanceof Error ? error.message : 'Unknown error'
      const hint = String(errDetail).toLowerCase().includes('attempt to debit') || String(errDetail).toLowerCase().includes('no record of a prior credit')
        ? ' Fee payer may need more SOL.'
        : ''
      errors.push(`Batch of ${batch.length} empty accounts: ${errDetail}${hint}`)
      console.error('Batch close failed:', error)
    }
  }

  // If we had accounts to close but closed none, ensure we don't report success
  if (accountsToClose.length > 0 && succeededAccounts.length === 0 && errors.length === 0) {
    errors.push('No accounts could be closed. They may be Token-2022, or the RPC may be rate-limited.')
  }

  return {
    success: errors.length === 0,
    signatures,
    errors,
    succeededAccounts,
    ...(totalFeeAmount > 0 && { feeAmount: totalFeeAmount }),
    ...(totalReferrerAmount > 0 && { referrerAmount: totalReferrerAmount })
  }
}

/**
 * Gets SOL balance for a wallet
 */
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey)
    return balance / LAMPORTS_PER_SOL
  } catch (error) {
    console.error('Error fetching SOL balance:', error)
    return 0
  }
}

/**
 * Converts private key string to Keypair
 */
export function privateKeyToKeypair(privateKey: string): Keypair {
  try {
    const secretKey = bs58.decode(privateKey)
    return Keypair.fromSecretKey(secretKey)
  } catch (error) {
    throw new Error('Invalid private key format')
  }
}

/**
 * Utility function to chunk arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Gets minimum balance for rent exemption
 */
export async function getMinimumBalanceForRentExemption(dataSize: number = 165): Promise<number> {
  return await connection.getMinimumBalanceForRentExemption(dataSize)
}

/**
 * Estimates transaction fee for closing accounts
 */
export async function estimateCloseFee(accountCount: number): Promise<number> {
  // Rough estimate: ~5000 lamports per account close
  const baseFee = 5000 * accountCount
  // Add priority fee buffer
  const priorityFee = 10000
  return (baseFee + priorityFee) / LAMPORTS_PER_SOL
}