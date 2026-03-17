-- Migration 017: Campaigns, follow-up messages, broadcast log

-- campaigns: one-time scheduled messages
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  buttons JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- follow_up_messages: automated reminders by delay
CREATE TABLE IF NOT EXISTS follow_up_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delay_minutes INTEGER NOT NULL,
  message TEXT NOT NULL,
  buttons JSONB,
  enabled BOOLEAN DEFAULT true,
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- follow_up_sent: avoid sending same follow-up twice to same user
CREATE TABLE IF NOT EXISTS follow_up_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follow_up_id UUID NOT NULL REFERENCES follow_up_messages(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, follow_up_id)
);
CREATE INDEX IF NOT EXISTS idx_follow_up_sent_user ON follow_up_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_sent_follow_up ON follow_up_sent(follow_up_id);

-- broadcast_log: track sends and per-user results
CREATE TABLE IF NOT EXISTS broadcast_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  buttons JSONB,
  total_recipients INTEGER,
  sent_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'finished', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
