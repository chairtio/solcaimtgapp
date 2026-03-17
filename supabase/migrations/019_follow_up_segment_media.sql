-- Migration 019: Add segment + media to follow_up_messages
ALTER TABLE follow_up_messages ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'not_claimed';
ALTER TABLE follow_up_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE follow_up_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE follow_up_messages ADD COLUMN IF NOT EXISTS name TEXT;
