-- Migration 011: Custom commission for verified partners
-- Add referrer_commission_percent on users (default 10). Overrides referrals.commission_percentage for verified partners.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS referrer_commission_percent INTEGER DEFAULT 10;

COMMENT ON COLUMN users.referrer_commission_percent IS 'Override commission % for verified partners. Default 10. Null uses referrals.commission_percentage.';
