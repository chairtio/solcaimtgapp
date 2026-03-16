-- Total count of distinct users who have at least one confirmed claim (for leaderboard "X users claimed")
CREATE OR REPLACE FUNCTION get_total_claiming_users()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT w.user_id)::BIGINT
  FROM transactions t
  JOIN wallets w ON t.wallet_id = w.id
  WHERE t.status = 'confirmed' AND t.type = 'claim_rent';
$$;
