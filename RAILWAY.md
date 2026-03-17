# Deploy SolClaim Mini App + Bot on Railway

Run both the Next.js mini app and Telegram bot on Railway with shared env vars. No separate Vercel config needed.

## 1. Prerequisites

- [Railway account](https://railway.app)
- GitHub repo with this project pushed
- Redis (Railway provides this)

## 2. Create project

1. Go to [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → select `solclaimtgapp` (or your fork)
3. Railway will create one service by default (the web app)

## 3. Add Redis

1. In the project dashboard → **+ New** → **Database** → **Redis**
2. Railway provisions Redis and sets `REDIS_URL` automatically
3. Copy `REDIS_URL` if you need to share it with another service (see below)

## 4. Configure Web Service (mini app)

1. Select the main service (Next.js)
2. **Settings** tab:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `/` (default)
3. **Variables** tab: Add all vars from `.env.example` (see list below)
4. **Networking**: Enable **Generate Domain** to get a public URL (e.g. `solclaimtgapp-production.up.railway.app`)

## 5. Add Bot Service

1. **+ New** → **GitHub Repo** → select the **same** `solclaimtgapp` repo
2. Railway creates a second service; configure it:
   - **Settings**:
     - **Build Command:** `npm install` (or `npm run build` if bot needs built deps)
     - **Start Command:** `npm run bot`
     - **Root Directory:** `/`
   - **Variables:** Use the same env vars as the web service. Either:
     - Copy from the web service, or
     - Use **Variables** at the **Project** level (shared by all services)
3. The bot does **not** need a public URL; leave **Generate Domain** off.

## 6. Set environment variables

In **Project** → **Variables** (or per-service):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Helius RPC URL |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from BotFather |
| `TELEGRAM_GROUP_CHAT_ID` | Yes | e.g. `-1001265590297` |
| `TELEGRAM_CLAIM_TOPICS_ID` | Yes | e.g. `247118` |
| `REDIS_URL` | Yes | From Railway Redis (auto-set if you add Redis to project) |
| `FEE_PAYER_PRIVATE_KEY` | Yes | Base58 fee payer key |
| `NEXT_PUBLIC_APP_URL` | Yes | Mini app public URL (your web service URL, e.g. `https://solclaimtgapp-production.up.railway.app`) |
| `API_HELIUS` | Optional | Helius API key |
| `NEXT_PUBLIC_JUPITER_API_KEY` | Optional | Jupiter API key |
| `TELEGRAM_AIRDROP_TOPICS_ID` | Optional | e.g. `142362` |

**Important:** Set `NEXT_PUBLIC_APP_URL` to your Railway web URL (with `https://`) after the first deploy, so the mini app and bot menu button work.

## 7. Deploy

1. Push to your GitHub default branch; Railway deploys automatically
2. After deploy, copy the web service URL
3. Set `NEXT_PUBLIC_APP_URL` to that URL (e.g. `https://xxx.up.railway.app`) and redeploy if needed

## 8. Point Telegram bot menu to mini app

In [@BotFather](https://t.me/botfather):

- `/setmenubutton` → select your bot
- Set URL to your Railway web URL (e.g. `https://solclaimtgapp-production.up.railway.app`)

## Troubleshooting

- **Bot not starting:** Check service logs in Railway. Ensure `REDIS_URL` is set (from Redis add-on).
- **Claims not posting to group:** Confirm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, and `TELEGRAM_CLAIM_TOPICS_ID` are set for the **web** service (server actions run there).
- **Mini app shows errors:** Ensure `NEXT_PUBLIC_*` vars are set; they are baked in at build time.
