-- Performance: partial index for confirmed transactions (used by get_total_claimed, get_leaderboard)
CREATE INDEX IF NOT EXISTS idx_transactions_confirmed ON transactions(wallet_id) WHERE status = 'confirmed';

-- Simplify get_total_claimed: skip join (every transaction has valid wallet_id via FK)
CREATE OR REPLACE FUNCTION get_total_claimed()
RETURNS TABLE(total_sol DECIMAL, total_accounts BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(sol_amount), 0)::DECIMAL,
    COALESCE(SUM(accounts_closed), 0)::BIGINT
  FROM transactions
  WHERE status = 'confirmed';
$$;

