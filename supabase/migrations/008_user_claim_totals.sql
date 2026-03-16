-- Pre-aggregated stats: O(users) instead of O(transactions) for platform-wide queries
-- Dramatically speeds up get_total_claimed, get_leaderboard, get_total_claiming_users, get_user_stats

-- Summary table: one row per user with confirmed claims
CREATE TABLE IF NOT EXISTS user_claim_totals (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_sol DECIMAL(18,9) NOT NULL DEFAULT 0,
  total_accounts BIGINT NOT NULL DEFAULT 0,
  has_claim_rent BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_claim_totals_total_sol ON user_claim_totals(total_sol DESC);

-- Trigger: maintain user_claim_totals on transaction insert/update
CREATE OR REPLACE FUNCTION sync_user_claim_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_sol DECIMAL := 0;
  v_accts BIGINT := 0;
  v_is_claim BOOLEAN := FALSE;
BEGIN
  -- Resolve user_id from wallet
  SELECT user_id INTO v_user_id FROM wallets WHERE id = COALESCE(NEW.wallet_id, OLD.wallet_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- On INSERT: add if confirmed
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' THEN
      v_sol := NEW.sol_amount;
      v_accts := COALESCE(NEW.accounts_closed, 0);
      v_is_claim := NEW.type IN ('claim_rent', 'batch_claim');
      INSERT INTO user_claim_totals (user_id, total_sol, total_accounts, has_claim_rent, updated_at)
        VALUES (v_user_id, v_sol, v_accts, v_is_claim, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          total_sol = user_claim_totals.total_sol + EXCLUDED.total_sol,
          total_accounts = user_claim_totals.total_accounts + EXCLUDED.total_accounts,
          has_claim_rent = user_claim_totals.has_claim_rent OR EXCLUDED.has_claim_rent,
          updated_at = NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: handle status changes
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
      -- Remove from totals (has_claim_rent stays true; reversal is rare)
      UPDATE user_claim_totals SET
        total_sol = GREATEST(0, total_sol - OLD.sol_amount),
        total_accounts = GREATEST(0, total_accounts - COALESCE(OLD.accounts_closed, 0)),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSIF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      -- Add to totals
      v_sol := NEW.sol_amount;
      v_accts := COALESCE(NEW.accounts_closed, 0);
      v_is_claim := NEW.type IN ('claim_rent', 'batch_claim');
      INSERT INTO user_claim_totals (user_id, total_sol, total_accounts, has_claim_rent, updated_at)
        VALUES (v_user_id, v_sol, v_accts, v_is_claim, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          total_sol = user_claim_totals.total_sol + EXCLUDED.total_sol,
          total_accounts = user_claim_totals.total_accounts + EXCLUDED.total_accounts,
          has_claim_rent = user_claim_totals.has_claim_rent OR EXCLUDED.has_claim_rent,
          updated_at = NOW();
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'confirmed' AND (OLD.sol_amount != NEW.sol_amount OR COALESCE(OLD.accounts_closed, 0) != COALESCE(NEW.accounts_closed, 0)) THEN
      -- Amount correction
      UPDATE user_claim_totals SET
        total_sol = total_sol - OLD.sol_amount + NEW.sol_amount,
        total_accounts = total_accounts - COALESCE(OLD.accounts_closed, 0) + COALESCE(NEW.accounts_closed, 0),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_claim_totals ON transactions;
CREATE TRIGGER trg_sync_user_claim_totals
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_user_claim_totals();

-- Backfill from existing confirmed transactions
INSERT INTO user_claim_totals (user_id, total_sol, total_accounts, has_claim_rent)
SELECT
  w.user_id,
  SUM(t.sol_amount),
  SUM(COALESCE(t.accounts_closed, 0)),
  BOOL_OR(t.type IN ('claim_rent', 'batch_claim'))
FROM transactions t
JOIN wallets w ON t.wallet_id = w.id
WHERE t.status = 'confirmed'
GROUP BY w.user_id
ON CONFLICT (user_id) DO UPDATE SET
  total_sol = EXCLUDED.total_sol,
  total_accounts = EXCLUDED.total_accounts,
  has_claim_rent = user_claim_totals.has_claim_rent OR EXCLUDED.has_claim_rent,
  updated_at = NOW();

-- Index for recent claims: fetch user's transactions ordered by created_at
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created ON transactions(wallet_id, created_at DESC);

-- RPCs: read from user_claim_totals (instant)
CREATE OR REPLACE FUNCTION get_total_claimed()
RETURNS TABLE(total_sol DECIMAL, total_accounts BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(total_sol), 0)::DECIMAL,
    COALESCE(SUM(total_accounts), 0)::BIGINT
  FROM user_claim_totals;
$$;

CREATE OR REPLACE FUNCTION get_total_claiming_users()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT FROM user_claim_totals WHERE has_claim_rent;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(rank BIGINT, user_id UUID, total_sol DECIMAL, total_accounts BIGINT, display_name TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY uct.total_sol DESC)::BIGINT AS rank,
    uct.user_id,
    uct.total_sol,
    uct.total_accounts,
    COALESCE(u.first_name, u.username, 'Anon')::TEXT AS display_name
  FROM user_claim_totals uct
  JOIN users u ON u.id = uct.user_id
  WHERE uct.total_sol > 0
  ORDER BY uct.total_sol DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(total_sol_claimed DECIMAL, total_accounts_closed BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(uct.total_sol, 0)::DECIMAL,
    COALESCE(uct.total_accounts, 0)::BIGINT
  FROM (SELECT p_user_id AS id) u
  LEFT JOIN user_claim_totals uct ON uct.user_id = u.id;
$$;
