-- Migration 021: Add media support to broadcast_log
ALTER TABLE broadcast_log ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE broadcast_log ADD COLUMN IF NOT EXISTS media_url TEXT;
