-- Migration 018: Set initial admin users (from bot's authorizedUserIds)
UPDATE users SET is_admin = true WHERE telegram_id IN ('387171760', '7046463711', '7142144875');
