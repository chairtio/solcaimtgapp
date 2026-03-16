import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { connection } from '@/lib/solana'
import { SOLCLAIM_USER_PAYOUT_PER_ACCOUNT } from '@/lib/config'

const TIMEOUT_MS = 20000

const BLACKLIST = [
  'ZG98FUCjb8mJ824Gbs6RsgVmr1FhXb2oNiJHa2dwmPd',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  'GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL'
]

function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * GET /api/claim/:wallet
 * Returns { wallet, availableToClaim, burnTokensToClaim } - claim eligibility
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const walletAddress = (await params).wallet

  if (!walletAddress) {
    return NextResponse.json({ message: 'Missing wallet address.' }, { status: 400 })
  }

  if (!isValidWalletAddress(walletAddress)) {
    return NextResponse.json({ message: null }, { status: 400 })
  }

  if (BLACKLIST.includes(walletAddress)) {
    return NextResponse.json({ message: null }, { status: 400 })
  }

  try {
    const owner = new PublicKey(walletAddress)
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID
    })

    const tokenAccountsCount = response.value.length
    let zeroAmountCount = 0

    for (const tokenAccount of response.value) {
      const data = (tokenAccount.account.data as { parsed: { info: { tokenAmount: { amount: string; decimals: number } } } }).parsed
      const amount = parseFloat(data.info.tokenAmount.amount) / 10 ** data.info.tokenAmount.decimals
      if (amount === 0) zeroAmountCount++
    }

    const solToClaim = tokenAccountsCount * SOLCLAIM_USER_PAYOUT_PER_ACCOUNT
    const solAbleToClaim = zeroAmountCount * SOLCLAIM_USER_PAYOUT_PER_ACCOUNT

    return NextResponse.json({
      wallet: walletAddress,
      availableToClaim: solAbleToClaim.toFixed(4),
      burnTokensToClaim: solToClaim > solAbleToClaim ? solToClaim.toFixed(4) : null
    })
  } catch (error) {
    console.error('Error in /api/claim:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (msg.includes('abort')) {
      return NextResponse.json({ message: 'Request timed out.' }, { status: 504 })
    }
    return NextResponse.json({ message: 'An error occurred.', error: msg }, { status: 500 })
  }
}
