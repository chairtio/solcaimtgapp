-- Migration 024: Mini App URL fix (t.me/solclaimxbot/app) + emojis, punchier copy, all buttons
-- Consolidates 022 and 023 for clean apply (021 duplicate issue workaround)

-- not_claimed 30 min
UPDATE follow_up_messages SET
  message = 'You''ve got claimable SOL waiting 💸 Claim in 3 taps – no gas. See how it works.',
  buttons = '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}, {"text": "▶️ Watch tutorial", "url": "https://t.me/SolClaimPortal/149"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 30;

-- not_claimed 2h
UPDATE follow_up_messages SET
  message = 'Thousands have claimed already ✨ Your wallet might have free SOL from Raydium, Pumpfun & more.',
  buttons = '[{"text": "🚀 Open Mini App", "url": "https://t.me/solclaimxbot/app"}, {"text": "💬 Join community", "url": "https://t.me/SolClaimChat"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 120;

-- not_claimed 24h
UPDATE follow_up_messages SET
  message = 'Last reminder – free SOL could be sitting in your wallet 🔥 Takes 30 seconds to check.',
  buttons = '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}, {"text": "📖 Learn more", "url": "https://t.me/SolClaimPortal/162"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 1440;

-- not_claimed 3d
UPDATE follow_up_messages SET
  message = 'We noticed you haven''t claimed yet – your eligible SOL is still waiting, no expiry 🎯',
  buttons = '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}, {"text": "▶️ Tutorial", "url": "https://t.me/SolClaimPortal/149"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 4320;

-- not_claimed 7d
UPDATE follow_up_messages SET
  message = 'One more chance – claim free SOL from token fees. 30 sec, zero cost 💸',
  buttons = '[{"text": "🚀 Open app", "url": "https://t.me/solclaimxbot/app"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 10080;

-- not_claimed 14d
UPDATE follow_up_messages SET
  message = 'Final reminder: claim your rent from Raydium, Pumpfun & co before you forget 🔔',
  buttons = '[{"text": "💰 Claim now", "url": "https://t.me/solclaimxbot/app"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 20160;

-- claimed 1h
UPDATE follow_up_messages SET
  message = 'Nice claim 🎉 Share your link & earn 10% when friends claim – get it in /settings or /referral.',
  buttons = '[{"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot"}, {"text": "⚙️ Settings", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 60;

-- claimed 24h
UPDATE follow_up_messages SET
  message = 'Your friends have fees stuck too 😏 Share @solclaimxbot and earn when they claim.',
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot"}, {"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 1440;

-- claimed 3d
UPDATE follow_up_messages SET
  message = 'Your friends have fees stuck too – share @solclaimxbot and earn 💰 when they claim.',
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 4320;

-- claimed 7d
UPDATE follow_up_messages SET
  message = 'Earn 10% when friends claim 📣 Share your ref link from /referral – passive income vibes.',
  buttons = '[{"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 10080;

-- claimed 14d
UPDATE follow_up_messages SET
  message = 'One last nudge: share @solclaimxbot with friends who trade – you both win 🏆',
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 20160;
