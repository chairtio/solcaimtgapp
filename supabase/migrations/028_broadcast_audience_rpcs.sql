-- Migration 028: RPCs for broadcast audience to bypass Supabase 1000-row limit
-- get_broadcast_audience_count: returns count and breakdown (no row limit)
-- get_broadcast_recipients: returns (id, telegram_id) for all matching users

CREATE OR REPLACE FUNCTION get_broadcast_audience_count(p_claimed text DEFAULT 'all', p_has_referrals text DEFAULT 'all')
RETURNS TABLE(
  count bigint,
  claimed bigint,
  not_claimed bigint,
  has_referrals bigint,
  no_referrals bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count bigint;
  v_claimed bigint;
  v_not_claimed bigint;
  v_has_referrals bigint;
  v_no_referrals bigint;
BEGIN
  -- Breakdown counts (non-blocked users only)
  SELECT COUNT(*) INTO v_claimed
  FROM users u
  INNER JOIN user_claim_totals uct ON uct.user_id = u.id AND uct.has_claim_rent = true
  WHERE u.bot_blocked_at IS NULL;

  SELECT COUNT(*) INTO v_has_referrals
  FROM users u
  WHERE u.bot_blocked_at IS NULL
    AND EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id);

  SELECT COUNT(*) INTO v_no_referrals
  FROM users u
  WHERE u.bot_blocked_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id);

  SELECT (SELECT COUNT(*) FROM users u WHERE u.bot_blocked_at IS NULL) - v_claimed INTO v_not_claimed;

  -- Filtered count
  SELECT COUNT(*) INTO v_count
  FROM users u
  WHERE u.bot_blocked_at IS NULL
    AND (p_claimed = 'all' OR
         (p_claimed = 'yes' AND EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = true)) OR
         (p_claimed = 'no' AND (NOT EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = true) OR
                               EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = false))))
    AND (p_has_referrals = 'all' OR
         (p_has_referrals = 'yes' AND EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id)) OR
         (p_has_referrals = 'no' AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id)));

  RETURN QUERY SELECT v_count, v_claimed, v_not_claimed, v_has_referrals, v_no_referrals;
END;
$$;

CREATE OR REPLACE FUNCTION get_broadcast_recipients(p_claimed text DEFAULT 'all', p_has_referrals text DEFAULT 'all')
RETURNS TABLE(id uuid, telegram_id text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT u.id, u.telegram_id
  FROM users u
  WHERE u.bot_blocked_at IS NULL
    AND (p_claimed = 'all' OR
         (p_claimed = 'yes' AND EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = true)) OR
         (p_claimed = 'no' AND (NOT EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = true) OR
                               EXISTS (SELECT 1 FROM user_claim_totals uct WHERE uct.user_id = u.id AND uct.has_claim_rent = false))))
    AND (p_has_referrals = 'all' OR
         (p_has_referrals = 'yes' AND EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id)) OR
         (p_has_referrals = 'no' AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id)));
$$;
