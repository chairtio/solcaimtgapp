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

/**
 * Gets all token accounts for a wallet (both Token Program and Token-2022)
 */
export async function getWalletTokenAccounts(publicKey: PublicKey): Promise<TokenAccountInfo[]> {
  const accounts: TokenAccountInfo[] = []

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
        programId
      })

      for (const { pubkey } of tokenAccounts.value) {
        try {
          const accountInfo = await getAccount(connection, pubkey, 'confirmed', programId)
          const balance = Number(accountInfo.amount)
          const isEmpty = balance === 0

          accounts.push({
            address: pubkey,
            mint: accountInfo.mint,
            balance,
            rentAmount: RENT_EXEMPTION_LAMPORTS,
            isEmpty,
            programId
          })
        } catch (error) {
          console.error(`Error processing token account ${pubkey.toString()}:`, error)
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
  
  // We process all accounts for metadata; only empty ones (balance=0) are claimable. No burning.
  
  const accountsToProcess = tokenAccounts;
  
  // Fetch Jupiter token list for metadata enrichment
  let tokenMap = new Map<string, {name: string, logoURI: string}>()
  try {
    // Collect all unique mints
    const uniqueMints = Array.from(new Set(accountsToProcess.map(acc => acc.mint.toString())))
    
    // We have to query each token individually using the search endpoint
    await Promise.all(uniqueMints.map(async (mint) => {
      try {
        const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${mint}`, {
          headers: {
            'x-api-key': process.env.NEXT_PUBLIC_JUPITER_API_KEY || 'a83f2167-a6bb-473c-99fd-1a644392bd35'
          }
        })
        if (response.ok) {
          const tokens = await response.json()
          if (Array.isArray(tokens) && tokens.length > 0) {
            // Find the exact match by ID (mint) or fallback to first result
            const t = tokens.find((t: any) => t.id === mint) || tokens[0]
            tokenMap.set(mint, { name: t.symbol || t.name, logoURI: t.icon || t.logoURI })
          }
        }
      } catch (err) {
        console.error(`Failed to fetch metadata for ${mint}`, err)
      }
    }))
  } catch (e) {
    console.error('Failed to fetch token metadata from Jupiter', e)
  }

  // Check prices for non-empty accounts
  let priceMap = new Map<string, number>()
  const nonEmptyMints = Array.from(new Set(accountsToProcess.filter(a => !a.isEmpty).map(a => a.mint.toString())))
  
  if (nonEmptyMints.length > 0) {
    try {
      // Jupiter Price API v4 allows querying multiple tokens
      const ids = nonEmptyMints.join(',')
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${ids}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data && data.data) {
          Object.keys(data.data).forEach(mint => {
            priceMap.set(mint, data.data[mint].price)
          })
        }
      }
    } catch (e) {
      console.error('Failed to fetch prices from Jupiter', e)
    }
  }

  const accounts: ClaimableAccount[] = accountsToProcess.map(acc => {
    const mintStr = acc.mint.toString()
    const meta = tokenMap.get(mintStr)
    
    // If we don't have the token in the strict list, we can at least show a better fallback
    // than "Unknown Token" by using the first few chars of the mint address
    const fallbackName = `Token ${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`
    
    // Calculate USD value if not empty
    let usdValue = 0;
    let isDust = acc.isEmpty;
    
    if (!acc.isEmpty) {
      const price = priceMap.get(mintStr) || 0;
      // Assuming 6 decimals as a safe default if we don't have the exact decimals
      // In a production app, we'd need to fetch the exact decimals for each token
      const rawBalance = acc.balance;
      // For simplicity in this demo, if it has no known price, we consider it dust (scam token)
      // If it has a price, we check if total value is < $0.01
      if (price === 0) {
        isDust = true;
      } else {
        // Rough estimation: balance / 10^6 * price
        usdValue = (rawBalance / 1000000) * price;
        isDust = usdValue < 0.01;
      }
    }
    
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

  // Only return EMPTY accounts (balance=0). No burning - close empty only.
  const claimableAccounts = accounts.filter(acc => acc.balance === 0)
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
      const referrerAmount = referrerWallet ? userPayoutBeforeReferral * (referralPercent / 100) : 0
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