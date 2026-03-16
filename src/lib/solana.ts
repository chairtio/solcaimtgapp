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
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createCloseAccountInstruction,
  createBurnInstruction,
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
  
  // We want to process ALL accounts, not just empty ones
  // Empty ones can be closed immediately
  // Non-empty ones need to be checked for value (if < $0.01, they are dust and can be burned)
  
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

  // Only return accounts that are empty OR classified as dust
  const claimableAccounts = accounts.filter(acc => acc.isDust)
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
 * Creates a transaction to burn dust tokens and close accounts.
 * Conservative mode (default): only empty Token Program accounts - matches working reference.
 * Set conservativeMode=false to also process Token-2022 and non-empty (burn+close).
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

  const empty = toProcess.filter(a => a.balance === 0)
  const nonEmpty = toProcess.filter(a => a.balance > 0)
  // Docs: one CloseAccount per tx - batching multiple can cause "owner does not match"
  const emptyBatches = chunkArray(empty, 1)
  const nonEmptyBatches = chunkArray(nonEmpty, 1)
  const allBatches = [...emptyBatches, ...nonEmptyBatches]

  for (const batch of allBatches) {
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

      // If it's not empty, we need to burn the tokens first (use live balance)
      if (liveBalance > 0) {
        transaction.add(
          createBurnInstruction(
            accountPubkey,
            mintPubkey,
            walletPublicKey,
            liveBalance,
            [],
            programId
          )
        )
      }

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
}

const COMPUTE_UNITS = 120000
const COMPUTE_PRICE = 50000

/**
 * Closes token accounts. Handles both empty accounts and dust (burn then close).
 * Processes one account per transaction to avoid "owner does not match" (0x4).
 * @param expectedOwner - Wallet address that owns the accounts. Must match keypair.publicKey.
 */
export async function closeEmptyTokenAccounts(
  keypair: Keypair,
  accountsToClose: ClaimableAccount[],
  expectedOwner?: string
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

  // Wallet needs SOL to pay for tx fees. "Attempt to debit... no prior credit" = 0 or very low balance.
  const MIN_LAMPORTS_FOR_FEES = 2_000_000 // ~0.002 SOL - need enough for multiple tx fees
  const solBalance = await connection.getBalance(keypair.publicKey)
  if (solBalance < MIN_LAMPORTS_FOR_FEES) {
    return {
      success: false,
      signatures: [],
      errors: [
        `Insufficient SOL for transaction fees. Your wallet has ${(solBalance / 1e9).toFixed(6)} SOL. ` +
        `You need at least ~0.002 SOL to pay for closing. Add a small amount of SOL to this wallet and try again.`
      ],
      succeededAccounts: []
    }
  }

  const signatures: string[] = []
  const errors: string[] = []
  const succeededAccounts: ClaimableAccount[] = []

  // Process: empty Token Program + Token-2022, and dust (balance>0, isDust) Token Program only
  const isTokenProgram = (a: ClaimableAccount) =>
    a.programIdStr === TOKEN_PROGRAM_ID.toString() || !a.programIdStr

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

    // Dust (balance > 0): only Token Program for now (burn+close)
    if (acc.balance > 0) {
      if (!acc.isDust || !isTokenProgram(acc)) continue
      if (programId.equals(TOKEN_2022_PROGRAM_ID)) continue

      try {
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
        const liveBalance = Number(accountInfo.amount)
        if (liveBalance === 0) {
          // Already empty, fall through to close-only path below (we'll reprocess as empty)
          // For simplicity, build close-only tx
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const tx = new Transaction({
          feePayer: keypair.publicKey,
          blockhash,
          lastValidBlockHeight
        })
        tx.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_PRICE })
        )
        if (liveBalance > 0) {
          tx.add(
            createBurnInstruction(
              accountPubkey,
              mintPubkey,
              keypair.publicKey,
              liveBalance,
              [],
              programId
            )
          )
        }
        tx.add(
          createCloseAccountInstruction(
            accountPubkey,
            keypair.publicKey,
            keypair.publicKey,
            [],
            programId
          )
        )
        const sig = await sendAndConfirmTransaction(
          connection,
          tx,
          [keypair],
          { commitment: 'confirmed', skipPreflight: true }
        )
        signatures.push(sig)
        succeededAccounts.push(acc)
    } catch (error) {
      const errDetail = error instanceof Error ? error.message : 'Unknown error'
      const debitHint = String(errDetail).toLowerCase().includes('attempt to debit') || String(errDetail).toLowerCase().includes('no record of a prior credit')
        ? ' This usually means your wallet has no SOL for fees. Add ~0.001 SOL to pay for transactions.'
        : ''
      errors.push(`Account ${i + 1} (${acc.accountAddress}): ${errDetail}${debitHint}`)
      console.error(`Failed to burn+close ${acc.accountAddress}:`, error)
      }
      continue
    }

    // Empty accounts: Token Program and Token-2022
    try {
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

      const sig = await closeAccountHelper(
        connection,
        keypair,
        accountPubkey,
        keypair.publicKey,
        keypair,
        [],
        { commitment: 'confirmed', skipPreflight: true },
        programId
      )
      signatures.push(sig)
      succeededAccounts.push(acc)
    } catch (error) {
      const errDetail = error instanceof Error ? error.message : 'Unknown error'
      let hint = ''
      if (String(errDetail).includes('owner does not match')) {
        try {
          const raw = await connection.getAccountInfo(accountPubkey, 'confirmed')
          if (raw?.data && raw.data.length >= 64) {
            const onChainOwner = new PublicKey(raw.data.subarray(32, 64)).toString()
            hint = ` On-chain owner: ${onChainOwner}. Your keypair: ${signerAddress}.`
          }
        } catch (_) {}
      }
      if (String(errDetail).toLowerCase().includes('attempt to debit') || String(errDetail).toLowerCase().includes('no record of a prior credit')) {
        hint = ' Your wallet needs SOL for fees. Add ~0.001 SOL and try again.'
      }
      errors.push(`Account ${i + 1} (${acc.accountAddress}): ${errDetail}${hint}`)
      console.error(`Failed to close ${acc.accountAddress}:`, error)
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
    succeededAccounts
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