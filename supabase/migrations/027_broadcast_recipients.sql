-- Migration 027: broadcast_recipients table for per-user tracking + audience_filters on broadcast_log

-- Add audience_filters to broadcast_log (store filters used for each broadcast)
ALTER TABLE broadcast_log ADD COLUMN IF NOT EXISTS audience_filters JSONB;

-- Per-recipient delivery status for drill-down and stats
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES broadcast_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'blocked', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broadcast_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
