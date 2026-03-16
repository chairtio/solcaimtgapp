-- Migration 012: Task definitions, user completions, and XP for SolClaim tasks
-- Replaces legacy tasks table usage with global task_definitions + user progress

-- task_definitions: global catalog of available tasks (seeded from xano/tasks.csv)
-- Excludes: 10 (BuyBot), 11 (Trade Memecoin), 16-17 (ElementalBlast), 24 (ready=0)
CREATE TABLE IF NOT EXISTS task_definitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'basic' CHECK (type IN ('basic', 'premium')),
  url TEXT,
  icon TEXT,
  button_text TEXT,
  verification_type TEXT NOT NULL CHECK (verification_type IN (
    'auto_db_claim', 'auto_tg_name', 'auto_tg_channel', 'auto_tg_bio', 'auto_referral', 'manual'
  )),
  sort INTEGER NOT NULL DEFAULT 0,
  telegram_channel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- user_task_completions: which tasks each user has completed
CREATE TABLE IF NOT EXISTS user_task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_definition_id TEXT NOT NULL REFERENCES task_definitions(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_user_task_completions_user_id ON user_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task_id ON user_task_completions(task_definition_id);

-- user_task_points: XP accumulated from completed tasks (for level calculation)
CREATE TABLE IF NOT EXISTS user_task_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  experience_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed task_definitions with 11 SolClaim tasks (exclude 10, 11, 16, 17, 24)
INSERT INTO task_definitions (id, title, description, points, type, url, icon, button_text, verification_type, sort, telegram_channel) VALUES
  ('claim_bot', 'Claim FREE SOL With @solclaimiobot', 'Use the @solclaimiobot to claim free SOL and get points now.', 50, 'basic', 'https://t.me/solclaimxbot', '💰', '👀 Watch Tutorial', 'auto_db_claim', 1, NULL),
  ('join_news_channel', 'Join The @solclaim News Channel', 'Stay updated with SolClaim news and announcements.', 20, 'basic', 'https://t.me/solclaim', '🚨', '🚨 Join Channel', 'auto_tg_channel', 2, 'solclaim'),
  ('join_community', 'Join The @solclaimchat Community', 'Join the SolClaim community chat.', 20, 'basic', 'https://t.me/SolClaimChat', '💬', '💬 Join Community', 'auto_tg_channel', 3, 'SolClaimChat'),
  ('add_solclaim_name', 'Add $SOLCLAIM To Your Name', 'Add $SOLCLAIM to your first or last name and earn extra points for the airdrop.', 100, 'premium', 'tg://settings', '➕', '⚙️ Open Settings', 'auto_tg_name', 4, NULL),
  ('referral_link_bio', 'Put Your Referral Link In Your Bio', 'Add your referral link in your bio to earn points.', 100, 'premium', 'tg://settings', '🔗', '⚙️ Open Settings', 'auto_tg_bio', 5, NULL),
  ('refer_5_people', 'Refer 5 People That Claim SOL', 'Share your link with 5 friends and make sure they claim their FREE SOL with @solclaimiobot.', 500, 'premium', NULL, '💸', '💬 Share Referral Link', 'auto_referral', 6, NULL),
  ('share_story', 'Share $SOLCLAIM On Your Story', 'Share SolClaim on your story and earn points.', 50, 'basic', 'https://t.me/solclaim/162', '📸', '📸 Share Story', 'manual', 7, NULL),
  ('follow_x', 'Follow @solclaimx on X', 'Follow SolClaim on X (Twitter) for updates.', 20, 'basic', 'https://x.com/solclaimx', '🐤', '🐤 Follow Now', 'manual', 8, NULL),
  ('join_trending', 'Join @SolClaimTrending Channel', 'SolClaim Trending will soon feature the most trending tokens on Solana!', 20, 'basic', 'https://t.me/SolClaimTrending', '⚡️', '⚡️ Join Trending Channel', 'auto_tg_channel', 9, 'SolClaimTrending'),
  ('share_post_x', 'Share Post on X', 'Share the SolClaim airdrop post on X.', 20, 'basic', 'https://twitter.com/intent/tweet?text=Join%20the%20%23SolClaim%20Airdrop!%20Over%20%24500k%20SOL%20given%20away%20already.%20Follow%20%40SolClaimx.%20https%3A%2F%2Fx.com%2Fsolclaimx%2Fstatus%2F1843315670035136772', '🐥', '🐥 Tweet Now', 'manual', 10, NULL),
  ('retweet_x', 'Retweet SolClaim post on X', 'Retweet the official SolClaim post.', 20, 'basic', 'https://x.com/solclaimx/status/1822855501367103654', '♻️', '♻️ Retweet Now', 'manual', 11, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_points ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. No additional policies for anon/authenticated - server actions use supabaseAdmin.
