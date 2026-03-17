'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Shield, Users, Wallet, BarChart3, Megaphone, Mail, Send, Image, Film, Download, History, ChevronDown, ChevronRight, Plus, Pencil, Trash2, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { FollowUpForm } from './FollowUpForm'
import { FilterPills } from './ui/filter-pills'

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
      <div className="space-y-6 max-w-4xl mx-auto lg:max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to users
        </Button>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">User Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Telegram ID</p>
                <p className="font-mono text-sm">{userDetail.user?.telegram_id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Username</p>
                <p>@{userDetail.user?.username || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Name</p>
                <p>{[userDetail.user?.first_name, userDetail.user?.last_name].filter(Boolean).join(' ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Created</p>
                <p className="text-xs">{userDetail.user?.created_at ? new Date(userDetail.user.created_at).toLocaleString() : '—'}</p>
              </div>
              {userDetail.user?.bot_blocked_at && (
                <Badge variant="destructive">Bot blocked</Badge>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Stats</p>
                <p className="text-sm">Claimed: {Number(userDetail.stats?.total_sol_claimed || 0).toFixed(4)} SOL | Accounts: {userDetail.stats?.total_accounts_closed || 0}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Wallets</p>
                <ul className="text-xs font-mono space-y-1">
                  {(userDetail.wallets || []).map((w: any) => (
                    <li key={w.id}>{w.public_key?.slice(0, 8)}...{w.public_key?.slice(-4)} ({w.status})</li>
                  ))}
                  {(!userDetail.wallets || userDetail.wallets.length === 0) && <li>—</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                          <td className="py-2 text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">No follow-ups sent or scheduled for this user.</p>
              )}
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
            </CardContent>
          </Card>
        </div>
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
    <div className="flex flex-col lg:flex-row lg:gap-8 lg:max-w-7xl mx-auto pb-24">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 gap-1 lg:border-r lg:border-border/50 lg:pr-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Admin</h2>
          </div>
        </div>
        {navTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-left w-full transition-colors ${
              adminTab === id ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" /> {label}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-full justify-start gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </aside>

      {/* Mobile header + tabs */}
      <div className="lg:hidden flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Admin</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
      </div>

      <Tabs value={adminTab} onValueChange={(v) => { setAdminTab(v); setSelectedUserId(null); }} className="flex flex-col lg:flex-1 lg:min-w-0">
        <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
            { id: 'followups', label: 'Follow-ups', icon: Mail },
            { id: 'broadcast', label: 'Broadcast', icon: Send },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAdminTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                adminTab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <TabsContent value="overview" className="mt-4 space-y-6 outline-none">
          <h3 className="text-lg font-semibold text-foreground">Overview</h3>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Date range</p>
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
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : stats ? (
            <>
              {stats.range && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">New signups</p>
                      <p className="text-xl font-semibold">{stats.newSignups ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">New claims</p>
                      <p className="text-xl font-semibold">{stats.newClaims ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">Campaigns sent</p>
                      <p className="text-xl font-semibold">{stats.campaignsSent ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">Campaigns scheduled</p>
                      <p className="text-xl font-semibold">{stats.campaignsScheduled ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">Broadcasts sent</p>
                      <p className="text-xl font-semibold">{stats.broadcastsSent ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-medium text-muted-foreground">Follow-ups sent</p>
                      <p className="text-xl font-semibold">{stats.followUpsSent ?? 0}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
              <div className="border-t border-border/50 pt-6 mt-6">
                <p className="text-sm font-medium text-muted-foreground mb-4">All time</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-semibold">{stats.totalUsers}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Wallets</p>
                    <p className="text-2xl font-semibold">{stats.totalWallets}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Claimed</p>
                    <p className="text-2xl font-semibold">{stats.usersWhoClaimed}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Bot Blocked</p>
                    <p className="text-2xl font-semibold">{stats.botBlockedCount}</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Recent Signups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claimed</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Blocked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.recentSignups || []).slice(0, 20).map((u: any) => (
                          <tr key={u.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedUserId(u.id); setAdminTab('users'); }}>
                            <td className="py-3 px-4 font-mono">{u.telegram_id}</td>
                            <td className="py-3 px-4">@{u.username || '—'}</td>
                            <td className="py-3 px-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">{u.has_claimed ? 'Yes' : '—'}</td>
                            <td className="py-3 px-4">{u.bot_blocked_at ? 'Yes' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4 outline-none">
          <div className="flex gap-2 flex-wrap items-center">
            <Input
              placeholder="Search telegram_id or username"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-[200px]"
            />
            <Button
              variant="outline"
              size="sm"
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
              <Download className="w-3.5 h-3.5 mr-1" /> {exportLoading ? 'Exporting...' : 'Export CSV'}
            </Button>
            <FilterPills
              value={userFilter}
              onChange={(v) => setUserFilter(v as 'all' | 'not_claimed' | 'blocked')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'not_claimed', label: 'Not claimed' },
                { value: 'blocked', label: 'Blocked' },
              ]}
            />
          </div>
          {usersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <Card className="border-border/60 shadow-sm">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Users className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No users match your filters.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Blocked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedUserId(u.id)}>
                          <td className="py-3 px-4 font-mono">{u.telegram_id}</td>
                          <td className="py-3 px-4">@{u.username || '—'}</td>
                          <td className="py-3 px-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4">{u.bot_blocked_at ? 'Yes' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4 outline-none">
          {campaignsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id} className="border-border/60 shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{c.name}</p>
                      <Badge
                        variant={c.status === 'sent' ? 'default' : c.status === 'scheduled' ? 'secondary' : c.status === 'cancelled' ? 'destructive' : 'outline'}
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.sent_at ? `Sent ${new Date(c.sent_at).toLocaleString()}` : c.scheduled_at ? `Scheduled ${new Date(c.scheduled_at).toLocaleString()}` : '—'}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {campaigns.length === 0 && (
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Megaphone className="w-12 h-12 text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No campaigns yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">Create campaigns to send scheduled messages and track performance.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="followups" className="mt-4 space-y-4 outline-none">
          {followUpsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(['not_claimed', 'claimed'] as const).map((segment) => {
                const items = followUps.filter((f) => (f.segment || 'not_claimed') === segment)
                const isOpen = followUpExpandedGroups[segment] !== false
                const label = segment === 'not_claimed' ? 'Not claimed' : 'Claimed'
                return (
                  <Card key={segment} className="border-border/60 shadow-sm">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
                      onClick={() => setFollowUpExpandedGroups((g) => ({ ...g, [segment]: !isOpen }))}
                    >
                      <span className="text-sm font-semibold flex items-center gap-2">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {label} ({items.length})
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={(e) => { e.stopPropagation(); setFollowUpAddingSegment(s => s === segment ? null : segment); setFollowUpEditingId(null); }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </button>
                    {isOpen && (
                      <CardContent className="pt-0 pb-4 space-y-3">
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
                            <div key={f.id} className="flex flex-wrap items-start justify-between gap-2 p-3 rounded-lg border bg-card">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-sm">{f.name || `${f.delay_minutes} min delay`}</p>
                                  <Badge variant={f.enabled ? 'default' : 'secondary'} className="text-[10px]">{f.enabled ? 'On' : 'Off'}</Badge>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {f.delay_minutes < 60 ? `${f.delay_minutes}m` : f.delay_minutes < 1440 ? `${Math.round(f.delay_minutes / 60)}h` : `${Math.round(f.delay_minutes / 1440)}d`}
                                  </Badge>
                                  {f.media_type && <Badge variant="outline" className="text-[10px]">{f.media_type}</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.message}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-7" disabled={previewSending} onClick={async () => {
                                  setPreviewSending(true)
                                  try {
                                    await adminFetch('/api/admin/preview', { method: 'POST', body: JSON.stringify({ follow_up_id: f.id }) })
                                    toast.success('Preview sent to your Telegram')
                                  } catch (e) { toast.error((e as Error).message) }
                                  finally { setPreviewSending(false) }
                                }}>
                                  <SendHorizontal className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="outline" size="sm" className="h-7" onClick={() => { setFollowUpEditingId(f.id); setFollowUpAddingSegment(null); }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={async () => {
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
                          <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups in this group.</p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4 space-y-4 outline-none">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Send Broadcast</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Audience — preview first, then send.</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Claimed</p>
                    <FilterPills
                      value={broadcastAudienceFilters.claimed}
                      onChange={(v) => {
                        setBroadcastAudienceFilters((f) => ({ ...f, claimed: v as 'all' | 'yes' | 'no' }))
                        setBroadcastAudienceCount(null)
                      }}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'yes', label: 'Claimed' },
                        { value: 'no', label: 'Not claimed' },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Referrals</p>
                    <FilterPills
                      value={broadcastAudienceFilters.has_referrals}
                      onChange={(v) => {
                        setBroadcastAudienceFilters((f) => ({ ...f, has_referrals: v as 'all' | 'yes' | 'no' }))
                        setBroadcastAudienceCount(null)
                      }}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'yes', label: 'Has invited friends' },
                        { value: 'no', label: 'No referrals' },
                      ]}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
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
                  {broadcastAudienceCount !== null && (
                    <span className="text-sm font-semibold text-primary">{broadcastAudienceCount.toLocaleString()} users will receive this</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Message</Label>
                <textarea
                  className="mt-1.5 w-full rounded-xl border border-input/80 bg-background px-3 py-2.5 text-sm min-h-[140px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter message to send to all users (excluding blocked)"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Media</Label>
                <div className="mt-1 flex gap-2">
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
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Buttons (optional)</Label>
                <div className="mt-1 space-y-2">
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
              <div className="flex gap-2">
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
                  {previewSending ? 'Sending...' : 'Preview'}
                </Button>
              </div>
              <Button
                size="lg"
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
                <p className="text-xs text-muted-foreground">
                  Last: sent {lastBroadcast.sentCount ?? lastBroadcast.sent_count} / blocked {lastBroadcast.blockedCount ?? lastBroadcast.blocked_count} / errors {lastBroadcast.errorCount ?? lastBroadcast.error_count}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="w-4 h-4" /> Broadcast History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {broadcastHistoryLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : broadcastHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No broadcasts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Message</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sent</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Blocked</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Errors</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {broadcastHistory.slice(0, 20).map((b: any) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground">
                            {b.finished_at ? new Date(b.finished_at).toLocaleString() : new Date(b.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 max-w-[140px] truncate">{b.message?.slice(0, 60) || '—'}…</td>
                          <td className="py-3 px-4">{b.sent_count ?? 0}</td>
                          <td className="py-3 px-4">{b.blocked_count ?? 0}</td>
                          <td className="py-3 px-4">{b.error_count ?? 0}</td>
                          <td className="py-3 px-4">
                            <Badge variant={b.status === 'finished' ? 'default' : b.status === 'sending' ? 'secondary' : 'outline'} className="text-[10px]">
                              {b.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
