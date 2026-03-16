-- Platform-wide total SOL claimed (for stats page)
CREATE OR REPLACE FUNCTION get_total_claimed()
RETURNS TABLE(total_sol DECIMAL, total_accounts BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(t.sol_amount), 0)::DECIMAL,
    COALESCE(SUM(t.accounts_closed), 0)::BIGINT
  FROM transactions t
  JOIN wallets w ON t.wallet_id = w.id
  WHERE t.status = 'confirmed';
$$;
