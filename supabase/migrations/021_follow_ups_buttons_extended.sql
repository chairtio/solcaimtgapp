-- Migration 021: Update follow-up messages with converting copy + buttons, add 3d/7d/14d follow-ups
-- Bot: @solclaimxbot, Mini App: app.solclaim.io

-- A. Update existing 5 rows with new copy and buttons
UPDATE follow_up_messages SET
  message = 'You''ve got claimable SOL waiting. Claim in 3 taps – no gas needed. See how it works.',
  buttons = '[{"text": "Claim now", "url": "https://app.solclaim.io"}, {"text": "Watch tutorial", "url": "https://t.me/SolClaimPortal/149"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 30;

UPDATE follow_up_messages SET
  message = 'Thousands have claimed already. Your wallet might have free SOL from Raydium, Pumpfun, and more.',
  buttons = '[{"text": "Open Mini App", "url": "https://app.solclaim.io"}, {"text": "Join community", "url": "https://t.me/SolClaimChat"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 120;

UPDATE follow_up_messages SET
  message = 'Last reminder – free SOL could be sitting in your wallet. Takes 30 seconds to check.',
  buttons = '[{"text": "Claim now", "url": "https://app.solclaim.io"}, {"text": "Learn more", "url": "https://t.me/SolClaimPortal/162"}]'::jsonb
WHERE segment = 'not_claimed' AND delay_minutes = 1440;

UPDATE follow_up_messages SET
  message = 'Nice claim. Share your link and earn 10% of what friends claim. Get your link in /settings or /referral.',
  buttons = '[{"text": "Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 60;

UPDATE follow_up_messages SET
  message = 'Your friends have fees stuck too. Share @solclaimxbot and earn when they claim.',
  buttons = '[{"text": "Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 1440;

-- B. Insert new rows for 3d, 7d, 14d (not_claimed and claimed)
INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort) VALUES
-- not_claimed 3d (4320 min)
('not_claimed', 4320,
 'We noticed you haven''t claimed yet. Your eligible SOL is still waiting – no expiry.',
 '[{"text": "Claim now", "url": "https://app.solclaim.io"}]'::jsonb,
 '3d still waiting',
 4),
-- not_claimed 7d (10080 min)
('not_claimed', 10080,
 'One more chance – claim free SOL from token fees. 30 seconds, zero cost.',
 '[{"text": "Open app", "url": "https://app.solclaim.io"}]'::jsonb,
 '7d one more chance',
 5),
-- not_claimed 14d (20160 min)
('not_claimed', 20160,
 'Final reminder: claim your rent from Raydium, Pumpfun, etc. before you forget.',
 '[{"text": "Claim now", "url": "https://app.solclaim.io"}]'::jsonb,
 '14d final nudge',
 6),
-- claimed 3d
('claimed', 4320,
 'Your friends have fees stuck too. Share @solclaimxbot and earn when they claim.',
 '[{"text": "Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb,
 '3d ref reminder',
 6),
-- claimed 7d
('claimed', 10080,
 'Earn 10% when friends claim. Share your ref link from /referral – it''s passive income.',
 '[{"text": "Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb,
 '7d ref nudge',
 7),
-- claimed 14d
('claimed', 20160,
 'One last nudge: share @solclaimxbot with friends who trade – you both win.',
 '[{"text": "Open bot", "url": "https://t.me/solclaimxbot"}]'::jsonb,
 '14d final ref',
 8);
