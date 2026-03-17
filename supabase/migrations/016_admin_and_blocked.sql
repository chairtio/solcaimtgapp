-- Migration 016: Admin flag and bot-blocked tracking on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_blocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_bot_blocked ON users(bot_blocked_at) WHERE bot_blocked_at IS NOT NULL;
