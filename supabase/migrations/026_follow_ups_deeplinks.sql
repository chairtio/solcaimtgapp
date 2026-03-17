-- Migration 026: Fix referral/settings/bot buttons – use deep links so they work
-- ?start=referral -> shows referral link UI, ?start=settings -> settings, ?start=menu -> menu

-- claimed 1h: Get ref link, Settings
UPDATE follow_up_messages SET
  buttons = '[{"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot?start=referral"}, {"text": "⚙️ Settings", "url": "https://t.me/solclaimxbot?start=settings"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 60;

-- claimed 24h: Open bot, Get ref link
UPDATE follow_up_messages SET
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot?start=menu"}, {"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot?start=referral"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 1440;

-- claimed 3d: Open bot
UPDATE follow_up_messages SET
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot?start=menu"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 4320;

-- claimed 7d: Get ref link
UPDATE follow_up_messages SET
  buttons = '[{"text": "🤝 Get ref link", "url": "https://t.me/solclaimxbot?start=referral"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 10080;

-- claimed 14d: Open bot
UPDATE follow_up_messages SET
  buttons = '[{"text": "🤖 Open bot", "url": "https://t.me/solclaimxbot?start=menu"}]'::jsonb
WHERE segment = 'claimed' AND delay_minutes = 20160;
