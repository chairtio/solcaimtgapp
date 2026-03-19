-- Migration 031: Wallet privacy hardening

-- 1) Prevent anon/auth clients from selecting the secret column.
-- Note: even with RLS, column privileges still matter for exfiltration.
REVOKE SELECT (encrypted_private_key) ON wallets FROM anon;
REVOKE SELECT (encrypted_private_key) ON wallets FROM authenticated;

-- 2) Public wallet view (no secret-bearing columns).
CREATE OR REPLACE VIEW wallets_public AS
SELECT
  id,
  user_id,
  public_key,
  status,
  created_at,
  updated_at
FROM wallets;

GRANT SELECT ON wallets_public TO anon;
GRANT SELECT ON wallets_public TO authenticated;

-- 3) Defense-in-depth: enforce RLS on wallet-related tables.
-- This can affect elevated roles; validate in staging.
ALTER TABLE wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE token_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

-- 4) Tighten RLS semantics: add explicit WITH CHECK for write operations.
-- These policies were originally created in `001_initial_schema.sql` using only USING.

ALTER POLICY "Users can view own wallets" ON wallets
USING (
  user_id IN (
    SELECT id
    FROM users
    WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
  )
)
WITH CHECK (
  user_id IN (
    SELECT id
    FROM users
    WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
  )
);

ALTER POLICY "Users can view own token accounts" ON token_accounts
USING (
  wallet_id IN (
    SELECT id
    FROM wallets
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  )
)
WITH CHECK (
  wallet_id IN (
    SELECT id
    FROM wallets
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  )
);

ALTER POLICY "Users can view own transactions" ON transactions
USING (
  wallet_id IN (
    SELECT id
    FROM wallets
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  )
)
WITH CHECK (
  wallet_id IN (
    SELECT id
    FROM wallets
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  )
);

