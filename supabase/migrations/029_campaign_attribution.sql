-- Migration 029: Campaign attribution for tracking users, wallets, app starts per campaign
-- Enables future: users attributed to campaign via ?start=camp_XXX deep link

-- Add source_code to campaigns for deep links (e.g. t.me/bot?start=camp_ABC123)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS source_code TEXT UNIQUE;

-- user_campaign_attribution: first-touch attribution when user starts via campaign link
CREATE TABLE IF NOT EXISTS user_campaign_attribution (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_campaign_attr_campaign ON user_campaign_attribution(campaign_id);
