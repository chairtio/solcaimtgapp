'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Shield, Users, Wallet, BarChart3, Megaphone, Mail, Send, Image, Film } from 'lucide-react'
import { toast } from 'sonner'

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
  const [stats, setStats] = useState<{
    totalUsers: number
    totalWallets: number
    usersWhoClaimed: number
    totalClaimed: number
    botBlockedCount: number
    recentSignups: { id: string; telegram_id: string; username?: string; first_name?: string; created_at: string; bot_blocked_at?: string; has_claimed: boolean }[]
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

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastMediaType, setBroadcastMediaType] = useState<'none' | 'image' | 'gif'>('none')
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState('')
  const [broadcastButtons, setBroadcastButtons] = useState<{ text: string; url: string }[]>([])
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [lastBroadcast, setLastBroadcast] = useState<any>(null)

  // Preview
  const [previewSending, setPreviewSending] = useState(false)

  useEffect(() => {
    if (adminTab === 'overview') {
      setStatsLoading(true)
      adminFetch('/api/admin/stats')
        .then(setStats)
        .catch((e) => toast.error(e.message))
        .finally(() => setStatsLoading(false))
    }
  }, [adminTab])

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

  if (selectedUserId && userDetail) {
    const followUpsSent = userDetail.followUpsSent || []
    const followUpsScheduled = userDetail.followUpsScheduled || []
    const allFollowUps = [...followUpsSent.map((f: any) => ({ ...f, status: 'sent' as const })), ...followUpsScheduled.map((f: any) => ({ ...f, status: 'scheduled' as const }))]

    return (
      <div className="space-y-6 max-w-4xl mx-auto lg:max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-black uppercase tracking-widest">User Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Telegram ID</p>
                <p className="font-mono text-sm">{userDetail.user?.telegram_id}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Username</p>
                <p>@{userDetail.user?.username || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Name</p>
                <p>{[userDetail.user?.first_name, userDetail.user?.last_name].filter(Boolean).join(' ') || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Created</p>
                <p className="text-xs">{userDetail.user?.created_at ? new Date(userDetail.user.created_at).toLocaleString() : '—'}</p>
              </div>
              {userDetail.user?.bot_blocked_at && (
                <Badge variant="destructive">Bot blocked</Badge>
              )}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Stats</p>
                <p className="text-sm">Claimed: {Number(userDetail.stats?.total_sol_claimed || 0).toFixed(4)} SOL | Accounts: {userDetail.stats?.total_accounts_closed || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Wallets</p>
                <ul className="text-xs font-mono space-y-1">
                  {(userDetail.wallets || []).map((w: any) => (
                    <li key={w.id}>{w.public_key?.slice(0, 8)}...{w.public_key?.slice(-4)} ({w.status})</li>
                  ))}
                  {(!userDetail.wallets || userDetail.wallets.length === 0) && <li>—</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-black uppercase tracking-widest">Follow-ups</CardTitle>
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
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 gap-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-base font-black text-foreground uppercase tracking-widest">Admin</h2>
          </div>
        </div>
        {navTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-left w-full ${
              adminTab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" /> {label}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-4 justify-start">
          Back
        </Button>
      </aside>

      {/* Mobile header + tabs */}
      <div className="lg:hidden flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-base font-black text-foreground uppercase tracking-widest">Admin</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
      </div>

      <Tabs value={adminTab} onValueChange={(v) => { setAdminTab(v); setSelectedUserId(null); }} className="lg:flex lg:flex-1 lg:min-w-0">
        <div className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:gap-1 lg:pb-0" aria-label="Admin navigation">
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
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold ${
                adminTab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${
                adminTab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4 outline-none">
          {statsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Users</p>
                    <p className="text-2xl font-black">{stats.totalUsers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Wallets</p>
                    <p className="text-2xl font-black">{stats.totalWallets}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Claimed</p>
                    <p className="text-2xl font-black">{stats.usersWhoClaimed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Bot Blocked</p>
                    <p className="text-2xl font-black">{stats.botBlockedCount}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Signups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">ID</th>
                          <th className="text-left py-2">User</th>
                          <th className="text-left py-2">Created</th>
                          <th className="text-left py-2">Claimed</th>
                          <th className="text-left py-2">Blocked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.recentSignups || []).slice(0, 20).map((u: any) => (
                          <tr key={u.id} className="border-b cursor-pointer hover:bg-secondary/50" onClick={() => { setSelectedUserId(u.id); setAdminTab('users'); }}>
                            <td className="py-2 font-mono">{u.telegram_id}</td>
                            <td className="py-2">@{u.username || '—'}</td>
                            <td className="py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                            <td className="py-2">{u.has_claimed ? 'Yes' : '—'}</td>
                            <td className="py-2">{u.bot_blocked_at ? 'Yes' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4 outline-none">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search telegram_id or username"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-[200px]"
            />
            <div className="flex gap-1">
              {(['all', 'not_claimed', 'blocked'] as const).map((f) => (
                <Button key={f} variant={userFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setUserFilter(f)}>
                  {f.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">ID</th>
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Created</th>
                        <th className="text-left p-2">Blocked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b cursor-pointer hover:bg-secondary/50" onClick={() => setSelectedUserId(u.id)}>
                          <td className="p-2 font-mono">{u.telegram_id}</td>
                          <td className="p-2">@{u.username || '—'}</td>
                          <td className="p-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="p-2">{u.bot_blocked_at ? 'Yes' : '—'}</td>
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
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <CardContent className="pt-4">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.status} • {c.sent_at ? `Sent ${new Date(c.sent_at).toLocaleDateString()}` : '—'}</p>
                  </CardContent>
                </Card>
              ))}
              {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="followups" className="mt-4 space-y-4 outline-none">
          {followUpsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {followUps.map((f) => (
                <Card key={f.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{f.name || `${f.delay_minutes} min`}</p>
                      <Badge variant="outline" className="text-[10px]">{f.segment === 'claimed' ? 'Claimed' : 'Not claimed'}</Badge>
                      <Badge variant={f.enabled ? 'default' : 'secondary'} className="text-[10px]">{f.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{f.message}</p>
                  </CardContent>
                </Card>
              ))}
              {followUps.length === 0 && <p className="text-sm text-muted-foreground">No follow-up messages yet.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4 space-y-4 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest">Send Broadcast</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest">Message</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[120px]"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter message to send to all users (excluding blocked)"
                />
              </div>
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest">Media</Label>
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
                <Label className="text-[11px] font-black uppercase tracking-widest">Buttons (optional)</Label>
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
                disabled={!broadcastMessage.trim() || broadcastSending}
                onClick={async () => {
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
                    }),
                    })
                    setLastBroadcast(r)
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
