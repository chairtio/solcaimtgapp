-- Migration 010: Commission, referral_payouts, and referral leaderboard
-- Supports 10% referral program: referrer gets 10% of referred user's claim

-- Add commission_percentage to referrals (10 = 10% of referred user's claim)
ALTER TABLE referrals
ADD COLUMN IF NOT EXISTS commission_percentage INTEGER DEFAULT 10;

COMMENT ON COLUMN referrals.commission_percentage IS 'Percent of referred user claim that goes to referrer. Default 10.';

-- referral_payouts: one row per referral payout (when referee claims, referrer receives their share)
CREATE TABLE IF NOT EXISTS referral_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,9) NOT NULL,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_referrer_id ON referral_payouts(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_transaction_id ON referral_payouts(transaction_id);

ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

-- No additional policies: only service role (bypasses RLS) can access. Anon/authenticated get no rows.

-- get_ref_payout_stats: returns urlRefPayout shape for bot (telegram_id -> stats)
-- Used by referralButton, referralsCommand
CREATE OR REPLACE FUNCTION get_ref_payout_stats(p_telegram_id TEXT)
RETURNS TABLE(
  total_ref_payout_amount DECIMAL,
  total_referred_users BIGINT,
  num_referred_users_made_claims BIGINT,
  commission_percentage INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH ref_user AS (
    SELECT id FROM users WHERE telegram_id = p_telegram_id LIMIT 1
  ),
  payout_sum AS (
    SELECT COALESCE(SUM(rp.amount), 0)::DECIMAL AS total
    FROM referral_payouts rp
    JOIN ref_user ru ON rp.referrer_id = ru.id
  ),
  referral_counts AS (
    SELECT
      COUNT(*)::BIGINT AS total_referred,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM wallets w
          JOIN transactions t ON t.wallet_id = w.id
          WHERE w.user_id = r.referee_id
            AND t.status = 'confirmed'
            AND t.type IN ('claim_rent', 'batch_claim')
        )
      )::BIGINT AS claimed_count
    FROM referrals r
    JOIN ref_user ru ON r.referrer_id = ru.id
  ),
  ref_commission AS (
    SELECT COALESCE(MIN(r.commission_percentage), 10)::INTEGER AS pc
    FROM referrals r
    JOIN ref_user ru ON r.referrer_id = ru.id
  )
  SELECT
    (SELECT total FROM payout_sum),
    COALESCE((SELECT total_referred FROM referral_counts), 0),
    COALESCE((SELECT claimed_count FROM referral_counts), 0),
    COALESCE((SELECT pc FROM ref_commission), 10);
$$;

-- get_referral_leaderboard: top referrers by earnings (urlLeaderboardRef shape)
-- Used by leadersRefCommand: telegram_id, num_referred_users, total_ref_payout_amount
CREATE OR REPLACE FUNCTION get_referral_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(
  rank BIGINT,
  telegram_id TEXT,
  display_name TEXT,
  num_referred_users BIGINT,
  total_ref_payout_amount DECIMAL
)
LANGUAGE sql
STABLE
AS $$
  WITH referrer_totals AS (
    SELECT
      rp.referrer_id,
      (SELECT COUNT(*)::BIGINT FROM referrals rr WHERE rr.referrer_id = rp.referrer_id) AS total_referred,
      SUM(rp.amount)::DECIMAL AS total_earnings
    FROM referral_payouts rp
    GROUP BY rp.referrer_id
    HAVING SUM(rp.amount) > 0
  ),
  ordered AS (
    SELECT * FROM referrer_totals
    ORDER BY total_earnings DESC
    LIMIT p_limit
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY o.total_earnings DESC)::BIGINT AS rank,
    u.telegram_id,
    COALESCE(u.first_name, u.username, 'Anon')::TEXT AS display_name,
    o.total_referred AS num_referred_users,
    o.total_earnings AS total_ref_payout_amount
  FROM ordered o
  JOIN users u ON u.id = o.referrer_id;
$$;
