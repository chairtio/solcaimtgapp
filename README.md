# SolClaim Telegram Mini App

A Telegram mini app for claiming rent from empty Solana token accounts. Built with Next.js, TypeScript, and Supabase.

## Features

- 🏠 **Wallet Scanner**: Scan Solana wallets for claimable rent
- ✅ **Automated Claims**: Batch close empty token accounts
- 🎯 **Task System**: Earn rewards through engagement
- 👥 **Referral Program**: Invite friends and earn SOL
- 🔗 **Resource Hub**: Partner platform links
- 🔒 **Secure Storage**: Encrypted private key management

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd solclaimtgapp
npm install
```

### 2. Environment Setup

```bash
cp .env.local.example .env.local
```

Fill in your environment variables:

#### Telegram Bot Setup
1. Go to [@BotFather](https://t.me/botfather) on Telegram
2. Create bot: `/newbot`
3. Copy the bot token to `.env.local`

#### Supabase Setup
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy Project URL and API keys to `.env.local`
4. Run the database migration: `supabase/migrations/001_initial_schema.sql`

### 3. Database Setup

Run the SQL migration in your Supabase dashboard:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  photo_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT,
  salt TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, public_key)
);

-- Token accounts table
CREATE TABLE token_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  account_address TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  balance BIGINT DEFAULT 0,
  rent_amount BIGINT DEFAULT 2039280,
  is_empty BOOLEAN DEFAULT TRUE,
  last_scanned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_id, account_address)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  type TEXT DEFAULT 'claim_rent' CHECK (type IN ('claim_rent', 'close_account', 'batch_claim')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  sol_amount DECIMAL(18,9) DEFAULT 0,
  accounts_closed INTEGER DEFAULT 0,
  fee_amount DECIMAL(18,9),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('telegram_share', 'twitter_share', 'referral', 'daily_checkin', 'content_creation')),
  title TEXT NOT NULL,
  description TEXT,
  reward_points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'completed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referrals table
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_claimed BOOLEAN DEFAULT FALSE,
  reward_amount DECIMAL(18,9),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

-- User stats table
CREATE TABLE user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_sol_claimed DECIMAL(18,9) DEFAULT 0,
  total_accounts_closed INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_public_key ON wallets(public_key);
CREATE INDEX idx_token_accounts_wallet_id ON token_accounts(wallet_id);
CREATE INDEX idx_token_accounts_empty ON token_accounts(is_empty) WHERE is_empty = true;
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id');
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id');

-- Similar policies for other tables
CREATE POLICY "Users can view own wallets" ON wallets FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'));
CREATE POLICY "Users can view own token accounts" ON token_accounts FOR ALL USING (wallet_id IN (SELECT id FROM wallets WHERE user_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id')));
CREATE POLICY "Users can view own transactions" ON transactions FOR ALL USING (wallet_id IN (SELECT id FROM wallets WHERE user_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id')));
CREATE POLICY "Users can view own tasks" ON tasks FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'));
CREATE POLICY "Users can view own referrals" ON referrals FOR ALL USING (referrer_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id') OR referee_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'));
CREATE POLICY "Users can view own stats" ON user_stats FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_token_accounts_updated_at BEFORE UPDATE ON token_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4. Development

```bash
npm run dev
```

Visit `http://localhost:3000` (or the port shown in terminal).

### 5. Telegram Setup

1. Set bot menu button: `/setmenubutton` in @BotFather
2. Set web app URL: `https://your-domain.com` (production) or `http://localhost:3000` (development)
3. Test the mini app by opening your bot and clicking the menu button

## Architecture

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **@tma.js/sdk** for Telegram integration
- **@solana/web3.js** for blockchain operations

### Backend
- **Next.js API Routes** for serverless functions
- **Supabase** for database and authentication
- **Row Level Security** for data protection

### Security
- **AES-256 encryption** for private keys
- **HMAC-SHA256 validation** for Telegram auth
- **PBKDF2 key derivation** with salt
- **Input validation** and sanitization

## Business Model

- **15% fee** on claimed rent (configurable)
- **Referral rewards**: 0.01 SOL per successful invite
- **Premium features**: Higher limits, priority processing
- **Partner commissions**: From platform referrals

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

### Manual Deployment
1. Build: `npm run build`
2. Start: `npm start`
3. Configure reverse proxy for production

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - see LICENSE file for details

## Security Warning

⚠️ **This application handles sensitive cryptographic keys. Always:**

- Use HTTPS in production
- Implement proper key rotation
- Regular security audits
- Monitor for suspicious activity
- Consider MPC solutions for enhanced security

**Storing user private keys carries inherent security and legal risks. Use at your own discretion.**