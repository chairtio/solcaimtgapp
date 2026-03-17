-- Migration 020: Seed default drip campaign messages for not_claimed and claimed segments
-- Links: Tutorial t.me/SolClaimPortal/149, Info t.me/SolClaimPortal/162, News t.me/solclaim
-- Mini App t.me/solclaimxbot/app, Claims channel t.me/solclaim, Bot t.me/solclaimiobot

INSERT INTO follow_up_messages (segment, delay_minutes, message, buttons, name, sort) VALUES
-- Not-claimed: 30 min
('not_claimed', 30,
 'Still here? Claim your rent in 3 taps. Watch the <a href="https://t.me/SolClaimPortal/149">tutorial</a> or open the <a href="https://t.me/solclaimxbot/app">Mini App</a>.',
 NULL,
 '30min tutorial nudge',
 1),
-- Not-claimed: 2h
('not_claimed', 120,
 'You''ve got claimable SOL waiting. Join <a href="https://t.me/solclaim">@solclaim</a> for news & the <a href="https://t.me/solclaim">claims channel</a> to see others claim live.',
 NULL,
 '2h news & claims nudge',
 2),
-- Not-claimed: 24h
('not_claimed', 1440,
 'Last nudge – your wallet could have free SOL. <a href="https://t.me/SolClaimPortal/162">Learn why</a> or claim now in our <a href="https://t.me/solclaimxbot/app">Mini App</a>.',
 NULL,
 '24h last nudge',
 3),
-- Claimed: 1h
('claimed', 60,
 'Nice claim. Share your ref link and earn 10% of what friends claim. Get your link in /settings or /referral.',
 NULL,
 '1h share & earn',
 4),
-- Claimed: 24h
('claimed', 1440,
 'Your friends have fees stuck too. Share <a href="https://t.me/solclaimiobot">@solclaimiobot</a> and earn when they claim.',
 NULL,
 '24h ref reminder',
 5);
