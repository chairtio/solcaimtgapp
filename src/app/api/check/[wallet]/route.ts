import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { connection } from '@/lib/solana'

const TIMEOUT_MS = 20000

function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * GET /api/check/:wallet?token=MINT&min_amount=N
 * Returns { isHolder: boolean } - whether wallet holds >= min_amount of token
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet: walletAddress } = await params
  const url = new URL(_req.url)
  const token = url.searchParams.get('token')
  const minAmount = parseInt(url.searchParams.get('min_amount') ?? '', 10)

  if (!walletAddress || !token || isNaN(minAmount)) {
    return NextResponse.json({ message: 'Missing required parameters.' }, { status: 400 })
  }

  if (!isValidWalletAddress(walletAddress)) {
    return NextResponse.json({ message: null }, { status: 400 })
  }

  try {
    const owner = new PublicKey(walletAddress)
    const specificMint = new PublicKey(token)
    const response = await Promise.race([
      connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)
      )
    ])

    for (const tokenAccount of response.value) {
      const account = tokenAccount.account
      const data = account.data as { parsed: { info: { mint: string; tokenAmount: { decimals: number; amount: string } } } }
      const mint = new PublicKey(data.parsed.info.mint)
      const decimals = data.parsed.info.tokenAmount.decimals
      const amount = parseFloat(data.parsed.info.tokenAmount.amount) / 10 ** decimals

      if (mint.equals(specificMint) && amount >= minAmount) {
        return NextResponse.json({ isHolder: true })
      }
    }

    return NextResponse.json({ isHolder: false })
  } catch (error) {
    console.error('Error in /api/check:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (msg.includes('abort') || msg.includes('timed out')) {
      return NextResponse.json({ message: 'Request timed out.' }, { status: 504 })
    }
    return NextResponse.json({ message: 'An error occurred.', error: msg }, { status: 500 })
  }
}
