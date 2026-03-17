import { supabaseAdmin } from './supabase-admin'

export type ClaimedFilter = 'all' | 'yes' | 'no'
export type HasReferralsFilter = 'all' | 'yes' | 'no'

export type AudienceFilters = {
  claimed?: ClaimedFilter
  has_referrals?: HasReferralsFilter
}

export type BroadcastRecipient = { id: string; telegram_id: string }

/**
 * Build the list of users eligible for broadcast based on filters.
 * Uses RPC to bypass Supabase 1000-row limit. Always excludes users with bot_blocked_at.
 */
export async function getFilteredBroadcastRecipients(
  filters: AudienceFilters = {}
): Promise<BroadcastRecipient[]> {
  const claimed = filters.claimed ?? 'all'
  const hasReferrals = filters.has_referrals ?? 'all'

  const { data, error } = await supabaseAdmin.rpc('get_broadcast_recipients', {
    p_claimed: claimed,
    p_has_referrals: hasReferrals,
  })

  if (error) throw error

  const rows = (data || []) as { id: string; telegram_id: string }[]
  return rows.map((r) => ({ id: r.id, telegram_id: r.telegram_id }))
}
