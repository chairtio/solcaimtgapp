-- Migration 025: Insert missing 3d/7d/14d follow-ups (022 was marked applied but never ran)
-- Adds not_claimed 3d, 7d, 14d and claimed 3d, 7d, 14d with emoji/copy from 024

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'not_claimed', 4320,
  'We noticed you haven''t claimed yet – your eligible SOL is still waiting, no expiry 🎯',
  '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}, {"text": "▶️ Tutorial", "url": "https://t.me/SolClaimPortal/149"}]'::jsonb,
  '3d still waiting', 4
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'not_claimed' AND delay_minutes = 4320);

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'not_claimed', 10080,
  'One more chance – claim free SOL from token fees. 30 sec, zero cost 💸',
  '[{"text": "🚀 Open app", "url": "https://t.me/solclaimxbot/app"}]'::jsonb,
  '7d one more chance', 5
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'not_claimed' AND delay_minutes = 10080);

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'not_claimed', 20160,
  'Final reminder: claim your rent from Raydium, Pumpfun & co before you forget 🔔',
  '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}]'::jsonb,
  '14d final nudge', 6
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'not_claimed' AND delay_minutes = 20160);

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'claimed', 4320,
  'Your friends have fees stuck too – share @solclaimxbot and earn 💰 when they claim.',
  '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb,
  '3d ref reminder', 6
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'claimed' AND delay_minutes = 4320);

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'claimed', 10080,
  'Earn 10% when friends claim 📣 Share your ref link from /referral – passive income vibes.',
  '[{"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot"}]'::jsonb,
  '7d ref nudge', 7
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'claimed' AND delay_minutes = 10080);

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort)
SELECT 'claimed', 20160,
  'One last nudge: share @solclaimxbot with friends who trade – you both win 🏆',
  '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb,
  '14d final ref', 8
WHERE NOT EXISTS (SELECT 1 FROM follow_up_messages WHERE segment = 'claimed' AND delay_minutes = 20160);
