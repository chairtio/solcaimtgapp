'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
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
  Share2,
  CheckCircle,
  Copy,
  Target,
  Gift,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronDown,
  Key,
  Lock,
  Plus,
  Trash2,
  Shield,
  ShieldAlert,
  BarChart3,
  PlayCircle,
  Settings,
  X,
  Package,
  Sparkles
} from 'lucide-react'
import { getClaimableRent, isValidPublicKey } from '@/lib/solana'
import { PublicKey, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { useTelegram } from '@/hooks/useTelegram'
import { SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL } from '@/lib/config'
import { 
  getWallets, 
  getWalletByPublicKey,
  createWallet, 
  updateWallet,
  upsertTokenAccounts,
  createTransaction,
  createReferralPayout,
  getUserWalletsWithStats,
  saveWalletPrivateKey,
  deactivateWallet
} from '@/lib/database'
import { toast } from 'sonner'
import { closeTokenAccountsOnServer, executeClaimOnServer, sendClaimNotificationToGroup, scanWalletForBatchProjectionAction } from '@/app/actions/claim'
import { updateReceiverWallet } from '@/app/actions/user'
import { getTotalClaimedAction, getTotalClaimingUsersAction, getLeaderboardAction, getRecentClaimsAction, getRecentClaimsFreshAction, getUserStatsAction, getReferralStatsAction } from '@/app/actions/stats'
import { getTasksForUser, verifyAndCompleteTask } from '@/app/actions/tasks'
import { getMyReferralPercentAction } from '@/app/actions/referral'
import { cleanupAndExecuteClaimOnServer, cleanupAndCloseTokenAccountsOnServer } from '@/app/actions/cleanup'
import { AdminDashboard } from '@/components/AdminDashboard'

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
  programIdStr?: string
}

function TaskConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null

  const pieces = [
    { x: -150, y: -170, r: -280, delay: 0, color: 'bg-primary' },
    { x: -128, y: -132, r: -220, delay: 30, color: 'bg-foreground' },
    { x: -96, y: -188, r: -310, delay: 10, color: 'bg-secondary' },
    { x: -74, y: -118, r: -175, delay: 55, color: 'bg-muted-foreground' },
    { x: -48, y: -162, r: -245, delay: 18, color: 'bg-primary/90' },
    { x: -18, y: -204, r: -330, delay: 70, color: 'bg-foreground/90' },
    { x: 8, y: -144, r: 210, delay: 40, color: 'bg-secondary' },
    { x: 28, y: -190, r: 260, delay: 5, color: 'bg-primary' },
    { x: 52, y: -126, r: 155, delay: 95, color: 'bg-foreground' },
    { x: 78, y: -178, r: 290, delay: 25, color: 'bg-muted-foreground' },
    { x: 104, y: -138, r: 180, delay: 60, color: 'bg-primary/85' },
    { x: 132, y: -204, r: 340, delay: 45, color: 'bg-foreground/80' },
    { x: -170, y: -82, r: -150, delay: 110, color: 'bg-secondary/90' },
    { x: -118, y: -58, r: -100, delay: 145, color: 'bg-primary/80' },
    { x: -66, y: -72, r: -130, delay: 160, color: 'bg-foreground/90' },
    { x: -8, y: -46, r: -110, delay: 125, color: 'bg-muted-foreground' },
    { x: 44, y: -54, r: 115, delay: 150, color: 'bg-primary' },
    { x: 98, y: -62, r: 135, delay: 170, color: 'bg-secondary' },
    { x: 154, y: -50, r: 150, delay: 95, color: 'bg-foreground' },
    { x: -28, y: -236, r: -360, delay: 135, color: 'bg-primary/75' },
    { x: 22, y: -228, r: 320, delay: 175, color: 'bg-foreground/75' },
    { x: 72, y: -222, r: 285, delay: 120, color: 'bg-secondary/75' },
  ] as const

  return (
    <div className="pointer-events-none fixed inset-0 z-[190] overflow-hidden">
      <style jsx global>{`
        @keyframes task-confetti-pop {
          0% {
            transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.15) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate3d(var(--x), var(--y), 0) scale(1) rotate(var(--r));
            opacity: 0;
          }
        }
      `}</style>
      <div className="absolute left-1/2 top-[42%]">
        {pieces.map((piece, index) => (
          <span
            key={`${index}-${piece.delay}`}
            className={`absolute block rounded-sm ${piece.color}`}
            style={{
              width: index % 3 === 0 ? '12px' : index % 3 === 1 ? '9px' : '7px',
              height: index % 2 === 0 ? '20px' : '12px',
              '--x': `${piece.x}px`,
              '--y': `${piece.y}px`,
              '--r': `${piece.r}deg`,
              animation: `task-confetti-pop 1450ms cubic-bezier(0.16, 1, 0.3, 1) ${piece.delay}ms both`,
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}

export default function SolClaimApp() {
  const router = useRouter()
  const { user, isLoading, error: telegramError, refreshUser } = useTelegram()
  const [activeTab, setActiveTab] = useState('home')
  const [publicKey, setPublicKey] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [claimableRent, setClaimableRent] = useState(0)
  const [claimableRentWithCleanup, setClaimableRentWithCleanup] = useState(0)
  const [claimableAccounts, setClaimableAccounts] = useState<ClaimableAccount[]>([])
  const [cleanupEligibleAccounts, setCleanupEligibleAccounts] = useState<ClaimableAccount[]>([])
  const [cleanupEligibleTokenCount, setCleanupEligibleTokenCount] = useState(0)
  const [hasScannedOnce, setHasScannedOnce] = useState(false)
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [cleanupEnabled, setCleanupEnabled] = useState(false)

  const [myReferralPercent, setMyReferralPercent] = useState(0)
  const myReferralPercentRef = useRef(0)
  const TOKEN_PROGRAM_ID_STR = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

  useEffect(() => {
    // Load once per session/user; do not block scans on this.
    const tid = user?.telegram_id ? String(user.telegram_id) : ''
    if (!tid) {
      setMyReferralPercent(0)
      myReferralPercentRef.current = 0
      return
    }
    getMyReferralPercentAction(tid)
      .then((res) => {
        const pct = res?.referred ? Number(res.referralPercent ?? 0) : 0
        const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
        setMyReferralPercent(clamped)
        myReferralPercentRef.current = clamped
      })
      .catch(() => {
        setMyReferralPercent(0)
        myReferralPercentRef.current = 0
      })
  }, [user?.telegram_id])

  // Wallet Management State
  const [savedWallets, setSavedWallets] = useState<any[]>([])
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)
  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [isSubmittingKey, setIsSubmittingKey] = useState(false)
  const [currentWalletId, setCurrentWalletId] = useState<string | null>(null)

  // Batch Claiming State
  const [isBatchScanning, setIsBatchScanning] = useState(false)
  const [isBatchClaiming, setIsBatchClaiming] = useState(false)
  const [batchScanScannedIds, setBatchScanScannedIds] = useState<string[]>([])
  const [batchScanTotal, setBatchScanTotal] = useState(0)
  const [batchResults, setBatchResults] = useState<{
    totalRent: number,
    totalAccounts: number,
    totalRentWithCleanup: number,
    totalAccountsWithCleanup: number,
    walletsWithClaims: { walletId: string, publicKey: string, accounts: ClaimableAccount[], rent: number }[]
  } | null>(null)
  
  // Stats State
  const [userStats, setUserStats] = useState<any>(null)
  const [userStatsLoaded, setUserStatsLoaded] = useState(false)
  const [walletsLoaded, setWalletsLoaded] = useState(false)
  const [totalClaimed, setTotalClaimed] = useState<number | null>(null)
  const [totalClaimingUsers, setTotalClaimingUsers] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ rank: number; userId: string; totalSol: number; accountsClosed: number; displayName: string }[]>([])
  const [recentClaims, setRecentClaims] = useState<{ signature: string; sol_amount: number; created_at: string }[]>([])

  // Referral stats (Invite tab)
  const [referralStats, setReferralStats] = useState<{ total_ref_payout_amount: number; total_referred_users: number; num_referred_users_made_claims: number; commission_percentage: number } | null>(null)
  const [referralStatsLoaded, setReferralStatsLoaded] = useState(false)

  // Tasks tab
  const [tasksResult, setTasksResult] = useState<Awaited<ReturnType<typeof getTasksForUser>> | null>(null)
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [linkOpenedTaskIds, setLinkOpenedTaskIds] = useState<Set<string>>(new Set())
  const [taskInstructionOpenIds, setTaskInstructionOpenIds] = useState<Set<string>>(new Set())
  const [taskConfettiToken, setTaskConfettiToken] = useState(0)

  // Video modal
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const TELEGRAM_VIDEO_URL = 'https://t.me/solclaim/162'
  const PROMO_CLAIMABLE = 0.001 // Teaser shown to new users who've never claimed

  const getShareText = (telegramId: string) => `Claim FREE Sol With SolClaim!

💰 Free SOL for every trader
🆕 First SOL trader rewards bot
🔐 Secure and safe (approved by Privy)

👉 Start getting free SOL with SolClaim today.

t.me/solclaimxbot?start=${telegramId}`
  const openSharePopup = () => {
    if (!user?.telegram_id) return
    const shareUrl = `https://t.me/share/url?url=t.me/solclaimxbot?start=${user.telegram_id}&text=${encodeURIComponent(getShareText(user.telegram_id))}`
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }
  const UNLOCK_THRESHOLD = 0.001 // Shown as "unlocks when balance reaches this"

  // Only show promo AFTER userStats has loaded - prevents 0.001→0 flip on reload
  const hasClaimedBefore = userStats && (Number(userStats.total_sol_claimed) > 0 || Number(userStats.total_accounts_closed) > 0)
  const isPromoDisplay = userStatsLoaded && claimableRent === 0 && claimableAccounts.length === 0 && !hasClaimedBefore
  // While loading: show stable 0.0000 to avoid text flash. After load: show real value or promo
  const displayClaimableGross = !userStatsLoaded ? 0 : (hasClaimedBefore ? claimableRent : (isPromoDisplay ? PROMO_CLAIMABLE : claimableRent))
  const displayClaimableNet = displayClaimableGross
  const displayClaimableWithCleanup = !userStatsLoaded
    ? 0
    : (hasClaimedBefore ? claimableRentWithCleanup : (isPromoDisplay ? PROMO_CLAIMABLE : claimableRentWithCleanup))

  const displayClaimableActive = cleanupEnabled ? displayClaimableWithCleanup : displayClaimableNet
  const accountsToShow = cleanupEnabled ? [...claimableAccounts, ...cleanupEligibleAccounts] : claimableAccounts

  // Add Wallet modal - private key only, derive pubkey, scan & claim in popup
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false)
  const [addWalletKey, setAddWalletKey] = useState('')
  const [addWalletModalAccounts, setAddWalletModalAccounts] = useState<ClaimableAccount[]>([])
  const [addWalletModalRent, setAddWalletModalRent] = useState(0)
  const [addWalletModalRentWithCleanup, setAddWalletModalRentWithCleanup] = useState(0)
  const [addWalletModalExpanded, setAddWalletModalExpanded] = useState(false)
  const [addWalletModalScanning, setAddWalletModalScanning] = useState(false)
  const [addWalletModalClaiming, setAddWalletModalClaiming] = useState(false)
  const [addWalletDerivedAddress, setAddWalletDerivedAddress] = useState('')
  const [addWalletModalWalletId, setAddWalletModalWalletId] = useState<string | null>(null)

  // Add Key modal (for wallets without key)
  const [addKeyWalletId, setAddKeyWalletId] = useState<string | null>(null)
  const [addKeyWalletAddress, setAddKeyWalletAddress] = useState('')

  // Set Receiver modal (required before first claim)
  const [isSetReceiverModalOpen, setIsSetReceiverModalOpen] = useState(false)
  const [isSetReceiverModalClosing, setIsSetReceiverModalClosing] = useState(false)
  const [setReceiverInput, setSetReceiverInput] = useState('')
  const [setReceiverSaving, setSetReceiverSaving] = useState(false)
  const [pendingClaimAction, setPendingClaimAction] = useState<(() => void) | null>(null)

  // Modal closing states for smooth exit animations
  const [isVideoModalClosing, setIsVideoModalClosing] = useState(false)
  const [isAddWalletModalClosing, setIsAddWalletModalClosing] = useState(false)
  const [isKeyModalClosing, setIsKeyModalClosing] = useState(false)

  // Settings tab - receiver wallet
  const [settingsReceiverInput, setSettingsReceiverInput] = useState('')
  const [settingsReceiverSaving, setSettingsReceiverSaving] = useState(false)

  // Admin
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCheckLoaded, setAdminCheckLoaded] = useState(false)

  // Promo banner - 0% fees (dismissible, persisted)
  const [promoBannerDismissed, setPromoBannerDismissed] = useState(true)
  useEffect(() => {
    setPromoBannerDismissed(typeof localStorage !== 'undefined' && localStorage.getItem('solclaim_promo_banner_dismissed') === '1')
  }, [])
  const dismissPromoBanner = () => {
    setPromoBannerDismissed(true)
    if (typeof localStorage !== 'undefined') localStorage.setItem('solclaim_promo_banner_dismissed', '1')
  }

  useEffect(() => {
    if (!taskConfettiToken) return
    const timer = window.setTimeout(() => setTaskConfettiToken(0), 1750)
    return () => window.clearTimeout(timer)
  }, [taskConfettiToken])

  // Story-style onboarding (first visit only) - Tinder-style swipe
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingDragX, setOnboardingDragX] = useState(0)
  const [onboardingIsDragging, setOnboardingIsDragging] = useState(false)
  const onboardingSwipeRef = useRef<HTMLDivElement>(null)
  const onboardingTouchStartX = useRef(0)
  const onboardingTouchCurrentX = useRef(0)
  const onboardingDragXRef = useRef(0)
  const onboardingIsDraggingRef = useRef(false)
  useEffect(() => {
    const seen = typeof localStorage !== 'undefined' && localStorage.getItem('solclaim_onboarding_seen') === '1'
    setShowOnboarding(!seen)
  }, [])
  const finishOnboarding = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('solclaim_onboarding_seen', '1')
    setShowOnboarding(false)
  }
  const ONBOARDING_STEPS = [
    { title: 'You trade tokens on Solana', desc: 'Every token account pays rent to the blockchain. Swap, bridge, or hold—each account locks SOL.', icon: ArrowLeftRight, gradient: 'from-amber-500/30 via-orange-500/15 to-transparent', accent: 'text-amber-600 dark:text-amber-400', emoji: '🔄' },
    { title: 'When you sell, accounts go empty', desc: 'Leftover SOL stays locked in abandoned token accounts. Nobody tells you it’s reclaimable.', icon: Package, gradient: 'from-rose-500/20 via-pink-500/10 to-transparent', accent: 'text-rose-600 dark:text-rose-400' },
    { title: 'Claim your SOL back', desc: 'Recover 100% of your rent from the blockchain. No fees, no hassle—just add your wallet and tap.', icon: Sparkles, gradient: 'from-emerald-500/30 via-teal-500/15 to-transparent', accent: 'text-emerald-600 dark:text-emerald-400', emoji: '✨' },
    { title: 'Check your wallet', desc: 'Add your wallet address and see how much SOL you can reclaim. Most users find 0.01–0.1 SOL waiting.', icon: Wallet, gradient: 'from-primary/40 via-primary/15 to-transparent', accent: 'text-primary', emoji: '👛' },
  ]

  // Skip receiver check when we just saved in Set Receiver modal (React state not updated yet)
  const skipReceiverCheckRef = useRef(false)

  // Fetch saved wallets when tab changes to wallets/home or on load; userStats for home (promo) and stats
  useEffect(() => {
    if (user && (activeTab === 'wallets' || activeTab === 'home')) {
      loadSavedWallets()
    }
    if (user && (activeTab === 'stats' || activeTab === 'home')) {
      loadUserStats()
    }
    if (user && activeTab === 'home') {
      getRecentClaimsAction(user.id, 10).then(setRecentClaims).catch(() => setRecentClaims([]))
    }
    if (user && activeTab === 'stats') {
      getTotalClaimedAction().then(setTotalClaimed).catch(() => setTotalClaimed(null))
      getTotalClaimingUsersAction().then(setTotalClaimingUsers).catch(() => setTotalClaimingUsers(null))
      getLeaderboardAction(10).then(setLeaderboard).catch(() => setLeaderboard([]))
    }
    if (user?.telegram_id && activeTab === 'friends') {
      setReferralStatsLoaded(false)
      getReferralStatsAction(user.telegram_id).then((stats) => {
        setReferralStats(stats)
        setReferralStatsLoaded(true)
      }).catch(() => {
        setReferralStats(null)
        setReferralStatsLoaded(true)
      })
    }
  }, [user, activeTab])

  // Populate Settings receiver input when tab is active
  useEffect(() => {
    if (activeTab === 'settings' && user?.receiver_wallet) {
      setSettingsReceiverInput(user.receiver_wallet)
    }
  }, [activeTab, user?.receiver_wallet])

  // Clear claimable data when scanned address changes - prevents owner mismatch (claiming A's accounts with B's keypair)
  useEffect(() => {
    if (claimableAccounts.length > 0) {
      setClaimableAccounts([])
      setClaimableRent(0)
    }
  }, [publicKey])

  // Wallet check on visit disabled - user must manually enter/select wallet to scan
  const skipNextDebounceRef = useRef(false)

  // Debounced auto-scan when user types valid address (home + onboarding)
  const debounceScanRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!publicKey || !isValidPublicKey(publicKey) || publicKey.length < 32) return
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false
      return
    }
    if (debounceScanRef.current) clearTimeout(debounceScanRef.current)
    debounceScanRef.current = setTimeout(() => {
      debounceScanRef.current = null
      scanWallet({ silent: true })
    }, 600)
    return () => {
      if (debounceScanRef.current) clearTimeout(debounceScanRef.current)
    }
  }, [publicKey])

  // Populate Settings receiver input when switching to Settings tab
  useEffect(() => {
    if (user && activeTab === 'settings') {
      setSettingsReceiverInput(user.receiver_wallet || '')
    }
  }, [user, activeTab, user?.receiver_wallet])

  // Fetch tasks when switching to Tasks tab
  useEffect(() => {
    if (!user?.id || activeTab !== 'tasks') return
    setTasksLoaded(false)
    getTasksForUser(user.id)
      .then(setTasksResult)
      .catch((err) => {
        console.error('Failed to load tasks:', err)
        setTasksResult(null)
      })
      .finally(() => setTasksLoaded(true))
  }, [user?.id, activeTab])

  // Admin check: fetch /api/admin/check when user exists
  useEffect(() => {
    if (!user?.telegram_id) {
      setAdminCheckLoaded(true)
      setIsAdmin(false)
      return
    }
    const initData = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : ''
    if (!initData) {
      setAdminCheckLoaded(true)
      return
    }
    fetch('/api/admin/check', {
      headers: { 'X-Telegram-Init-Data': initData },
    })
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.isAdmin === true)
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setAdminCheckLoaded(true))
  }, [user?.telegram_id])

  // Show Telegram init errors as toast
  useEffect(() => {
    if (telegramError) toast.error(telegramError)
  }, [telegramError])

  const loadUserStats = async () => {
    if (!user) return
    setUserStatsLoaded(false)
    try {
      const stats = await getUserStatsAction(user.id)
      setUserStats(stats)
    } catch (err) {
      console.error('Failed to load stats:', err)
      setUserStats({ total_sol_claimed: 0, total_accounts_closed: 0 })
    } finally {
      setUserStatsLoaded(true)
    }
  }

  const loadLeaderboard = async () => {
    try {
      const list = await getLeaderboardAction(10)
      setLeaderboard(list)
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
    }
  }

  const loadSavedWallets = async () => {
    if (!user) return
    setWalletsLoaded(false)
    try {
      const wallets = await getUserWalletsWithStats(user.id)
      setSavedWallets(wallets)
      setBatchResults(null)
    } catch (err) {
      console.error('Failed to load wallets:', err)
    } finally {
      setWalletsLoaded(true)
    }
  }

  const handleDeleteWallet = async (walletId: string) => {
    try {
      await deactivateWallet(walletId)
      await loadSavedWallets()
      toast.success('Wallet removed successfully')
    } catch (err) {
      toast.error('Failed to remove wallet')
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
  }

  const handleAddWalletScan = async () => {
    if (!user || !addWalletKey.trim()) return
    setAddWalletModalScanning(true)
    try {
      const kp = Keypair.fromSecretKey(bs58.decode(addWalletKey.trim()))
      const derivedPubkey = kp.publicKey.toString()
      setAddWalletDerivedAddress(derivedPubkey)

      const existingByKey = await getWalletByPublicKey(user.id, derivedPubkey)
      if (existingByKey) {
        if (existingByKey.status === 'active') {
          toast.error('This wallet is already added')
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
      const tokenProgramAccounts = result.accounts.filter((a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR)
      const referralPercent = myReferralPercentRef.current || 0
      const netPerAccount = SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL * (1 - referralPercent / 100)
      const closeOnlyCount = result.summary?.closeOnlyTokenProgramCount ?? tokenProgramAccounts.length
      const cleanupEligibleCount = result.summary?.cleanupEligibleTokenProgramCount ?? 0
      const netEstimate = closeOnlyCount * netPerAccount
      const netEstimateWithCleanup = (closeOnlyCount + cleanupEligibleCount) * netPerAccount

      setAddWalletModalRent(netEstimate)
      setAddWalletModalRentWithCleanup(netEstimateWithCleanup)
      setAddWalletModalAccounts(tokenProgramAccounts)
      setAddWalletModalExpanded(tokenProgramAccounts.length > 0)
    } catch (e: any) {
      toast.error(e?.message?.includes('decode') ? 'Invalid private key format (Base58)' : (e?.message || 'Failed to scan'))
    } finally {
      setAddWalletModalScanning(false)
    }
  }

  const handleAddWalletClaim = async () => {
    if (!user || !addWalletKey.trim()) return
    const canCloseOnly = !cleanupEnabled && addWalletModalAccounts.length > 0
    const canCleanup = cleanupEnabled && addWalletModalRentWithCleanup > 0
    if (!canCloseOnly && !canCleanup) return

    if (!user.receiver_wallet?.trim() && !skipReceiverCheckRef.current) {
      setSetReceiverInput(user.receiver_wallet || '')
      setPendingClaimAction(() => handleAddWalletClaim)
      setIsSetReceiverModalOpen(true)
      return
    }
    skipReceiverCheckRef.current = false

    setAddWalletModalClaiming(true)
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

      let succeededAccounts: {
        accountAddress: string
        mintAddress: string
        balance: number
        rentAmount: number
      }[] = []
      let feeAmount = 0
      let referrerAmount = 0
      let referrerId: string | undefined
      let sig: string | undefined

      let cleanupSold = 0
      let cleanupBurned = 0
      let cleanupErrors: string[] | undefined

      if (cleanupEnabled) {
        const result = await cleanupAndCloseTokenAccountsOnServer({
          privateKeyBase58: addWalletKey.trim(),
          userId: user.id,
          publicKey: addWalletDerivedAddress,
          slippageBps: 100,
        })
        if (result.close.succeededAccounts.length === 0) throw new Error(result.close.errors?.[0] || 'Claim failed')

        succeededAccounts = result.close.succeededAccounts.map((acc) => ({
          accountAddress: acc.accountAddress,
          mintAddress: acc.mintAddress,
          balance: acc.balance,
          rentAmount: acc.rentAmount,
        }))
        feeAmount = result.close.feeAmount ?? 0
        referrerAmount = result.close.referrerAmount ?? 0
        referrerId = result.referrerId
        sig = result.close.signatures[0] || ('claim_' + Date.now())

        cleanupSold = result.cleanup.sold
        cleanupBurned = result.cleanup.burned
        cleanupErrors = result.cleanup.errors
      } else {
        const claimableForAction = addWalletModalAccounts.map((a) => ({
          accountAddress: a.accountAddress,
          mintAddress: a.mintAddress,
          rentAmount: a.rentAmount,
          balance: a.balance,
          isDust: a.isDust,
          programIdStr: a.programIdStr,
        }))

        const result = await closeTokenAccountsOnServer({
          privateKeyBase58: addWalletKey.trim(),
          userId: user.id,
          claimableAccounts: claimableForAction,
          publicKey: addWalletDerivedAddress,
        })
        if (result.succeededAccounts.length === 0) throw new Error(result.error || 'Claim failed')

        succeededAccounts = result.succeededAccounts.map((acc) => ({
          accountAddress: acc.accountAddress,
          mintAddress: acc.mintAddress,
          balance: acc.balance,
          rentAmount: acc.rentAmount,
        }))
        feeAmount = result.feeAmount ?? 0
        referrerAmount = result.referrerAmount ?? 0
        referrerId = result.referrerId
        sig = result.signatures?.[0] || ('claim_' + Date.now())
      }

      const dbAccounts = succeededAccounts.map((acc) => ({
        wallet_id: walletId,
        account_address: acc.accountAddress,
        mint_address: acc.mintAddress,
        balance: acc.balance,
        rent_amount: acc.rentAmount,
        is_empty: true,
        last_scanned: new Date().toISOString()
      }))
      await upsertTokenAccounts(dbAccounts)

      const succeededRent = succeededAccounts.reduce((s, a) => s + a.rentAmount, 0) / 1e9
      const netAmount = succeededRent - feeAmount - referrerAmount

      const tx = await createTransaction({
        wallet_id: walletId,
        signature: sig || ('claim_' + Date.now()),
        type: 'batch_claim',
        status: 'confirmed',
        sol_amount: netAmount,
        accounts_closed: succeededAccounts.length,
        fee_amount: feeAmount
      })

      if (referrerAmount > 0 && referrerId) {
        await createReferralPayout({
          referrer_id: referrerId,
          amount: referrerAmount,
          transaction_id: tx.id
        })
      }

      sendClaimNotificationToGroup({ userId: user.id, netAmount, walletCount: 1 }).catch(() => {})
      await loadUserStats()

      if (cleanupEnabled) {
        if (cleanupSold > 0 || cleanupBurned > 0) {
          toast.success(`Cleanup: sold ${cleanupSold}, burned ${cleanupBurned}`, { duration: 3500 })
        }
        if (cleanupErrors?.length) {
          toast.error(`Cleanup errors: ${cleanupErrors[0]}`, { duration: 4500 })
        }
      }

      setIsAddWalletModalOpen(false)
      setAddWalletKey('')
      setAddWalletModalAccounts([])
      setAddWalletModalRent(0)
      setAddWalletDerivedAddress('')
      await loadSavedWallets()
      if (user) getRecentClaimsFreshAction(user.id, 10).then(setRecentClaims).catch(() => {})
      toast.success(`Claimed ${netAmount.toFixed(4)} SOL`, {
        action: { label: 'Share with friends', onClick: openSharePopup },
        cancel: sig ? { label: 'View on Solscan', onClick: () => window.open(`https://solscan.io/tx/${sig}`) } : undefined
      })
    } catch (e: any) {
      toast.error(e?.message || 'Claim failed')
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
    toast.success('Wallet added. Use Scan All to check claimable.')
  }

  const closeSetReceiverModal = () => {
    if (setReceiverSaving) return
    setIsSetReceiverModalClosing(true)
  }
  const finishSetReceiverClose = () => {
    setIsSetReceiverModalClosing(false)
    setIsSetReceiverModalOpen(false)
    setSetReceiverInput('')
    setPendingClaimAction(null)
  }

  const closeVideoModal = () => setIsVideoModalClosing(true)
  const finishVideoClose = () => {
    setIsVideoModalClosing(false)
    setIsVideoModalOpen(false)
  }

  const closeAddWalletModal = () => {
    if (addWalletModalClaiming) return
    setIsAddWalletModalClosing(true)
  }
  const finishAddWalletClose = () => {
    setIsAddWalletModalClosing(false)
    setIsAddWalletModalOpen(false)
    setAddWalletKey('')
    setAddWalletModalAccounts([])
    setAddWalletModalRent(0)
    setAddWalletModalExpanded(false)
    setAddWalletDerivedAddress('')
    setAddWalletModalWalletId(null)
  }

  const openAddKeyModal = (wallet: { id: string; public_key: string }) => {
    setAddKeyWalletId(wallet.id)
    setAddKeyWalletAddress(wallet.public_key)
    setPrivateKeyInput('')
    setIsKeyModalOpen(true)
  }

  const closeKeyModal = () => setIsKeyModalClosing(true)
  const finishKeyClose = () => {
    setIsKeyModalClosing(false)
    setIsKeyModalOpen(false)
    setPrivateKeyInput('')
    setAddKeyWalletId(null)
    setAddKeyWalletAddress('')
  }

  const handleAddKeyOnly = async () => {
    if (!addKeyWalletId || !privateKeyInput) return

    setIsSubmittingKey(true)

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
      toast.success('Private key saved. You can now use Scan All.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save key')
    } finally {
      setIsSubmittingKey(false)
    }
  }

  const scanAllWallets = async () => {
    if (!savedWallets.length) {
      toast.error('No wallets to scan. Add a wallet first.')
      return
    }

    // Scan uses public key only – keys needed only for claiming
    const walletsToScan = savedWallets
    if (walletsToScan.length === 0) return
    
    setIsBatchScanning(true)
    setBatchScanScannedIds([])
    setBatchScanTotal(walletsToScan.length)
    
    try {
      let totalRent = 0
      let totalAccounts = 0
      let totalRentWithCleanup = 0
      let totalAccountsWithCleanup = 0
      const walletsWithClaims = []

      for (const wallet of walletsToScan) {
        const result = await scanWalletForBatchProjectionAction(wallet.public_key)
        setBatchScanScannedIds((prev) => [...prev, wallet.id])

        const closeOnlyCount = result.closeOnlyCount ?? 0
        const cleanupEligibleCount = result.cleanupEligibleCount ?? 0

        const referralPercent = myReferralPercentRef.current || 0
        const netPerAccount = SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL * (1 - referralPercent / 100)

        const rentInSolCloseOnly = closeOnlyCount * netPerAccount
        const rentInSolWithCleanup = (closeOnlyCount + cleanupEligibleCount) * netPerAccount

        totalRent += rentInSolCloseOnly
        totalAccounts += closeOnlyCount
        totalRentWithCleanup += rentInSolWithCleanup
        totalAccountsWithCleanup += closeOnlyCount + cleanupEligibleCount

        // Include wallet if it has close-only empties OR any cleanup-eligible non-empty token accounts.
        if (closeOnlyCount > 0 || cleanupEligibleCount > 0) {
          const tokenProgramAccounts = result.emptyAccounts.filter((a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR)
          walletsWithClaims.push({
            walletId: wallet.id,
            publicKey: wallet.public_key,
            accounts: tokenProgramAccounts,
            rent: rentInSolCloseOnly
          })
        }
      }

      setBatchResults({
        totalRent,
        totalAccounts,
        totalRentWithCleanup,
        totalAccountsWithCleanup,
        walletsWithClaims
      })

      if (totalAccounts === 0) {
        toast.success('No claimable accounts found across your saved wallets.')
      } else {
        toast.success(`Found ${totalAccounts} accounts worth ${totalRent.toFixed(4)} SOL across ${walletsWithClaims.length} wallets!`)
      }
    } catch (err: any) {
      console.error('Error scanning all wallets:', err)
      toast.error('Failed to scan all wallets. Please try again.')
    } finally {
      setIsBatchScanning(false)
    }
  }

  const claimAllWallets = async () => {
    if (!batchResults || batchResults.walletsWithClaims.length === 0 || !user) return

    if (!user.receiver_wallet?.trim() && !skipReceiverCheckRef.current) {
      setSetReceiverInput(user.receiver_wallet || '')
      setPendingClaimAction(() => claimAllWallets)
      setIsSetReceiverModalOpen(true)
      return
    }
    skipReceiverCheckRef.current = false

    setIsBatchClaiming(true)
    
    let successfulClaims = 0
    let failedClaims = 0
    let totalClaimedSol = 0
    let totalAccountsClosed = 0

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

          if (cleanupEnabled) {
            const result = await cleanupAndCloseTokenAccountsOnServer({
              privateKeyBase58: wallet.encrypted_private_key,
              userId: user.id,
              publicKey: claimData.publicKey,
              slippageBps: 100,
            })

            const succeededAccounts = result.close.succeededAccounts ?? []
            if (succeededAccounts.length > 0) {
              const succeededRent = succeededAccounts.reduce((s, a) => s + a.rentAmount, 0) / 1e9
              const feeAmount = result.close.feeAmount ?? 0
              const referrerAmount = result.close.referrerAmount ?? 0
              const netAmount = succeededRent - feeAmount - referrerAmount
              const sig = result.close.signatures[0] || ('batch_claim_' + Date.now())

              const dbAccounts = succeededAccounts.map((acc) => ({
                wallet_id: wallet.id,
                account_address: acc.accountAddress,
                mint_address: acc.mintAddress,
                balance: acc.balance,
                rent_amount: acc.rentAmount,
                is_empty: true,
                last_scanned: new Date().toISOString()
              }))

              await upsertTokenAccounts(dbAccounts)

              const tx = await createTransaction({
                wallet_id: wallet.id,
                signature: sig,
                type: 'batch_claim',
                status: 'confirmed',
                sol_amount: netAmount,
                accounts_closed: succeededAccounts.length,
                fee_amount: feeAmount
              })

              if (referrerAmount > 0 && result.referrerId) {
                await createReferralPayout({
                  referrer_id: result.referrerId,
                  amount: referrerAmount,
                  transaction_id: tx.id
                })
              }

              successfulClaims++
              totalClaimedSol += netAmount
              totalAccountsClosed += succeededAccounts.length
              if (result.cleanup.sold > 0 || result.cleanup.burned > 0) {
                toast.success(`Cleanup ${claimData.publicKey.slice(0, 4)}…: sold ${result.cleanup.sold}, burned ${result.cleanup.burned}`, { duration: 3500 })
              }

              if (succeededAccounts.length < (claimData.accounts?.length ?? 0)) {
                console.warn(`Partial success: closed ${succeededAccounts.length}/${claimData.accounts.length} accounts for ${claimData.publicKey}`)
              }
            } else {
              failedClaims++
            }
          } else {
            if (!claimData.accounts || claimData.accounts.length === 0) continue

            const claimableForAction = claimData.accounts.map((a) => ({
              accountAddress: a.accountAddress,
              mintAddress: a.mintAddress,
              rentAmount: a.rentAmount,
              balance: a.balance,
              isDust: a.isDust,
              programIdStr: a.programIdStr
            }))

            const result = await closeTokenAccountsOnServer({
              privateKeyBase58: wallet.encrypted_private_key,
              userId: user.id,
              claimableAccounts: claimableForAction,
              publicKey: claimData.publicKey,
            })

            if (!result.success) {
              failedClaims++
              continue
            }

            const succeededAccounts = result.succeededAccounts ?? []
            if (succeededAccounts.length > 0) {
              const succeededRent = succeededAccounts.reduce((s, a) => s + a.rentAmount, 0) / 1e9
              const feeAmount = result.feeAmount ?? 0
              const referrerAmount = result.referrerAmount ?? 0
              const netAmount = succeededRent - feeAmount - referrerAmount
              const sig = result.signatures?.[0] || ('batch_claim_' + Date.now())

              const dbAccounts = succeededAccounts.map((acc) => ({
                wallet_id: wallet.id,
                account_address: acc.accountAddress,
                mint_address: acc.mintAddress,
                balance: acc.balance,
                rent_amount: acc.rentAmount,
                is_empty: true,
                last_scanned: new Date().toISOString()
              }))

              await upsertTokenAccounts(dbAccounts)

              const tx = await createTransaction({
                wallet_id: wallet.id,
                signature: sig,
                type: 'batch_claim',
                status: 'confirmed',
                sol_amount: netAmount,
                accounts_closed: succeededAccounts.length,
                fee_amount: feeAmount
              })

              if (referrerAmount > 0 && result.referrerId) {
                await createReferralPayout({
                  referrer_id: result.referrerId,
                  amount: referrerAmount,
                  transaction_id: tx.id
                })
              }

              successfulClaims++
              totalClaimedSol += netAmount
              totalAccountsClosed += succeededAccounts.length

              if (succeededAccounts.length < claimData.accounts.length) {
                console.warn(`Partial success: closed ${succeededAccounts.length}/${claimData.accounts.length} accounts for ${claimData.publicKey}`)
              }
            } else {
              failedClaims++
            }
          }
        } catch (e) {
          console.error(`Failed to claim for wallet ${claimData.publicKey}:`, e)
          failedClaims++
        }
      }

      if (successfulClaims > 0) {
        await loadUserStats()
        sendClaimNotificationToGroup({ userId: user.id, netAmount: totalClaimedSol, walletCount: successfulClaims }).catch(() => {})
        toast.success(`Successfully claimed ${totalClaimedSol.toFixed(4)} SOL from ${successfulClaims} wallets!`, {
          action: { label: 'Share with friends', onClick: openSharePopup }
        })
        setBatchResults(null)
        await loadSavedWallets()
        if (user) getRecentClaimsFreshAction(user.id, 10).then(setRecentClaims).catch(() => {})
      } else {
        toast.error(`Failed to claim from any wallets. (${failedClaims} failed)`)
      }

    } catch (err: any) {
      console.error('Error in batch claim:', err)
      toast.error('A critical error occurred during batch claiming.')
    } finally {
      setIsBatchClaiming(false)
    }
  }

  const scanWallet = async (opts?: { silent?: boolean }) => {
    if (!isValidPublicKey(publicKey)) {
      if (!opts?.silent) toast.error('Invalid Solana public key')
      return
    }

    setIsScanning(true)

    try {
      const result = await getClaimableRent(new PublicKey(publicKey), { includeCleanupEligible: cleanupEnabled })
      // Conservative: only Token Program accounts are actually closed in claims.
      const tokenProgramAccounts = result.accounts.filter((a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR)
      setClaimableAccounts(tokenProgramAccounts)

      const cleanupEligibleTokenProgramAccounts = (result.cleanupEligibleAccounts || []).filter(
        (a) => !a.programIdStr || a.programIdStr === TOKEN_PROGRAM_ID_STR
      )
      setCleanupEligibleAccounts(cleanupEligibleTokenProgramAccounts)

      const referralPercent = myReferralPercentRef.current || 0
      const netPerAccount = SOLCLAIM_USER_PAYOUT_BEFORE_REFERRAL * (1 - referralPercent / 100)
      const closeOnlyCount = result.summary?.closeOnlyTokenProgramCount ?? tokenProgramAccounts.length
      const cleanupEligibleCount = result.summary?.cleanupEligibleTokenProgramCount ?? 0
      const netEstimate = closeOnlyCount * netPerAccount
      const netEstimateWithCleanup = (closeOnlyCount + cleanupEligibleCount) * netPerAccount

      setClaimableRent(netEstimate)
      setClaimableRentWithCleanup(netEstimateWithCleanup)
      setCleanupEligibleTokenCount(cleanupEligibleCount)
      setHasScannedOnce(true)
      if (!opts?.silent) toast.success(`Found ${tokenProgramAccounts.length + cleanupEligibleTokenProgramAccounts.length} claimable accounts`)
    } catch (err) {
      if (!opts?.silent) toast.error('Failed to scan wallet. Please check the public key.')
      console.error(err)
    } finally {
      setIsScanning(false)
    }
  }

  // If user flips Ultra cleanup after scanning, refresh preview so the accordion count/list stays correct.
  useEffect(() => {
    if (!hasScannedOnce) return
    if (isScanning) return
    if (!publicKey || !isValidPublicKey(publicKey)) return

    scanWallet({ silent: true }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupEnabled])

  const claimRent = async () => {
    if (!user) {
      toast.error('You must be logged in via Telegram to claim rent.')
      return
    }

    const hasToClaim = cleanupEnabled ? claimableRentWithCleanup > 0 : claimableAccounts.length > 0
    if (!hasToClaim) {
      toast.error('No accounts to claim.')
      return
    }

    if (!user.receiver_wallet?.trim() && !skipReceiverCheckRef.current) {
      setSetReceiverInput('')
      setPendingClaimAction(() => claimRent)
      setIsSetReceiverModalOpen(true)
      return
    }
    skipReceiverCheckRef.current = false

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
      toast.error(err.message || 'Failed to process claim. Please try again.')
    }
  }

  const handleSavePrivateKey = async () => {
    if (!privateKeyInput || !currentWalletId) return
    
    setIsSubmittingKey(true)
    
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
      toast.error(err.message || 'Failed to save private key')
      setIsSubmittingKey(false)
    }
  }

  const executeClaim = async (walletId: string, privateKeyString?: string) => {
    try {
      if (!user) throw new Error('User not found')

      // If we have a private key (either passed directly or we need to fetch it)
      let keypair: Keypair | null = null;
      let privateKeyToUse: string | undefined = privateKeyString;
      
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
          privateKeyToUse = wallet.encrypted_private_key
          keypair = Keypair.fromSecretKey(bs58.decode(wallet.encrypted_private_key));
        } catch (e) {
          throw new Error('Stored private key is invalid');
        }
      }

      if (!privateKeyToUse) throw new Error('Private key not found. Please add it first.')

      if (cleanupEnabled) {
        // Cleanup (sell via Jupiter; burn <$1 only if sell fails), then rescan + claim on server.
        const result = await cleanupAndExecuteClaimOnServer({
          privateKeyBase58: privateKeyToUse,
          walletId,
          userId: user.id,
          publicKey,
          slippageBps: 100,
        })

        if (!result.claim.success) {
          throw new Error(result.claim.error)
        }

        setIsSubmittingKey(false)
        const sig = result.claim.signatures?.[0]

        if (result.cleanup.sold > 0 || result.cleanup.burned > 0) {
          toast.success(`Cleanup: sold ${result.cleanup.sold}, burned ${result.cleanup.burned}`, { duration: 3500 })
        }
        if (result.cleanup.errors?.length) {
          toast.error(`Cleanup errors: ${result.cleanup.errors[0]}`, { duration: 4500 })
          // When cleanup had errors and nothing was claimed, do not show success toast
          if (result.claim.netAmount === 0 && result.claim.closedCount === 0) {
            await loadUserStats()
            if (user) getRecentClaimsFreshAction(user.id, 10).then(setRecentClaims).catch(() => {})
            return true
          }
        }

        toast.success(`Claimed ${result.claim.netAmount!.toFixed(4)} SOL`, {
          action: { label: 'Share with friends', onClick: openSharePopup },
          cancel: sig ? { label: 'View on Solscan', onClick: () => window.open(`https://solscan.io/tx/${sig}`) } : undefined
        })
      } else {
        const result = await executeClaimOnServer({
          privateKeyBase58: privateKeyToUse,
          walletId,
          userId: user.id,
          claimableAccounts: claimableAccounts.map((a) => ({
            accountAddress: a.accountAddress,
            mintAddress: a.mintAddress,
            rentAmount: a.rentAmount,
            balance: a.balance,
            isDust: a.isDust,
            programIdStr: a.programIdStr
          })),
          publicKey
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        setIsSubmittingKey(false)
        const sig = result.signatures?.[0]
        toast.success(`Claimed ${result.netAmount!.toFixed(4)} SOL`, {
          action: { label: 'Share with friends', onClick: openSharePopup },
          cancel: sig ? { label: 'View on Solscan', onClick: () => window.open(`https://solscan.io/tx/${sig}`) } : undefined
        })
      }

      await loadUserStats()
      if (user) getRecentClaimsFreshAction(user.id, 10).then(setRecentClaims).catch(() => {})

      // Clear claimable immediately – accounts are now claimed
      setClaimableAccounts([])
      setClaimableRent(0)

      return true;
    } catch (err: any) {
      console.error('Error executing claim:', err)
      toast.error(err.message || 'Failed to execute claim.')
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

  // Populate Settings receiver input when switching to Settings tab
  useEffect(() => {
    if (activeTab === 'settings' && user?.receiver_wallet) {
      setSettingsReceiverInput(user.receiver_wallet)
    }
  }, [activeTab, user?.receiver_wallet])

  const handleSaveReceiverWallet = async () => {
    if (!user?.telegram_id || !settingsReceiverInput.trim()) return
    if (!isValidPublicKey(settingsReceiverInput.trim())) {
      toast.error('Invalid Solana address')
      return
    }
    setSettingsReceiverSaving(true)
    try {
      const result = await updateReceiverWallet(user.telegram_id, settingsReceiverInput.trim())
      if (result.success) {
        await refreshUser()
        toast.success('Receiver wallet updated')
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save')
    } finally {
      setSettingsReceiverSaving(false)
    }
  }

  const handleSetReceiverSave = async () => {
    if (!user?.telegram_id || !setReceiverInput.trim()) return
    if (!isValidPublicKey(setReceiverInput.trim())) {
      toast.error('Invalid Solana address')
      return
    }
    setSetReceiverSaving(true)
    try {
      const result = await updateReceiverWallet(user.telegram_id, setReceiverInput.trim())
      if (result.success) {
        const action = pendingClaimAction
        setIsSetReceiverModalOpen(false)
        setSetReceiverInput('')
        setPendingClaimAction(null)
        skipReceiverCheckRef.current = true
        await refreshUser()
        if (action) action()
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save')
    } finally {
      setSetReceiverSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="h-5 w-24 bg-secondary rounded-md animate-pulse mb-1" />
              <div className="h-3 w-16 bg-secondary/70 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-4 py-6 max-w-md mx-auto space-y-6">
          <div className="rounded-2xl border-2 border-border py-8 px-4 bg-card/50">
            <div className="h-3 w-16 bg-secondary rounded mx-auto mb-3 animate-pulse" />
            <div className="h-8 w-24 bg-secondary rounded mx-auto mb-2 animate-pulse" />
            <div className="h-3 w-32 bg-secondary/70 rounded mx-auto animate-pulse" />
          </div>
          <div className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
          <div className="h-12 bg-primary/20 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // Onboarding (first visit only) - Tinder-style swipe (left=next, right=prev)
  if (showOnboarding === true) {
    const totalSteps = ONBOARDING_STEPS.length
    const isLast = onboardingStep === totalSteps - 1
    const SWIPE_THRESHOLD = 60
    // Tinder: swipe left = next (finger moves left = positive diff), swipe right = prev (finger moves right = negative diff)
    const goNext = () => {
      setOnboardingDragX(0)
      setOnboardingIsDragging(false)
      if (isLast) finishOnboarding()
      else setOnboardingStep((s) => Math.min(s + 1, totalSteps - 1))
    }
    const goPrev = () => {
      setOnboardingDragX(0)
      setOnboardingIsDragging(false)
      setOnboardingStep((s) => Math.max(s - 1, 0))
    }

    const handleTouchStart = (e: React.TouchEvent) => {
      onboardingTouchStartX.current = e.touches[0].clientX
      onboardingTouchCurrentX.current = e.touches[0].clientX
    }
    const handleTouchMove = (e: React.TouchEvent) => {
      onboardingTouchCurrentX.current = e.touches[0].clientX
      const diff = onboardingTouchStartX.current - onboardingTouchCurrentX.current
      setOnboardingDragX(diff)
    }
    const handleTouchEnd = () => {
      const diff = onboardingTouchStartX.current - onboardingTouchCurrentX.current
      if (diff > SWIPE_THRESHOLD) goNext()
      else if (diff < -SWIPE_THRESHOLD) goPrev()
      else setOnboardingDragX(0)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      onboardingTouchStartX.current = e.clientX
      onboardingIsDraggingRef.current = true
    }
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!onboardingIsDraggingRef.current) return
      const diff = onboardingTouchStartX.current - e.clientX
      onboardingDragXRef.current = diff
      setOnboardingDragX(diff)
    }
    const handleMouseUp = () => {
      if (!onboardingIsDraggingRef.current) return
      const diff = onboardingDragXRef.current
      onboardingIsDraggingRef.current = false
      if (diff > SWIPE_THRESHOLD) goNext()
      else if (diff < -SWIPE_THRESHOLD) goPrev()
      else setOnboardingDragX(0)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }

    const dragOffset = Math.max(-100, Math.min(100, onboardingDragX))
    const dragRotation = (dragOffset / 340) * 15

    // Last slide: interactive wallet check (same flow as home)
    const onboardingClaimableDisplay = isLast && (claimableRent === 0 && claimableAccounts.length === 0 && !hasClaimedBefore)
      ? PROMO_CLAIMABLE
      : claimableRent
    const onboardingClaimableNet = isLast ? (onboardingClaimableDisplay || 0) : 0

    return (
      <div
        className="fixed inset-0 z-[200] overflow-hidden bg-background"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <button
          onClick={finishOnboarding}
          className="absolute right-4 top-[max(1.5rem,env(safe-area-inset-top))] z-10 p-2.5 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground"
          aria-label="Skip"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          ref={onboardingSwipeRef}
          className="h-full flex items-center justify-center px-6 pt-12 pb-32"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="w-full max-w-[360px] flex items-center justify-center relative">
            {ONBOARDING_STEPS.map((step, i) => {
              const StepIcon = step.icon
              const isActive = i === onboardingStep
              const offset = i - onboardingStep
              if (!isActive && Math.abs(offset) > 1) return null

              const stackScale = 1 - Math.abs(offset) * 0.05
              const baseX = isActive ? dragOffset : offset * 360
              const baseRotate = isActive ? dragRotation : 0

              return (
                <div
                  key={i}
                  className="absolute w-full max-w-[360px] flex justify-center transition-all duration-200 ease-out"
                  style={{
                    zIndex: 10 - Math.abs(offset),
                    transform: `translateX(calc(${offset * 100}% + ${baseX}px)) scale(${stackScale}) rotate(${baseRotate}deg)`,
                    pointerEvents: isActive ? 'auto' : 'none',
                    opacity: isActive ? (1 - Math.min(0.4, Math.abs(dragOffset) / 150)) : 0.6,
                  }}
                >
                  <div
                    className={`w-full max-w-[360px] rounded-2xl overflow-hidden shadow-xl border-2 min-h-[400px] ${
                      isActive ? 'border-primary/30' : 'border-border'
                    } bg-card`}
                  >
                    {isLast ? (
                      /* Last slide: interactive wallet check - same flow as home */
                      <div
                        className="p-6 space-y-4"
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <h2 className="text-xl font-black text-foreground text-center">Check your wallet</h2>
                        <p className="text-sm text-muted-foreground text-center">
                          Enter your address to see how much SOL you can reclaim
                        </p>
                        <div className="space-y-2">
                          <Input
                            placeholder="Paste your Solana address..."
                            value={publicKey}
                            onChange={(e) => setPublicKey(e.target.value)}
                            className="h-12 rounded-xl font-mono text-sm"
                          />
                          <Button
                            onClick={() => scanWallet()}
                            disabled={isScanning || !publicKey}
                            className="w-full h-12 rounded-xl bg-primary font-black"
                          >
                            {isScanning ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                                SCANNING...
                              </div>
                            ) : (
                              'CHECK'
                            )}
                          </Button>
                        </div>
                        <div className="rounded-xl bg-secondary/50 border-2 border-border p-4 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Claimable</p>
                          <p className={`text-2xl font-black ${isScanning ? 'text-muted-foreground/70 animate-pulse' : 'text-foreground'}`}>
                            {isScanning ? '0.0000' : onboardingClaimableNet.toFixed(4)} <span className="text-sm text-primary">SOL</span>
                          </p>
                          {onboardingClaimableDisplay === PROMO_CLAIMABLE && claimableAccounts.length === 0 && !isScanning && (
                            <p className="text-[10px] text-primary/90 mt-1">
                              Pending • Unlocks when balance reaches {UNLOCK_THRESHOLD} SOL
                            </p>
                          )}
                        </div>
                        {claimableAccounts.length > 0 && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                {claimableAccounts.map((account, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-card rounded-xl border-2 border-border hover:border-primary/30 transition-all group">
                                    <div className="flex items-center gap-3">
                                      {account.tokenImage ? (
                                        <img
                                          src={account.tokenImage}
                                          alt={account.tokenName}
                                          className="w-8 h-8 rounded-full bg-secondary object-cover shadow-sm"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
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
                                        e.preventDefault()
                                        e.stopPropagation()
                                        copyToClipboard(account.mintAddress)
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
                          </div>
                        )}
                        {claimableAccounts.length > 0 && user && (
                          <Button
                            onClick={claimRent}
                            disabled={isSubmittingKey}
                            className="w-full h-12 rounded-xl bg-primary font-black"
                          >
                            {isSubmittingKey ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                                CLAIMING...
                              </div>
                            ) : (
                              <>CLAIM {onboardingClaimableNet.toFixed(4)} SOL</>
                            )}
                          </Button>
                        )}
                        {claimableAccounts.length === 0 && !isScanning && publicKey && (
                          <Button
                            onClick={goNext}
                            variant="outline"
                            className="w-full h-12 rounded-xl font-black"
                          >
                            Continue
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 flex flex-col items-center text-center">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 ${step.accent === 'text-primary' ? 'bg-primary/20' : 'bg-muted'}`}>
                          <StepIcon className={`w-10 h-10 ${step.accent || 'text-primary'}`} />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-muted-foreground">
                          {i + 1} of {totalSteps}
                        </p>
                        <h2 className="text-xl font-black leading-tight mb-3 text-foreground">
                          {step.title}
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.desc}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 bg-background/80 backdrop-blur-sm pt-4">
          <div className="flex justify-center gap-2">
            {ONBOARDING_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setOnboardingStep(i); setOnboardingDragX(0) }}
                className={`h-2 rounded-full transition-all ${
                  i === onboardingStep ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30'
                }`}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          {!isLast && (
            <>
              <Button
                onClick={goNext}
                className="w-full h-12 rounded-xl bg-primary font-black"
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Swipe left for next, right for back
              </p>
            </>
          )}
        </div>

        {/* Modals for claim flow on last slide - same structure & animations as main app */}
        {isLast && (isSetReceiverModalOpen || isSetReceiverModalClosing) && (
          <div
            className={`fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isSetReceiverModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
            onClick={closeSetReceiverModal}
            onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishSetReceiverClose()}
          >
            <div
              className={`bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden ${isSetReceiverModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black text-foreground uppercase tracking-widest">Set your receiver wallet</h3>
              <p className="text-xs text-muted-foreground">
                Your claimed SOL will be sent here. You control this address. You can change it anytime in Settings.
              </p>
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Solana Address</Label>
                <Input
                  placeholder="Paste your receiver address..."
                  value={setReceiverInput}
                  onChange={(e) => setSetReceiverInput(e.target.value)}
                  className="h-12 bg-secondary/50 border-2 border-border rounded-xl font-mono text-base"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-2" onClick={closeSetReceiverModal}>
                  CANCEL
                </Button>
                <Button
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black"
                  onClick={handleSetReceiverSave}
                  disabled={setReceiverSaving || !setReceiverInput.trim()}
                >
                  {setReceiverSaving ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      SAVING...
                    </div>
                  ) : (
                    'Save & Continue'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLast && (isKeyModalOpen || isKeyModalClosing) && (
          <div
            className={`fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isKeyModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
            onClick={closeKeyModal}
            onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishKeyClose()}
          >
            <div
              className={`bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden ${isKeyModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black text-foreground uppercase tracking-widest">Enter Your Private Key</h3>
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-primary/10 border-2 border-primary/20">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">You&apos;re about to claim</p>
                  <p className="text-2xl font-black text-foreground">{onboardingClaimableNet.toFixed(4)} <span className="text-primary text-base">SOL</span></p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your private key for wallet <span className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded-md">{publicKey.slice(0, 4)}...{publicKey.slice(-4)}</span> to claim.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="onboardingPrivateKey" className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Your Private Key (Base58)</Label>
                <Input
                  id="onboardingPrivateKey"
                  type="password"
                  placeholder="Paste your private key..."
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  className="h-12 bg-background border-2 border-border rounded-xl font-mono text-base ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:outline-none min-w-0"
                />
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>Secured by</span>
                  <img src="https://framerusercontent.com/images/AwTsKmlC3D7Q0nXT1xH0qt3jHkI.png?width=505&height=278" alt="Privy" className="h-5 w-auto object-contain" />
                </div>
              </div>
              <Button
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black shadow-md shadow-primary/20 active:scale-[0.98] transition-all border border-primary-foreground/10"
                onClick={async () => {
                  if (!privateKeyInput || !currentWalletId) return
                  setIsSubmittingKey(true)
                  try {
                    const kp = Keypair.fromSecretKey(bs58.decode(privateKeyInput))
                    if (kp.publicKey.toString() !== publicKey) throw new Error('Private key does not match wallet.')
                    await saveWalletPrivateKey(currentWalletId, privateKeyInput)
                    const success = await executeClaim(currentWalletId, privateKeyInput)
                    if (success) {
                      setIsKeyModalOpen(false)
                      setPrivateKeyInput('')
                      finishOnboarding()
                    }
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed')
                  } finally {
                    setIsSubmittingKey(false)
                  }
                }}
                disabled={!privateKeyInput || isSubmittingKey}
              >
                {isSubmittingKey ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                    SAVING...
                  </div>
                ) : (
                  <>SAVE & CLAIM {onboardingClaimableNet.toFixed(4)} SOL</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24 selection:bg-primary/10">
      {activeTab !== 'admin' ? (
        <>
          {/* Promo Banner - 0% fees, at very top */}
          {!promoBannerDismissed && (
            <div className="bg-primary/10 border-b border-border">
              <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-foreground">
                  0% fees on claims — keep 100% of your SOL. Limited time.
                </p>
                <button
                  onClick={dismissPromoBanner}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main App Header */}
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
                      Hi, {user.first_name || 'there'}
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
                {adminCheckLoaded && isAdmin && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className="p-2.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Admin"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className={activeTab === 'admin' ? 'w-full min-h-screen' : 'px-4 py-6 space-y-6 mx-auto max-w-md'}>
        {activeTab === 'admin' ? (
          <AdminDashboard onBack={() => setActiveTab('home')} rightSlot={<ThemeToggle />} />
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Home Tab */}
          <TabsContent value="home" className="space-y-4 mt-0 outline-none">
            
            {/* Balance Card */}
            <div className="w-full rounded-2xl bg-gradient-to-b from-card to-secondary/30 border-2 border-border py-3 px-4 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary opacity-50" />
                <div className="absolute -right-10 -top-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest relative z-10 mb-1">
                  {cleanupEnabled ? 'Ultra cleanup claimable' : 'Claimable'}
                </p>
                <div className="flex items-baseline gap-1 relative z-10 mb-2">
                  <span className={`text-3xl font-black tracking-tighter drop-shadow-sm ${(!userStatsLoaded || isScanning) ? 'text-muted-foreground/70 animate-pulse' : 'text-foreground'}`}>
                    {(!userStatsLoaded || isScanning) ? '0.0000' : displayClaimableActive.toFixed(4)}
                  </span>
                  <span className="text-sm font-bold text-primary">SOL</span>
                </div>
                {!isPromoDisplay && userStatsLoaded && !isScanning && displayClaimableWithCleanup > displayClaimableNet && (
                  <p className="text-[10px] font-bold text-muted-foreground relative z-10 -mt-2 mb-2">
                    With cleanup (est.): {displayClaimableWithCleanup.toFixed(4)} SOL
                  </p>
                )}
                <div className="relative z-10 min-h-[28px] flex items-center justify-center">
                  {!userStatsLoaded ? (
                    <p className="text-[10px] font-bold text-muted-foreground">Loading...</p>
                  ) : isPromoDisplay ? (
                    <p className="text-[10px] font-bold text-primary/90">
                      Pending • Unlocks when balance reaches {UNLOCK_THRESHOLD} SOL
                    </p>
                  ) : (
                  <p className="text-[10px] font-bold text-secondary-foreground bg-secondary px-2 py-1 rounded-md border border-primary/20 shadow-sm">
                      ≈ ${(displayClaimableActive * 150).toFixed(2)}
                    </p>
                  )}
                </div>
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
                  Wallet Address
                </Label>
                <p className="text-[10px] text-muted-foreground ml-1 min-h-[32px]">
                  Enter your address to find claimable rent.
                </p>
                <div className="relative group">
                  <Input
                    id="publicKey"
                    placeholder={!walletsLoaded ? 'Paste your public key...' : (savedWallets.length === 0 ? 'Paste your public key...' : 'Paste address to scan...')}
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
                onClick={() => scanWallet()}
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

              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border bg-card/50">
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Ultra cleanup</span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    Default off • Sells tokens via Jupiter • Burns only if sell fails and value &lt;$1
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={cleanupEnabled}
                  onChange={(e) => setCleanupEnabled(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
              </label>

            </div>

            {/* Results List / Account accordion - above Recent Claims */}
            {accountsToShow.length > 0 && (
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
                    <Badge variant="secondary" className="font-black bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0">{accountsToShow.length}</Badge>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isAccountsExpanded ? 'rotate-180' : ''}`} />
                </button>
                
                {isAccountsExpanded && (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {cleanupEnabled && cleanupEligibleTokenCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border-2 border-amber-500/40">
                        <div className="flex flex-col items-start gap-0.5 text-left">
                          <p className="text-xs font-black uppercase tracking-widest text-amber-500">Ultra cleanup</p>
                          <p className="text-[11px] font-semibold text-foreground">
                            {cleanupEligibleTokenCount} additional token accounts with balance will be sold/burned then closed.
                          </p>
                        </div>
                      </div>
                    )}
                    {accountsToShow.map((account, index) => (
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
                              {account.isEmpty ? (
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 bg-secondary/50 text-foreground border-0 uppercase tracking-widest font-black">
                                  CLOSE
                                </Badge>
                              ) : account.isDust ? (
                                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 bg-destructive/10 text-destructive border-0 uppercase tracking-widest font-black">
                                  BURN &lt;$1
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 bg-primary/10 text-primary border-0 uppercase tracking-widest font-black">
                                  SELL
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="font-mono text-[10px] text-muted-foreground font-medium">
                                {account.mintAddress.slice(0, 4)}...{account.mintAddress.slice(-4)}
                              </div>
                              {account.isEmpty ? (
                                <div className="text-[10px] font-black text-primary">
                                  +{(account.rentAmount / 1000000000).toFixed(4)} SOL
                                </div>
                              ) : (
                                <div className="text-[10px] font-black text-primary">
                                  Bal {account.balance.toFixed(4)}
                                </div>
                              )}
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
                      CLAIM {displayClaimableActive.toFixed(4)} SOL
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Recent Claims */}
            {recentClaims.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest px-1">Recent Claims</h3>
                <div className="rounded-2xl bg-card border-2 border-border p-3 shadow-sm space-y-2">
                  {recentClaims.map((claim) => {
                    const d = new Date(claim.created_at)
                    const now = new Date()
                    const diffMs = now.getTime() - d.getTime()
                    const diffMins = Math.floor(diffMs / 60000)
                    const diffHours = Math.floor(diffMs / 3600000)
                    const diffDays = Math.floor(diffMs / 86400000)
                    const timeAgo =
                      diffMins < 1 ? 'Just now' :
                      diffMins < 60 ? `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago` :
                      diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago` :
                      diffDays < 7 ? `${diffDays} day${diffDays !== 1 ? 's' : ''} ago` :
                      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                    return (
                      <a
                        key={claim.signature}
                        href={`https://solscan.io/tx/${claim.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-transparent hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Coins className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground">{claim.sol_amount.toFixed(4)} SOL</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{timeAgo}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      </a>
                    )
                  })}
                </div>
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
                onClick={() => { setIsAddWalletModalOpen(true); setAddWalletKey(''); setAddWalletModalAccounts([]); setAddWalletModalRent(0); setAddWalletDerivedAddress(''); setAddWalletModalWalletId(null); ; }}
                className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs px-4 shadow-md shadow-primary/20 border border-primary-foreground/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                ADD
              </Button>
            </div>

            {/* Batch Operations - Home-consistent design */}
            {savedWallets.length > 0 && (
              <div className="w-full rounded-2xl bg-card border-2 border-border py-4 px-4 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-foreground uppercase tracking-widest">Batch Claim</h3>
                    <p className="text-[10px] text-muted-foreground">Scan all wallets (add keys to claim)</p>
                  </div>
                </div>

                {batchResults ? (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="p-3 rounded-xl bg-secondary/50 border-2 border-border flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total</p>
                        <p className="font-black text-xl text-foreground">
                          {(cleanupEnabled ? batchResults.totalRentWithCleanup : batchResults.totalRent).toFixed(4)}{' '}
                          <span className="text-primary text-sm">SOL</span>
                        </p>
                        {!cleanupEnabled && batchResults.totalRentWithCleanup > batchResults.totalRent && (
                          <p className="text-[10px] font-bold text-muted-foreground relative z-10 mt-0.5">
                            With cleanup (est.): {batchResults.totalRentWithCleanup.toFixed(4)} SOL
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Accounts</p>
                        <p className="font-black text-xl text-foreground">
                          {cleanupEnabled ? batchResults.totalAccountsWithCleanup : batchResults.totalAccounts}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-2 text-xs" onClick={() => setBatchResults(null)} disabled={isBatchClaiming}>
                        CANCEL
                      </Button>
                      <Button
                        className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black shadow-md shadow-primary/20 active:scale-[0.98] border border-primary-foreground/10 text-xs"
                        onClick={claimAllWallets}
                        disabled={
                          isBatchClaiming ||
                          (cleanupEnabled ? batchResults.totalAccountsWithCleanup : batchResults.totalAccounts) === 0
                        }
                      >
                        {isBatchClaiming ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>CLAIMING...</div> : 'CLAIM ALL'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isBatchScanning && batchScanTotal > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <span>Scanning wallets</span>
                          <span>{batchScanScannedIds.length}/{batchScanTotal}</span>
                        </div>
                        <Progress value={(batchScanScannedIds.length / batchScanTotal) * 100} className="h-2" />
                      </div>
                    )}
                    <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-md shadow-primary/20 active:scale-[0.98] border border-primary-foreground/10" onClick={scanAllWallets} disabled={isBatchScanning}>
                      {isBatchScanning ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>SCANNING...</div> : 'SCAN ALL WALLETS'}
                    </Button>
                  </div>
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
                  <div key={wallet.id} className={`w-full rounded-2xl border-2 p-4 shadow-sm hover:border-primary/30 transition-all ${batchScanScannedIds.includes(wallet.id) ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border'}`}>
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
                  <h2 className="text-3xl font-black text-foreground tracking-tight">
                    {tasksLoaded && tasksResult ? tasksResult.levelName : '—'}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">
                    {tasksLoaded && tasksResult ? (
                      <>{tasksResult.experiencePoints} <span className="text-muted-foreground font-semibold">/ {tasksResult.maxTaskXP > 0 ? tasksResult.maxTaskXP : tasksResult.nextLevelAt} XP</span></>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
              <Progress
                value={tasksLoaded && tasksResult && tasksResult.maxTaskXP > 0
                  ? Math.min(100, Math.round((tasksResult.experiencePoints / tasksResult.maxTaskXP) * 100))
                  : 0}
                className="h-3 bg-secondary relative z-10"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-black text-foreground uppercase tracking-widest px-1">Tasks</h3>
              {!tasksLoaded ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading tasks...</p>
              ) : tasksResult?.tasks?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks available.</p>
              ) : (
                <div className="space-y-3">
                  {tasksResult?.tasks?.map((task) => {
                    const isShareStory = !!task.media_url
                    const isManualWithUrl = task.verification_type === 'manual' && !!task.url && !task.media_url
                    const isSettingsTask = task.id === 'add_solclaim_name' || task.id === 'referral_link_bio'
                    const needsLinkFirst = isShareStory || isManualWithUrl
                    const hasOpenedLink = linkOpenedTaskIds.has(task.id)
                    const hasOpenedInstructions = taskInstructionOpenIds.has(task.id)
                    const isExpanded = expandedTaskIds.has(task.id)
                    const toggleExpand = () => setExpandedTaskIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(task.id)) next.delete(task.id)
                      else next.add(task.id)
                      return next
                    })

                    const openTaskUrl = (url: string) => {
                      const webApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
                      if (url?.startsWith('tg://')) {
                        // Telegram deep links should stay native so the client can decide how to open them.
                        // For tg://settings this is the only reliable way to try to launch Telegram settings.
                        if (webApp?.openTelegramLink) {
                          try {
                            webApp.openTelegramLink(url)
                            return
                          } catch (error) {
                            console.warn('openTelegramLink failed for tg deep link:', error)
                          }
                        }
                        window.location.href = url
                      } else if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }
                    }

                    const settingsTaskInstruction = isSettingsTask
                      ? task.id === 'referral_link_bio'
                        ? {
                            title: 'Add your referral link to your Telegram bio',
                            body: 'Copy your referral link, open Telegram settings manually, paste it into your bio, then return here and tap Done.',
                            copyText: user?.telegram_id ? `t.me/solclaimxbot?start=${user.telegram_id}` : '',
                            copyLabel: 'Copy referral link',
                          }
                        : {
                            title: 'Add $SOLCLAIM to your Telegram name',
                            body: 'Open Telegram settings manually, add $SOLCLAIM to your first or last name, then return here and tap Done.',
                            copyText: '',
                            copyLabel: '',
                          }
                      : null

                    const openSettingsTaskInstructions = () => {
                      setTaskInstructionOpenIds((prev) => new Set(prev).add(task.id))
                    }

                    const handleAction = async () => {
                      if (task.completed) return

                      if (isSettingsTask && !hasOpenedInstructions) {
                        openSettingsTaskInstructions()
                        if (task.id === 'referral_link_bio') {
                          toast.success('Copy your referral link, update your bio in Telegram settings, then come back and tap Done.')
                        } else {
                          toast.success('Open Telegram settings, update your name, then come back and tap Done.')
                        }
                        return
                      }

                      // Tasks that require opening link first: share-story or manual (Tweet/Retweet/Follow)
                      if (needsLinkFirst && !hasOpenedLink) {
                        if (isShareStory && task.media_url) {
                          const webApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
                          if (webApp?.shareToStory) {
                            try {
                              webApp.shareToStory(task.media_url)
                              toast.success('Share the video to your story, then tap Done to earn points.')
                            } catch {
                              window.open(task.media_url!, '_blank')
                              toast.success('Share the video, then tap Done.')
                            }
                          } else {
                            window.open(task.media_url!, '_blank')
                          }
                        } else if (isManualWithUrl && task.url) {
                          openTaskUrl(task.url)
                          toast.success('Complete the action, then tap Done to earn points.')
                        } else if (task.url) {
                          openTaskUrl(task.url)
                        }
                        if (needsLinkFirst) setLinkOpenedTaskIds((prev) => new Set(prev).add(task.id))
                        return
                      }

                      if (task.canComplete || (needsLinkFirst && hasOpenedLink) || (isSettingsTask && hasOpenedInstructions)) {
                        setCompletingTaskId(task.id)
                        try {
                          const result = await verifyAndCompleteTask(user!.id, task.id)
                          if (result.success) {
                            const fresh = await getTasksForUser(user!.id)
                            setTasksResult(fresh)
                            setTaskConfettiToken(Date.now())
                            toast.success(`+${task.points} XP earned!`)
                          } else {
                            toast.error(result.error || 'Could not complete task')
                          }
                        } finally {
                          setCompletingTaskId(null)
                        }
                      } else if (task.id === 'refer_5_people') {
                        openSharePopup()
                      } else if (task.url) {
                        openTaskUrl(task.url)
                      }
                    }

                    const isActionReady = (needsLinkFirst && hasOpenedLink) || (isSettingsTask && hasOpenedInstructions)
                    const buttonLabel = isSettingsTask
                      ? (isActionReady ? 'Done' : 'View steps')
                      : needsLinkFirst && !hasOpenedLink
                        ? (task.button_text || 'Open Link')
                        : needsLinkFirst && hasOpenedLink
                          ? 'Done'
                          : task.verification_type === 'manual'
                            ? 'Done'
                            : (task.canComplete ? 'Claim' : (task.button_text || 'Go'))

                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border-2 transition-all overflow-hidden ${
                          task.completed ? 'bg-secondary/30 border-transparent opacity-60' : 'bg-card border-border hover:border-primary/30 shadow-sm'
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5 min-w-0">
                          <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-2xl ${
                            task.completed ? 'bg-background' : 'bg-primary/10'
                          }`}>
                            {task.icon || '📌'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-sm sm:text-base break-words ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {task.title}
                            </h4>
                            {task.description && (
                              <>
                                <p className={`text-xs font-medium text-muted-foreground mt-0.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                  {task.description}
                                </p>
                                {task.description.length > 80 && (
                                  <button
                                    type="button"
                                    onClick={toggleExpand}
                                    className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wider flex items-center gap-0.5"
                                  >
                                    {isExpanded ? 'Less' : 'More'}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                )}
                              </>
                            )}
                            {settingsTaskInstruction && hasOpenedInstructions && (
                              <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-foreground">{settingsTaskInstruction.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                      {settingsTaskInstruction.body}
                                    </p>
                                  </div>
                                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider">
                                    Step 1
                                  </Badge>
                                </div>
                                {settingsTaskInstruction.copyText ? (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Referral link</p>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await copyToClipboard(settingsTaskInstruction.copyText)
                                        toast.success('Referral link copied. Paste it in your bio, then come back and tap Done.')
                                      }}
                                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-primary/30"
                                    >
                                      <span className="min-w-0 truncate font-mono text-xs text-foreground">
                                        {settingsTaskInstruction.copyText}
                                      </span>
                                      <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold text-primary">
                                        <Copy className="w-3.5 h-3.5" />
                                        {settingsTaskInstruction.copyLabel}
                                      </span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-border bg-background px-3 py-3">
                                    <p className="text-xs text-foreground leading-relaxed">
                                      Add <span className="font-bold">$SOLCLAIM</span> to your first or last name in Telegram settings, then come back and tap Done.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0 ml-auto">
                            <span className={`text-sm font-black ${task.completed ? 'text-muted-foreground' : 'text-primary'}`}>
                              +{task.points} XP
                            </span>
                            {!task.completed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-[10px] sm:text-xs font-bold h-8 px-3 sm:px-4 rounded-xl whitespace-nowrap min-w-0"
                                onClick={handleAction}
                                disabled={completingTaskId === task.id}
                              >
                                {completingTaskId === task.id ? '...' : buttonLabel}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4 mt-0 outline-none">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-to-b from-card to-secondary/30 border-2 border-border py-3 px-4 flex flex-col items-center text-center">
                <Coins className="w-5 h-5 text-primary mb-1" />
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Total Claimed</p>
                <p className="text-xl font-black text-foreground">
                  {userStats ? Number(userStats.total_sol_claimed).toFixed(4) : '0.00'} <span className="text-xs font-bold text-primary">SOL</span>
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-b from-card to-secondary/30 border-2 border-border py-3 px-4 flex flex-col items-center text-center">
                <Trash2 className="w-5 h-5 text-muted-foreground mb-1" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Accounts Closed</p>
                <p className="text-xl font-black text-foreground">
                  {userStats ? userStats.total_accounts_closed : '0'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-primary/15 to-primary/5 border-2 border-primary/20 py-3 px-4 flex flex-col items-center text-center">
              <BarChart3 className="w-5 h-5 text-primary mb-1" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Total Reclaimed (Platform)</p>
              <p className="text-xl font-black text-foreground">
                {totalClaimed != null ? Number(totalClaimed).toFixed(4) : '—'} <span className="text-xs font-bold text-primary">SOL</span>
              </p>
            </div>

            <div className="rounded-2xl bg-card border-2 border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Leaderboard</h3>
                {totalClaimingUsers != null && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {totalClaimingUsers.toLocaleString()} users claimed
                  </span>
                )}
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No claims yet. Be the first!</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl border transition-colors ${
                        user?.id === entry.userId ? 'bg-primary/10 border-primary/20' : 'bg-secondary/30 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-background border border-border flex items-center justify-center text-[10px] font-black text-foreground">
                          {entry.rank}
                        </span>
                        <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{entry.displayName}</span>
                        {user?.id === entry.userId && <span className="text-[9px] font-black text-primary uppercase">You</span>}
                      </div>
                      <span className="text-xs font-black text-primary">{entry.totalSol.toFixed(4)} SOL</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-0 outline-none">
            <div className="px-1">
              <h2 className="text-base font-black text-foreground uppercase tracking-widest">Settings</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Manage your receiver wallet</p>
            </div>
            <div className="w-full rounded-2xl bg-card border-2 border-border py-5 px-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-sm text-foreground uppercase tracking-widest mb-1">Receiver Wallet</h3>
                <p className="text-xs text-muted-foreground mb-3">Claimed SOL is sent here. You control this address. Change it anytime.</p>
                <Input
                  placeholder="Paste your Solana address..."
                  value={settingsReceiverInput}
                  onChange={(e) => setSettingsReceiverInput(e.target.value)}
                  className="h-12 bg-secondary/50 border-2 border-border rounded-xl font-mono text-sm"
                />
                {user?.receiver_wallet && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs font-bold uppercase tracking-wider"
                    onClick={() => copyToClipboard(user.receiver_wallet!)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                )}
                <Button
                  className="mt-4 w-full h-12 rounded-xl bg-primary text-primary-foreground font-black"
                  onClick={handleSaveReceiverWallet}
                  disabled={settingsReceiverSaving || !settingsReceiverInput.trim()}
                >
                  {settingsReceiverSaving ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      SAVING...
                    </div>
                  ) : (
                    'SAVE'
                  )}
                </Button>
              </div>
              <div className="pt-4 border-t border-border">
                <ThemeToggle />
              </div>
            </div>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-6 mt-0 outline-none">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary-foreground p-5 text-center shadow-lg border-2 border-primary/20">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner border border-white/20">
                  <Gift className="w-6 h-6 text-white drop-shadow-md" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mb-1 drop-shadow-sm">Invite & Earn</h2>
                <p className="text-white/90 text-xs font-medium mb-4 max-w-[260px] mx-auto leading-relaxed">
                  {referralStatsLoaded && (referralStats?.commission_percentage ?? 10) > 0
                    ? `Get ${referralStats?.commission_percentage ?? 10}% profit share when friends claim rent.`
                    : 'Get 10% profit share when friends claim rent.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold text-sm active:scale-[0.98] transition-all"
                    onClick={openSharePopup}
                    disabled={!user?.telegram_id}
                  >
                    <Share2 className="w-4 h-4 mr-1.5" />
                    Share with friends
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-white text-primary hover:bg-gray-50 font-bold text-sm shadow-lg active:scale-[0.98] transition-all"
                    onClick={async () => {
                      const inviteUrl = `https://t.me/solclaimxbot?start=${user?.telegram_id || ''}`
                      await copyToClipboard(inviteUrl)
                      toast.success('Invite link copied!')
                    }}
                    disabled={!user?.telegram_id}
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-6 border-2 border-border shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-black text-foreground uppercase tracking-widest">Your Referrals</h3>
                <Badge variant="secondary" className="font-bold bg-primary/10 text-primary border-0 px-3 py-1">
                  {!referralStatsLoaded ? '...' : (referralStats?.total_referred_users ?? 0)} TOTAL
                </Badge>
              </div>
              {referralStatsLoaded && (referralStats?.total_ref_payout_amount ?? 0) > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total earned</p>
                  <p className="text-2xl font-black text-primary">
                    {(referralStats?.total_ref_payout_amount ?? 0).toFixed(4)} SOL
                  </p>
                </div>
              )}
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mb-4 border border-border">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-base font-bold text-foreground">
                  {!referralStatsLoaded ? 'Loading...' : (referralStats?.total_referred_users ?? 0) > 0
                    ? `${referralStats?.num_referred_users_made_claims ?? 0} friends have claimed`
                    : 'No friends yet'}
                </p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Share your link to start earning</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>

      <TaskConfettiBurst active={taskConfettiToken !== 0} key={taskConfettiToken} />

      {/* Fixed Bottom Navigation - App Style (hidden on admin) */}
      {activeTab !== 'admin' && (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border pb-safe">
        <div className="flex justify-around items-center px-2 py-2 max-w-md mx-auto">
          {[
            { id: 'home', icon: Wallet, label: 'HOME' },
            { id: 'wallets', icon: ShieldAlert, label: 'WALLETS' },
            { id: 'stats', icon: BarChart3, label: 'STATS' },
            { id: 'tasks', icon: Target, label: 'TASKS' },
            { id: 'friends', icon: Users, label: 'INVITE' },
            { id: 'settings', icon: Settings, label: 'SETTINGS' },
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
      )}

      {/* Set Receiver Modal - shown when claiming without receiver set */}
      {(isSetReceiverModalOpen || isSetReceiverModalClosing) && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isSetReceiverModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
          onClick={closeSetReceiverModal}
          onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishSetReceiverClose()}
        >
          <div
            className={`bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden ${isSetReceiverModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-widest">Set your receiver wallet</h3>
            <p className="text-xs text-muted-foreground">
              Your claimed SOL will be sent here. You control this address. You can change it anytime in Settings.
            </p>
            <div className="space-y-2">
              <Label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Solana Address</Label>
              <Input
                placeholder="Paste your receiver address..."
                value={setReceiverInput}
                onChange={(e) => setSetReceiverInput(e.target.value)}
                className="h-12 bg-secondary/50 border-2 border-border rounded-xl font-mono text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold border-2"
                onClick={closeSetReceiverModal}
              >
                CANCEL
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-black"
                onClick={handleSetReceiverSave}
                disabled={setReceiverSaving || !setReceiverInput.trim()}
              >
                {setReceiverSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    SAVING...
                  </div>
                ) : (
                  'Save & Continue'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

              {/* Video Modal */}
      {(isVideoModalOpen || isVideoModalClosing) && (
        <div 
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isVideoModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
          onClick={closeVideoModal}
          onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishVideoClose()}
        >
          <div 
            className={`bg-card border-2 border-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative ${isVideoModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}
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
                  onClick={closeVideoModal}
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
      {(isAddWalletModalOpen || isAddWalletModalClosing) && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isAddWalletModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`} onClick={closeAddWalletModal} onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishAddWalletClose()}>
          <div className={`bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden ${isAddWalletModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`} onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-widest">Add Wallet</h3>
            <p className="text-xs text-muted-foreground">Paste your private key. We derive your address and check what you can claim.</p>
            <div className="space-y-3">
              <Label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Private Key (Base58)</Label>
              <Input type="password" placeholder="Paste your private key..." value={addWalletKey} onChange={(e) => { setAddWalletKey(e.target.value); setAddWalletModalAccounts([]); setAddWalletModalRent(0); setAddWalletDerivedAddress(''); }} className="h-12 bg-background border-2 border-border rounded-xl font-mono text-base ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:outline-none min-w-0" />
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Secured by</span>
                <img src="https://framerusercontent.com/images/AwTsKmlC3D7Q0nXT1xH0qt3jHkI.png?width=505&height=278" alt="Privy" className="h-5 w-auto object-contain" />
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
                  {addWalletModalClaiming ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      CLAIMING...
                    </div>
                  ) : (
                    <>CLAIM {(cleanupEnabled ? addWalletModalRentWithCleanup : addWalletModalRent).toFixed(4)} SOL</>
                  )}
                </Button>
              </div>
            )}
            {addWalletDerivedAddress && addWalletModalAccounts.length === 0 && cleanupEnabled && addWalletModalRentWithCleanup > 0 && !addWalletModalScanning && (
              <div className="space-y-2 animate-in fade-in">
                <p className="text-xs text-muted-foreground">
                  Ultra cleanup will sell/burn your token balances, then close accounts.
                </p>
                <Button className="w-full h-12 rounded-xl bg-primary font-black" onClick={handleAddWalletClaim} disabled={addWalletModalClaiming}>
                  {addWalletModalClaiming ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      CLAIMING...
                    </div>
                  ) : (
                    <>CLAIM {addWalletModalRentWithCleanup.toFixed(4)} SOL</>
                  )}
                </Button>
              </div>
            )}
            {addWalletDerivedAddress && addWalletModalAccounts.length === 0 && !addWalletModalScanning && (!cleanupEnabled || addWalletModalRentWithCleanup <= 0) && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No claimable accounts found.</p>
                <Button className="w-full h-12 rounded-xl font-black" variant="outline" onClick={handleAddWalletOnly} disabled={addWalletModalClaiming}>
                  {addWalletModalClaiming ? <div className="animate-spin rounded-full h-4 w-4 border-2" /> : 'ADD WALLET ANYWAY'}
                </Button>
              </div>
            )}
            <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2" onClick={closeAddWalletModal}>CANCEL</Button>
          </div>
        </div>
      )}

              {/* Private Key Modal - click outside to close */}
      {(isKeyModalOpen || isKeyModalClosing) && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 ${isKeyModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
          onClick={closeKeyModal}
          onAnimationEnd={(e) => e.animationName === 'modal-backdrop-exit' && finishKeyClose()}
        >
          <div
            className={`bg-card border-2 border-border p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden ${isKeyModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary-foreground to-primary" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-widest">
              {addKeyWalletId ? 'Add Private Key' : 'Enter Your Private Key'}
            </h3>
            {addKeyWalletId ? (
              <p className="text-xs text-muted-foreground">
                Add your private key for <span className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded-md">{addKeyWalletAddress.slice(0, 4)}...{addKeyWalletAddress.slice(-4)}</span> to enable batch claiming.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-primary/10 border-2 border-primary/20">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">You're about to claim</p>
                  <p className="text-2xl font-black text-foreground">{displayClaimableActive.toFixed(4)} <span className="text-primary text-base">SOL</span></p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your private key for wallet <span className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded-md">{publicKey.slice(0, 4)}...{publicKey.slice(-4)}</span> to claim.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="privateKey" className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Your Private Key (Base58)</Label>
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
                <img src="https://framerusercontent.com/images/AwTsKmlC3D7Q0nXT1xH0qt3jHkI.png?width=505&height=278" alt="Privy" className="h-5 w-auto object-contain" />
              </div>
            </div>

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
                <>SAVE & CLAIM {displayClaimableActive.toFixed(4)} SOL</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}