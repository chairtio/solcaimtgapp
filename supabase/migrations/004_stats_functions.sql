-- Stats computed on-the-fly from transactions (replaces user_stats table)

-- Returns (0,0) when user has no wallets or transactions
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(total_sol_claimed DECIMAL, total_accounts_closed BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(t.sol_amount), 0)::DECIMAL,
    COALESCE(SUM(t.accounts_closed), 0)::BIGINT
  FROM wallets w
  LEFT JOIN transactions t ON t.wallet_id = w.id AND t.status = 'confirmed'
  WHERE w.user_id = p_user_id
  GROUP BY w.user_id;
$$;

-- Leaderboard: top users by total SOL claimed
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(rank BIGINT, user_id UUID, total_sol DECIMAL, total_accounts BIGINT, display_name TEXT)
LANGUAGE sql
STABLE
AS $$
  WITH ranked AS (
    SELECT
      w.user_id,
      SUM(t.sol_amount) AS total_sol,
      SUM(t.accounts_closed) AS total_accounts
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.id
    WHERE t.status = 'confirmed'
    GROUP BY w.user_id
    HAVING SUM(t.sol_amount) > 0
    ORDER BY SUM(t.sol_amount) DESC
    LIMIT p_limit
  )
  SELECT
    ROW_NUMBER() OVER ()::BIGINT AS rank,
    r.user_id,
    r.total_sol,
    r.total_accounts,
    COALESCE(u.first_name, u.username, 'Anon')::TEXT AS display_name
  FROM ranked r
  JOIN users u ON u.id = r.user_id;
$$;
