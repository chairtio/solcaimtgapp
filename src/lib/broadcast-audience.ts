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
 * Always excludes users with bot_blocked_at.
 */
export async function getFilteredBroadcastRecipients(
  filters: AudienceFilters = {}
): Promise<BroadcastRecipient[]> {
  const claimed = filters.claimed ?? 'all'
  const hasReferrals = filters.has_referrals ?? 'all'

  const [
    { data: users },
    { data: claimedRows },
    { data: referrerRows },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id, telegram_id').is('bot_blocked_at', null),
    supabaseAdmin.from('user_claim_totals').select('user_id').eq('has_claim_rent', true),
    supabaseAdmin.from('referrals').select('referrer_id'),
  ])

  const claimedSet = new Set((claimedRows || []).map((r) => r.user_id))
  const referrerSet = new Set((referrerRows || []).map((r) => r.referrer_id))

  let filtered = (users || []) as BroadcastRecipient[]

  if (claimed === 'yes') filtered = filtered.filter((u) => claimedSet.has(u.id))
  else if (claimed === 'no') filtered = filtered.filter((u) => !claimedSet.has(u.id))

  if (hasReferrals === 'yes') filtered = filtered.filter((u) => referrerSet.has(u.id))
  else if (hasReferrals === 'no') filtered = filtered.filter((u) => !referrerSet.has(u.id))

  return filtered
}
