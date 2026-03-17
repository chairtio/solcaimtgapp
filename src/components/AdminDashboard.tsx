'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, BarChart3, Megaphone, Mail, Send, Image, Film, Download, History, ChevronDown, ChevronRight, Plus, Pencil, Trash2, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { FollowUpForm } from './FollowUpForm'
import { FilterPills } from './ui/filter-pills'
import { AdminCard, AdminCardHeader, AdminCardTitle, AdminCardContent, AdminStatCard, AdminTable, AdminTableHeader, AdminTableBody, AdminTableRow, AdminTableHead, AdminTableCell, AdminTableSkeleton, AdminEmptyState, AdminPageHeader } from './admin'

const getInitData = () => (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : '') || ''

async function adminFetch(path: string, opts: RequestInit = {}) {
  const initData = getInitData()
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [adminTab, setAdminTab] = useState('overview')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Overview
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('7d')
  const [stats, setStats] = useState<{
    totalUsers: number
    totalWallets: number
    usersWhoClaimed: number
    totalClaimed: number
    botBlockedCount: number
    recentSignups: { id: string; telegram_id: string; username?: string; first_name?: string; created_at: string; bot_blocked_at?: string; has_claimed: boolean }[]
    range?: string
    newSignups?: number
    newClaims?: number
    campaignsSent?: number
    campaignsScheduled?: number
    broadcastsSent?: number
    followUpsSent?: number
  } | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Users list
  const [users, setUsers] = useState<{ id: string; telegram_id: string; username?: string; first_name?: string; created_at: string; bot_blocked_at?: string; has_claimed?: boolean }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'not_claimed' | 'blocked'>('all')

  // User detail
  const [userDetail, setUserDetail] = useState<any>(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)

  // Campaigns
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)

  // Follow-ups
  const [followUps, setFollowUps] = useState<any[]>([])
  const [followUpsLoading, setFollowUpsLoading] = useState(false)
  const [followUpEditingId, setFollowUpEditingId] = useState<string | null>(null)
  const [followUpExpandedGroups, setFollowUpExpandedGroups] = useState<Record<string, boolean>>({ not_claimed: true, claimed: true })
  const [followUpAddingSegment, setFollowUpAddingSegment] = useState<string | null>(null)
  const [followUpSaving, setFollowUpSaving] = useState(false)
  const [followUpForm, setFollowUpForm] = useState<{
    mode: 'edit'
    id: string
    name: string
    message: string
    delay_minutes: number
    media_type: 'none' | 'image' | 'gif'
    media_url: string
    enabled: boolean
  } | {
    mode: 'add'
    segment: string
    name: string
    message: string
    delay_minutes: number
    media_type: 'none' | 'image' | 'gif'
    media_url: string
    enabled: boolean
  } | null>(null)

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastMediaType, setBroadcastMediaType] = useState<'none' | 'image' | 'gif'>('none')
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState('')
  const [broadcastButtons, setBroadcastButtons] = useState<{ text: string; url: string }[]>([])
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [lastBroadcast, setLastBroadcast] = useState<any>(null)
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([])
  const [broadcastHistoryLoading, setBroadcastHistoryLoading] = useState(false)
  const [broadcastAudienceCount, setBroadcastAudienceCount] = useState<number | null>(null)
  const [broadcastAudienceFilters, setBroadcastAudienceFilters] = useState<{ claimed: 'all' | 'yes' | 'no'; has_referrals: 'all' | 'yes' | 'no' }>({ claimed: 'all', has_referrals: 'all' })
  const [broadcastAudiencePreviewing, setBroadcastAudiencePreviewing] = useState(false)

  // Preview
  const [previewSending, setPreviewSending] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    if (adminTab === 'overview') {
      setStatsLoading(true)
      adminFetch(`/api/admin/stats?range=${dateRange}`)
        .then(setStats)
        .catch((e) => toast.error(e.message))
        .finally(() => setStatsLoading(false))
    }
  }, [adminTab, dateRange])

  useEffect(() => {
    if (adminTab === 'users') {
      setUsersLoading(true)
      const params = new URLSearchParams()
      if (userSearch) params.set('search', userSearch)
      if (userFilter === 'not_claimed') params.set('claimed', 'false')
      if (userFilter === 'blocked') params.set('blocked', 'true')
      adminFetch(`/api/admin/users?${params}`)
        .then((r) => setUsers(r.users || []))
        .catch((e) => toast.error(e.message))
        .finally(() => setUsersLoading(false))
    }
  }, [adminTab, userSearch, userFilter])

  useEffect(() => {
    if (selectedUserId) {
      setUserDetailLoading(true)
      adminFetch(`/api/admin/users/${selectedUserId}`)
        .then(setUserDetail)
        .catch((e) => toast.error(e.message))
        .finally(() => setUserDetailLoading(false))
    } else {
      setUserDetail(null)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (adminTab === 'campaigns') {
      setCampaignsLoading(true)
      adminFetch('/api/admin/campaigns')
        .then((r) => setCampaigns(Array.isArray(r) ? r : (r.campaigns || [])))
        .catch((e) => toast.error(e.message))
        .finally(() => setCampaignsLoading(false))
    }
  }, [adminTab])

  useEffect(() => {
    if (adminTab === 'followups') {
      setFollowUpsLoading(true)
      adminFetch('/api/admin/follow-ups')
        .then((r) => setFollowUps(Array.isArray(r) ? r : (r.followUps || [])))
        .catch((e) => toast.error(e.message))
        .finally(() => setFollowUpsLoading(false))
    }
  }, [adminTab])

  useEffect(() => {
    if (adminTab === 'broadcast') {
      setBroadcastHistoryLoading(true)
      adminFetch('/api/admin/broadcast')
        .then((r) => setBroadcastHistory(r.broadcasts || []))
        .catch((e) => {
          toast.error(e.message)
          setBroadcastHistory([])
        })
        .finally(() => setBroadcastHistoryLoading(false))
    }
  }, [adminTab])

  if (selectedUserId && userDetail) {
    const followUpsSent = userDetail.followUpsSent || []
    const followUpsScheduled = userDetail.followUpsScheduled || []
    const allFollowUps = [...followUpsSent.map((f: any) => ({ ...f, status: 'sent' as const })), ...followUpsScheduled.map((f: any) => ({ ...f, status: 'scheduled' as const }))]

    return (
      <div data-admin className="flex min-h-screen w-full bg-zinc-50 dark:bg-[#0b0c10]">
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 bg-white dark:bg-zinc-900 lg:fixed lg:inset-y-0 lg:left-0 z-20">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Admin</p>
          </div>
          <div className="p-4 py-6">
            <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="w-full justify-start gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors duration-150">
              <ArrowLeft className="w-4 h-4" /> Back to Users
            </Button>
          </div>
        </aside>

        <main className="flex-1 lg:pl-64 min-w-0 flex flex-col min-h-screen bg-zinc-50 dark:bg-[#0b0c10] w-full max-w-full">
        <div className="lg:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 p-4 w-full overflow-hidden max-w-full flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors duration-150 h-8 px-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">User Detail</p>
        </div>

          <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
            <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">User Detail</h3>
              </div>
              <div className="grid gap-8 lg:grid-cols-2">
              <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
                  <AdminCardTitle>User Profile</AdminCardTitle>
                </AdminCardHeader>
                <AdminCardContent className="space-y-6 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Telegram ID</p>
                      <p className="font-mono text-sm">{userDetail.user?.telegram_id}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Username</p>
                      <p className="text-sm">@{userDetail.user?.username || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Name</p>
                      <p className="text-sm">{[userDetail.user?.first_name, userDetail.user?.last_name].filter(Boolean).join(' ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Created</p>
                      <p className="text-sm">{userDetail.user?.created_at ? new Date(userDetail.user.created_at).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                  {userDetail.user?.bot_blocked_at && (
                    <Badge variant="destructive">Bot blocked</Badge>
                  )}
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Stats</p>
                    <p className="text-sm">Claimed: <span className="font-semibold">{Number(userDetail.stats?.total_sol_claimed || 0).toFixed(4)} SOL</span> | Accounts: <span className="font-semibold">{userDetail.stats?.total_accounts_closed || 0}</span></p>
                  </div>
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Wallets</p>
                    <ul className="text-sm font-mono space-y-2">
                      {(userDetail.wallets || []).map((w: any) => (
                        <li key={w.id} className="flex items-center justify-between">
                          <span>{w.public_key?.slice(0, 8)}...{w.public_key?.slice(-4)}</span>
                          <Badge variant="outline" className="text-[10px]">{w.status}</Badge>
                        </li>
                      ))}
                      {(!userDetail.wallets || userDetail.wallets.length === 0) && <li className="text-zinc-500 dark:text-zinc-400 font-sans">No wallets linked</li>}
                    </ul>
                  </div>
                </AdminCardContent>
              </AdminCard>
              <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm mt-0 overflow-hidden">
                <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
                  <AdminCardTitle>Follow-ups</AdminCardTitle>
                </AdminCardHeader>
                <AdminCardContent className="space-y-6 p-6">
                  {allFollowUps.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Status</th>
                            <th className="text-left py-2">Message</th>
                            <th className="text-left py-2">Delay</th>
                            <th className="text-left py-2">Date</th>
                            <th className="text-left py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {allFollowUps.map((f: any, i: number) => (
                            <tr key={`${f.follow_up_id}-${i}`} className="border-b">
                              <td className="py-2">
                                <Badge variant={f.status === 'sent' ? 'default' : 'secondary'} className="text-[10px]">
                                  {f.status === 'sent' ? 'Sent' : 'Scheduled'}
                                </Badge>
                              </td>
                              <td className="py-2">{f.name || '—'}</td>
                              <td className="py-2">{f.delay_minutes} min</td>
                              <td className="py-2 text-zinc-500 dark:text-zinc-400">
                                {f.status === 'sent' && f.sent_at ? new Date(f.sent_at).toLocaleString() : f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : '—'}
                              </td>
                              <td className="py-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px]"
                                  disabled={previewSending}
                                  onClick={async () => {
                                    setPreviewSending(true)
                                    try {
                                      await adminFetch('/api/admin/preview', {
                                        method: 'POST',
                                        body: JSON.stringify({ follow_up_id: f.follow_up_id }),
                                      })
                                      toast.success('Preview sent to your Telegram')
                                    } catch (e) {
                                      toast.error((e as Error).message)
                                    } finally {
                                      setPreviewSending(false)
                                    }
                                  }}
                                >
                                  Preview
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No follow-ups sent or scheduled for this user.</p>
                  )}
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewSending}
                      onClick={async () => {
                        setPreviewSending(true)
                        try {
                          await adminFetch('/api/admin/preview', {
                            method: 'POST',
                            body: JSON.stringify({ message: 'Test preview from admin dashboard' }),
                          })
                          toast.success('Preview sent to your Telegram')
                        } catch (e) {
                          toast.error((e as Error).message)
                        } finally {
                          setPreviewSending(false)
                        }
                      }}
                    >
                      {previewSending ? 'Sending...' : 'Send custom preview'}
                    </Button>
                  </div>
                </AdminCardContent>
              </AdminCard>
            </div>
          </div>
        </div>
      </main>
    </div>
    )
  }

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'followups', label: 'Follow-ups', icon: Mail },
    { id: 'broadcast', label: 'Broadcast', icon: Send },
  ]

  return (
    <div data-admin className="flex min-h-screen w-full bg-zinc-50 dark:bg-[#0b0c10]">
      {/* Sidebar - desktop: Stripe-style left accent for active */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 bg-white dark:bg-zinc-900 lg:fixed lg:inset-y-0 lg:left-0 z-20">
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Admin</p>
        </div>
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setAdminTab(id); setSelectedUserId(null); }}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-left w-full transition-all duration-200 rounded-lg ${
                adminTab === id && !selectedUserId
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" /> {label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-full justify-start gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors duration-150">
            <ArrowLeft className="w-4 h-4" /> Exit Admin
          </Button>
        </div>
      </aside>

        <main className="flex-1 lg:pl-64 min-w-0 flex flex-col min-h-screen bg-zinc-50 dark:bg-[#0b0c10] w-full max-w-full">
        <div className="lg:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 w-full overflow-hidden max-w-full">
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Admin</p>
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors duration-150 h-8 px-2">
              <ArrowLeft className="w-4 h-4" /> Exit
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto p-4 custom-scrollbar w-full max-w-full">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
              { id: 'followups', label: 'Follow-ups', icon: Mail },
              { id: 'broadcast', label: 'Broadcast', icon: Send },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setAdminTab(id); setSelectedUserId(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  adminTab === id && !selectedUserId ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

          <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
          {adminTab === 'overview' && !selectedUserId && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Overview</h3>
                <FilterPills
                  value={dateRange}
                  onChange={(v) => setDateRange(v as 'today' | '7d' | '30d')}
                  options={[
                    { value: 'today', label: 'Today' },
                    { value: '7d', label: '7 days' },
                    { value: '30d', label: '30 days' },
                  ]}
                />
              </div>
          {statsLoading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                    <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse mb-4" />
                    <div className="h-8 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">All time</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                      <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse mb-4" />
                      <div className="h-8 w-20 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
              <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
                  <AdminCardTitle>Recent Signups</AdminCardTitle>
                </AdminCardHeader>
                <AdminCardContent className="p-0">
                  <AdminTableSkeleton rows={5} cols={5} />
                </AdminCardContent>
              </AdminCard>
            </div>
          ) : stats ? (
            <>
              {stats.range && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                  <AdminStatCard size="primary" label="New signups" value={stats.newSignups ?? 0} />
                  <AdminStatCard size="primary" label="New claims" value={stats.newClaims ?? 0} />
                  <AdminStatCard label="Campaigns sent" value={stats.campaignsSent ?? 0} />
                  <AdminStatCard label="Campaigns scheduled" value={stats.campaignsScheduled ?? 0} />
                  <AdminStatCard label="Broadcasts sent" value={stats.broadcastsSent ?? 0} />
                  <AdminStatCard label="Follow-ups sent" value={stats.followUpsSent ?? 0} />
                </div>
              )}
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">All time</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  <AdminStatCard label="Total Users" value={stats.totalUsers} />
                  <AdminStatCard label="Wallets" value={stats.totalWallets} />
                  <AdminStatCard label="Claimed" value={stats.usersWhoClaimed} />
                  <AdminStatCard label="Bot Blocked" value={stats.botBlockedCount} />
                </div>
              </div>
              <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
                  <AdminCardTitle>Recent Signups</AdminCardTitle>
                </AdminCardHeader>
                <AdminCardContent className="p-0">
                  <AdminTable>
                    <AdminTableHeader>
                      <AdminTableRow>
                        <AdminTableHead>ID</AdminTableHead>
                        <AdminTableHead>User</AdminTableHead>
                        <AdminTableHead>Created</AdminTableHead>
                        <AdminTableHead>Claimed</AdminTableHead>
                        <AdminTableHead>Blocked</AdminTableHead>
                      </AdminTableRow>
                    </AdminTableHeader>
                    <AdminTableBody>
                      {(stats.recentSignups || []).slice(0, 20).map((u: any) => (
                        <AdminTableRow
                          key={u.id}
                          className="cursor-pointer"
                          onClick={() => { setSelectedUserId(u.id); setAdminTab('users'); }}
                        >
                          <AdminTableCell className="font-mono">{u.telegram_id}</AdminTableCell>
                          <AdminTableCell>@{u.username || '—'}</AdminTableCell>
                          <AdminTableCell className="text-zinc-500 dark:text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</AdminTableCell>
                          <AdminTableCell>{u.has_claimed ? 'Yes' : '—'}</AdminTableCell>
                          <AdminTableCell>{u.bot_blocked_at ? 'Yes' : '—'}</AdminTableCell>
                        </AdminTableRow>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                </AdminCardContent>
              </AdminCard>
            </>
          ) : null}
            </div>
          )}

          {adminTab === 'users' && !selectedUserId && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Users</h3>
                <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search telegram_id or username"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-10 w-full sm:w-[240px] rounded-lg"
              />
              <FilterPills
                value={userFilter}
                onChange={(v) => setUserFilter(v as 'all' | 'not_claimed' | 'blocked')}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'not_claimed', label: 'Not claimed' },
                  { value: 'blocked', label: 'Blocked' },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg"
                disabled={exportLoading}
                onClick={async () => {
                  setExportLoading(true)
                  try {
                    const initData = getInitData()
                    const params = new URLSearchParams()
                    if (userFilter === 'not_claimed') params.set('claimed', 'false')
                    if (userFilter === 'blocked') params.set('blocked', 'true')
                    const res = await fetch(`/api/admin/users/export?${params}`, {
                      headers: { 'X-Telegram-Init-Data': initData },
                    })
                    if (!res.ok) throw new Error('Export failed')
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success('CSV downloaded')
                  } catch (e) {
                    toast.error((e as Error).message)
                  } finally {
                    setExportLoading(false)
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" /> {exportLoading ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </div>
          {usersLoading ? (
            <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <AdminCardContent className="p-0">
                <AdminTableSkeleton rows={5} cols={4} />
              </AdminCardContent>
            </AdminCard>
          ) : users.length === 0 ? (
            <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <AdminEmptyState
                icon={Users}
                title="No users match your filters"
                description="Try adjusting your search or filter criteria."
              />
            </AdminCard>
          ) : (
            <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <AdminCardContent className="p-0">
                <AdminTable>
                  <AdminTableHeader>
                    <AdminTableRow>
                      <AdminTableHead>ID</AdminTableHead>
                      <AdminTableHead>User</AdminTableHead>
                      <AdminTableHead>Created</AdminTableHead>
                      <AdminTableHead>Blocked</AdminTableHead>
                    </AdminTableRow>
                  </AdminTableHeader>
                  <AdminTableBody>
                    {users.map((u) => (
                      <AdminTableRow
                        key={u.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        <AdminTableCell className="font-mono">{u.telegram_id}</AdminTableCell>
                        <AdminTableCell>@{u.username || '—'}</AdminTableCell>
                        <AdminTableCell className="text-zinc-500 dark:text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</AdminTableCell>
                        <AdminTableCell>{u.bot_blocked_at ? 'Yes' : '—'}</AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                  </AdminTable>
                </AdminCardContent>
              </AdminCard>
            )}
          </div>
        )}

        {adminTab === 'campaigns' && !selectedUserId && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Campaigns</h3>
            </div>
          {campaignsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 h-24 shadow-sm">
                  <div className="h-5 w-40 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse mb-3" />
                  <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <AdminEmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Create campaigns to send scheduled messages and track performance."
              />
            </AdminCard>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => (
                <AdminCard key={c.id} className="p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-base text-zinc-900 dark:text-zinc-50">{c.name}</span>
                        <Badge
                          variant={c.status === 'sent' ? 'default' : c.status === 'scheduled' ? 'secondary' : c.status === 'cancelled' ? 'destructive' : 'outline'}
                          className="text-[10px] uppercase tracking-wider"
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {c.sent_at ? `Sent ${new Date(c.sent_at).toLocaleString()}` : c.scheduled_at ? `Scheduled ${new Date(c.scheduled_at).toLocaleString()}` : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Sent</p>
                        <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{c.sent_count || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Blocked</p>
                        <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{c.blocked_count || 0}</p>
                      </div>
                    </div>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </div>
        )}

        {adminTab === 'followups' && !selectedUserId && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Follow-ups</h3>
            </div>
          {followUpsLoading ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                  <div className="h-5 w-40 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse mb-6" />
                  <div className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {(['not_claimed', 'claimed'] as const).map((segment) => {
                const items = followUps.filter((f) => (f.segment || 'not_claimed') === segment)
                const isOpen = followUpExpandedGroups[segment] !== false
                const label = segment === 'not_claimed' ? 'Not claimed' : 'Claimed'
                return (
                  <AdminCard key={segment} className="p-0 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      onClick={() => setFollowUpExpandedGroups((g) => ({ ...g, [segment]: !isOpen }))}
                    >
                      <span className="text-base font-semibold flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        {label} <Badge variant="secondary" className="ml-2">{items.length}</Badge>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setFollowUpAddingSegment(s => s === segment ? null : segment); setFollowUpEditingId(null); }}
                      >
                        {followUpAddingSegment === segment ? 'Cancel' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                      </Button>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                        {followUpAddingSegment === segment && (
                          <FollowUpForm
                            segment={segment}
                            onSave={async (d) => {
                              setFollowUpSaving(true)
                              try {
                                await adminFetch('/api/admin/follow-ups', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    segment,
                                    name: d.name || null,
                                    message: d.message,
                                    delay_minutes: d.delay_minutes,
                                    media_type: d.media_type !== 'none' ? d.media_type : null,
                                    media_url: d.media_type !== 'none' && d.media_url ? d.media_url : null,
                                    enabled: d.enabled,
                                    buttons: d.buttons && d.buttons.length > 0 ? d.buttons : null,
                                    sort: items.length,
                                  }),
                                })
                                toast.success('Follow-up added')
                                setFollowUpAddingSegment(null)
                                adminFetch('/api/admin/follow-ups').then((r) => setFollowUps(r.followUps || []))
                              } catch (e) {
                                toast.error((e as Error).message)
                              } finally {
                                setFollowUpSaving(false)
                              }
                            }}
                            onCancel={() => setFollowUpAddingSegment(null)}
                            saving={followUpSaving}
                            previewSending={previewSending}
                            onPreview={async (d) => {
                              setPreviewSending(true)
                              try {
                                await adminFetch('/api/admin/preview', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    message: d.message,
                                    media_type: d.media_type !== 'none' ? d.media_type : undefined,
                                    media_url: d.media_type !== 'none' && d.media_url ? d.media_url : undefined,
                                    buttons: d.buttons && d.buttons.length > 0 ? d.buttons : undefined,
                                  }),
                                })
                                toast.success('Preview sent to your Telegram')
                              } catch (e) {
                                toast.error((e as Error).message)
                              } finally {
                                setPreviewSending(false)
                              }
                            }}
                          />
                        )}
                        {items.map((f) =>
                          followUpEditingId === f.id ? (
                            <FollowUpForm
                              key={f.id}
                              segment={segment}
                              initial={f}
                              onSave={async (d) => {
                                setFollowUpSaving(true)
                                try {
                                  await adminFetch(`/api/admin/follow-ups/${f.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      name: d.name || null,
                                      message: d.message,
                                      delay_minutes: d.delay_minutes,
                                      media_type: d.media_type !== 'none' ? d.media_type : null,
                                      media_url: d.media_type !== 'none' && d.media_url ? d.media_url : null,
                                      enabled: d.enabled,
                                      buttons: d.buttons && d.buttons.length > 0 ? d.buttons : null,
                                    }),
                                  })
                                  toast.success('Follow-up updated')
                                  setFollowUpEditingId(null)
                                  adminFetch('/api/admin/follow-ups').then((r) => setFollowUps(r.followUps || []))
                                } catch (e) {
                                  toast.error((e as Error).message)
                                } finally {
                                  setFollowUpSaving(false)
                                }
                              }}
                              onCancel={() => setFollowUpEditingId(null)}
                              saving={followUpSaving}
                              previewSending={previewSending}
                              onPreview={async (d) => {
                                setPreviewSending(true)
                                try {
                                  await adminFetch('/api/admin/preview', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      message: d.message,
                                      media_type: d.media_type !== 'none' ? d.media_type : undefined,
                                      media_url: d.media_type !== 'none' && d.media_url ? d.media_url : undefined,
                                      buttons: d.buttons && d.buttons.length > 0 ? d.buttons : undefined,
                                    }),
                                  })
                                  toast.success('Preview sent to your Telegram')
                                } catch (e) {
                                  toast.error((e as Error).message)
                                } finally {
                                  setPreviewSending(false)
                                }
                              }}
                            />
                          ) : (
                            <div key={f.id} className="group flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{f.name || `${f.delay_minutes} min delay`}</span>
                                  <Badge variant={f.enabled ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wider">{f.enabled ? 'Active' : 'Paused'}</Badge>
                                  <Badge variant="outline" className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-800/50">
                                    {f.delay_minutes < 60 ? `${f.delay_minutes}m` : f.delay_minutes < 1440 ? `${Math.round(f.delay_minutes / 60)}h` : `${Math.round(f.delay_minutes / 1440)}d`} delay
                                  </Badge>
                                  {f.media_type && <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800/50">{f.media_type}</Badge>}
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">{f.message}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" className="h-8 px-3" disabled={previewSending} onClick={async () => {
                                  setPreviewSending(true)
                                  try {
                                    await adminFetch('/api/admin/preview', { method: 'POST', body: JSON.stringify({ follow_up_id: f.id }) })
                                    toast.success('Preview sent to your Telegram')
                                  } catch (e) { toast.error((e as Error).message) }
                                  finally { setPreviewSending(false) }
                                }}>
                                  <SendHorizontal className="w-3.5 h-3.5 mr-1.5" /> Preview
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setFollowUpEditingId(f.id); setFollowUpAddingSegment(null); }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={async () => {
                                  if (!confirm('Delete this follow-up?')) return
                                  try {
                                    await adminFetch(`/api/admin/follow-ups/${f.id}`, { method: 'DELETE' })
                                    toast.success('Deleted')
                                    adminFetch('/api/admin/follow-ups').then((r) => setFollowUps(r.followUps || []))
                                  } catch (e) { toast.error((e as Error).message) }
                                }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                        {items.length === 0 && !followUpAddingSegment && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">No follow-ups in this group.</p>
                        )}
                      </div>
                    )}
                  </AdminCard>
                )
              })}
              </div>
            )}
          </div>
        )}

        {adminTab === 'broadcast' && !selectedUserId && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Broadcast</h3>
            </div>
          <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
              <AdminCardTitle>Send Broadcast</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-6 p-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Audience</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Claimed Status</p>
                      <FilterPills
                        value={broadcastAudienceFilters.claimed}
                        onChange={(v) => {
                          setBroadcastAudienceFilters((f) => ({ ...f, claimed: v as 'all' | 'yes' | 'no' }))
                          setBroadcastAudienceCount(null)
                        }}
                        options={[
                          { value: 'all', label: 'All Users' },
                          { value: 'yes', label: 'Claimed' },
                          { value: 'no', label: 'Not Claimed' },
                        ]}
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Referrals Status</p>
                      <FilterPills
                        value={broadcastAudienceFilters.has_referrals}
                        onChange={(v) => {
                          setBroadcastAudienceFilters((f) => ({ ...f, has_referrals: v as 'all' | 'yes' | 'no' }))
                          setBroadcastAudienceCount(null)
                        }}
                        options={[
                          { value: 'all', label: 'All Users' },
                          { value: 'yes', label: 'Has Referrals' },
                          { value: 'no', label: 'No Referrals' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 min-h-[2rem]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-[140px]"
                      disabled={broadcastAudiencePreviewing}
                      onClick={async () => {
                        setBroadcastAudiencePreviewing(true)
                        try {
                          const params = new URLSearchParams({
                            claimed: broadcastAudienceFilters.claimed,
                            has_referrals: broadcastAudienceFilters.has_referrals,
                          })
                          const r = await adminFetch(`/api/admin/broadcast/audience?${params}`)
                          setBroadcastAudienceCount(r.count ?? 0)
                          toast.success(`${r.count ?? 0} users will receive this`)
                        } catch (e) {
                          toast.error((e as Error).message)
                          setBroadcastAudienceCount(null)
                        } finally {
                          setBroadcastAudiencePreviewing(false)
                        }
                      }}
                    >
                      {broadcastAudiencePreviewing ? 'Loading...' : 'Preview audience'}
                    </Button>
                    <div className="min-w-[220px] text-sm font-semibold text-primary">
                      {broadcastAudiencePreviewing ? 'Loading...' : broadcastAudienceCount !== null ? `${broadcastAudienceCount.toLocaleString()} users will receive this` : '\u00A0'}
                    </div>
                  </div>
                </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Message</Label>
                <textarea
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm min-h-[140px] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter message to send to all users (excluding blocked)"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Media</Label>
                <div className="flex gap-2">
                  {(['none', 'image', 'gif'] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={broadcastMediaType === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setBroadcastMediaType(t); if (t === 'none') setBroadcastMediaUrl(''); }}
                    >
                      {t === 'none' ? 'None' : t === 'image' ? <><Image className="w-3.5 h-3.5 mr-1" /> Image</> : <><Film className="w-3.5 h-3.5 mr-1" /> GIF</>}
                    </Button>
                  ))}
                </div>
                {broadcastMediaType !== 'none' && (
                  <Input
                    className="mt-2"
                    placeholder="Image/GIF URL or Telegram file_id"
                    value={broadcastMediaUrl}
                    onChange={(e) => setBroadcastMediaUrl(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Buttons (optional)</Label>
                <div className="space-y-2">
                  {broadcastButtons.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Button text" value={b.text} onChange={(e) => {
                        const n = [...broadcastButtons]; n[i] = { ...n[i], text: e.target.value }; setBroadcastButtons(n);
                      }} />
                      <Input placeholder="URL" value={b.url} onChange={(e) => {
                        const n = [...broadcastButtons]; n[i] = { ...n[i], url: e.target.value }; setBroadcastButtons(n);
                      }} />
                      <Button variant="ghost" size="sm" onClick={() => setBroadcastButtons(broadcastButtons.filter((_, j) => j !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setBroadcastButtons([...broadcastButtons, { text: '', url: '' }])}>Add button</Button>
                </div>
              </div>
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  disabled={!broadcastMessage.trim() || previewSending}
                  onClick={async () => {
                    setPreviewSending(true)
                    try {
                      await adminFetch('/api/admin/preview', {
                        method: 'POST',
                        body: JSON.stringify({
                          message: broadcastMessage.trim(),
                          media_type: broadcastMediaType !== 'none' ? broadcastMediaType : undefined,
                          media_url: broadcastMediaType !== 'none' && broadcastMediaUrl ? broadcastMediaUrl : undefined,
                          buttons: broadcastButtons.filter((b) => b.text.trim() && b.url.trim()).length > 0 ? broadcastButtons.filter((b) => b.text.trim() && b.url.trim()) : undefined,
                        }),
                      })
                      toast.success('Preview sent to your Telegram')
                    } catch (e) {
                      toast.error((e as Error).message)
                    } finally {
                      setPreviewSending(false)
                    }
                  }}
                >
                  {previewSending ? 'Sending...' : 'Send Preview'}
                </Button>
                <div className="flex-1 flex items-center gap-4">
                  <Button
                    size="lg"
                    className="flex-1 sm:flex-none"
                    disabled={!broadcastMessage.trim() || broadcastSending || broadcastAudienceCount === null}
                    onClick={async () => {
                      if (!confirm(`Send this broadcast to ${broadcastAudienceCount} users?`)) return
                      setBroadcastSending(true)
                      try {
                        const r = await adminFetch('/api/admin/broadcast', {
                          method: 'POST',
                          body: JSON.stringify({
                            message: broadcastMessage.trim(),
                            media_type: broadcastMediaType !== 'none' ? broadcastMediaType : undefined,
                            media_url: broadcastMediaType !== 'none' && broadcastMediaUrl ? broadcastMediaUrl : undefined,
                            buttons: broadcastButtons.filter((b) => b.text.trim() && b.url.trim()).length > 0
                              ? broadcastButtons.filter((b) => b.text.trim() && b.url.trim())
                              : undefined,
                            audienceFilters: broadcastAudienceFilters,
                          }),
                        })
                        setLastBroadcast(r)
                        setBroadcastAudienceCount(null)
                        adminFetch('/api/admin/broadcast').then((res) => setBroadcastHistory(res.broadcasts || []))
                        toast.success(`Sent: ${r.sentCount ?? r.sent_count} | Blocked: ${r.blockedCount ?? r.blocked_count} | Errors: ${r.errorCount ?? r.error_count}`)
                      } catch (e) {
                        toast.error((e as Error).message)
                      } finally {
                        setBroadcastSending(false)
                      }
                    }}
                  >
                    {broadcastSending ? 'Sending...' : 'Send Broadcast'}
                  </Button>
                  {lastBroadcast && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Last: sent {lastBroadcast.sentCount ?? lastBroadcast.sent_count} / blocked {lastBroadcast.blockedCount ?? lastBroadcast.blocked_count} / errors {lastBroadcast.errorCount ?? lastBroadcast.error_count}
                    </p>
                  )}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          <AdminCard className="border border-zinc-200 dark:border-zinc-800 shadow-sm mt-8 overflow-hidden">
            <AdminCardHeader className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-6 py-4">
              <AdminCardTitle className="flex items-center gap-2">
                <History className="w-4 h-4" /> Broadcast History
              </AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="p-0">
            {broadcastHistoryLoading ? (
              <AdminTableSkeleton rows={5} cols={6} />
            ) : broadcastHistory.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">No broadcasts yet.</p>
            ) : (
              <AdminTable>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Date</AdminTableHead>
                    <AdminTableHead>Message</AdminTableHead>
                    <AdminTableHead>Sent</AdminTableHead>
                    <AdminTableHead>Blocked</AdminTableHead>
                    <AdminTableHead>Errors</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {broadcastHistory.slice(0, 20).map((b: any) => (
                    <AdminTableRow key={b.id}>
                      <AdminTableCell className="text-zinc-500 dark:text-zinc-400">
                        {b.finished_at ? new Date(b.finished_at).toLocaleString() : new Date(b.created_at).toLocaleString()}
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[140px] truncate">{b.message?.slice(0, 60) || '—'}…</AdminTableCell>
                      <AdminTableCell>{b.sent_count ?? 0}</AdminTableCell>
                      <AdminTableCell>{b.blocked_count ?? 0}</AdminTableCell>
                      <AdminTableCell>{b.error_count ?? 0}</AdminTableCell>
                      <AdminTableCell>
                        <Badge variant={b.status === 'finished' ? 'default' : b.status === 'sending' ? 'secondary' : 'outline'} className="text-xs">
                          {b.status}
                        </Badge>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
            </AdminCardContent>
          </AdminCard>
        </div>
        )}
        </div>
      </main>
    </div>
  )
}
