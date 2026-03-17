-- Ad campaigns: trackable campaigns for Telegram ads (separate from message campaigns)
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_code TEXT UNIQUE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- First-touch attribution: one row per user
CREATE TABLE IF NOT EXISTS ad_campaign_attribution (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_attribution_campaign ON ad_campaign_attribution(ad_campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_source_code ON ad_campaigns(source_code);
