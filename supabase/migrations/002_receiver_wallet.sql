-- Add receiver_wallet to users - where claimed SOL is sent
ALTER TABLE users ADD COLUMN receiver_wallet TEXT;
