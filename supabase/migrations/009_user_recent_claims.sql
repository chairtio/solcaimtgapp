-- Optimized RPC for recent claims: single query, only needed columns, filter in DB
CREATE OR REPLACE FUNCTION get_user_recent_claims(p_user_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE(signature TEXT, sol_amount DECIMAL, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
AS $$
  SELECT t.signature, t.sol_amount, t.created_at
  FROM transactions t
  JOIN wallets w ON t.wallet_id = w.id
  WHERE w.user_id = p_user_id
    AND t.status = 'confirmed'
    AND t.type IN ('claim_rent', 'batch_claim')
  ORDER BY t.created_at DESC
  LIMIT p_limit;
$$;
