-- Drop user_stats table and related objects (stats computed on-the-fly from transactions)
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
DROP TABLE IF EXISTS user_stats;
