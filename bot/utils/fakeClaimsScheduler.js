/**
 * Sends fake claim notifications to the group claims topic on random intervals (5–30 min).
 * Runs 24/7. Names and amounts are randomized.
 */
import { bot, groupChatId, claimTopics } from '../private/private.js'

const NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Kai', 'River', 'Phoenix', 'Blake',
  'Noah', 'Emma', 'Liam', 'Olivia', 'Ethan', 'Sophia', 'Mason', 'Lucas',
  'Mia', 'James', 'Ava', 'Oliver', 'Grace', 'Leo', 'Zoe', 'Harper', 'Aria',
  'Satoshi', 'Vitalik', 'Pepe', 'Wojak', 'Gm', 'Anon', 'Moon', 'Diamond',
  'HODL', 'WAGMI', 'Ser', 'Degen', 'Chad', 'Alpha', 'Omega', 'Zed',
  'Nexus', 'Cipher', 'Apex', 'Vortex', 'Nova', 'Zen', 'Crypto', 'Solana',
  'Serum', 'Raydium', 'Jupiter', 'Phantom', 'Sol', 'Luna', 'Orbit',
  'Flux', 'Prism', 'Pulse', 'Spark', 'Bolt', 'Blaze', 'Ember', 'Ash',
  'Stone', 'Frost', 'Storm', 'Thunder', 'Shadow', 'Ghost', 'Echo', 'Rogue',
  'Fang', 'Claw', 'Talon', 'Razor', 'Edge', 'Blade', 'Swift', 'Dash',
  'Jet', 'Aero', 'Cosmo', 'Astro', 'Nebula', 'Orion', 'Atlas', 'Titan',
  'Max', 'Rex', 'Ace', 'Jax', 'Zeke', 'Cruz', 'Koda', 'Ryker', 'Axel',
  'Knox', 'Jett', 'Milo', 'Finn', 'Rio', 'Stella', 'Aurora', 'Ivy',
  'Jade', 'Ruby', 'Onyx', 'Sky', 'Ocean', 'Rain', 'Coral', 'Sage',
  'Willow', 'Maple', 'Birch', 'Flame', 'Inferno', 'Charcoal', 'Obsidian',
  'Silver', 'Gold', 'Pump', 'Dump', 'Ape', 'Whale', 'Ser', 'Wen', 'Giga',
  'Based', 'BasedGod', 'SatoshiNakamoto', 'VitalikB', 'CZ', 'SBF',
  'Ponzi', 'Rug', 'Rekt', 'Lambo', 'Wagmi', 'Ngmi', 'Fud', 'Fomo',
  'Bags', 'Diamonds', 'Hands', 'Paper', 'GigaChad', 'Sigma', 'Alpha',
  'Kek', 'Boomer', 'Zoomer', 'Dood', 'Nerd', 'Fren', 'Gm', 'Gn',
  'Yolo', 'Send', 'Leeroy', 'Jenkins', 'Pog', 'Copium', 'Hopium',
  'Airdrop', 'Mint', 'Burn', 'Stake', 'Farm', 'Yield', 'Roi',
  'Mochi', 'Pudgy', 'Milady', 'Remilio', 'Turbo', 'Based',
  'Cypher', 'Morph', 'Nyx', 'Zephyr', 'Helix', 'Vector', 'Matrix',
  'Neo', 'Zero', 'Null', 'Void', 'Abyss', 'Chaos', 'Order', 'Balance',
  'Quant', 'Algo', 'Block', 'Chain', 'Node', 'Mempool', 'Gas',
  'Fees', 'Slippage', 'Liquidity', 'Pool', 'Swap', 'Bridge', 'Layer',
  'Zk', 'Rollup', 'L2', 'Mainnet', 'Testnet', 'Devnet', 'Fork',
  'Merkle', 'Hash', 'Nonce', 'Seed', 'Key', 'Wallet', 'Vault',
  'Vibes', 'Chill', 'Vibe', 'Grok', 'Meme', 'Dank', 'Lit', 'Fire',
  'Bussin', 'NoCap', 'Cap', 'Sus', 'Bet', 'Slay', 'Flex', 'Clout'
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min, max, decimals = 4) {
  const v = min + Math.random() * (max - min)
  return parseFloat(v.toFixed(decimals))
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)]
}

function pickRandomName() {
  return randomChoice(NAMES)
}

const ORANGE_MIN = 0.0015
const YELLOW_MIN = 0.01
const GREEN_MIN = 0.1

function pickBracket() {
  const r = Math.random()
  if (r < 0.4) return 'orange' // 40%
  if (r < 0.7) return 'yellow' // 30%
  return 'green' // 30%
}

function pickAmountByBracket() {
  const bracket = pickBracket()
  if (bracket === 'orange') return randomFloat(ORANGE_MIN, 0.0099, 4)
  if (bracket === 'yellow') return randomFloat(YELLOW_MIN, 0.0999, 4)
  return randomFloat(GREEN_MIN, 2, 4)
}

function sendFakeClaim() {
  const amount = pickAmountByBracket()
  const walletCount = randomInt(1, 3)
  const name = pickRandomName()

  let icon = '🔴'
  if (amount >= GREEN_MIN) icon = '🟢'
  else if (amount >= YELLOW_MIN) icon = '🟡'
  else if (amount >= ORANGE_MIN) icon = '🟠'

  const walletText = walletCount === 1 ? 'wallet' : 'wallets'
  const text = `${icon} New claim: ${amount.toFixed(4)} SOL from ${walletCount} ${walletText} by ${name}`

  bot.telegram.sendMessage(groupChatId, text, { message_thread_id: claimTopics })
    .then(() => console.log('[FakeClaims] Sent:', text))
    .catch((err) => console.error('[FakeClaims] Failed:', err.message))
}

function scheduleNext() {
  const delayMs = randomInt(5 * 60 * 1000, 30 * 60 * 1000) // 5–30 min
  const delayMin = (delayMs / 60000).toFixed(1)
  console.log(`[FakeClaims] Next in ${delayMin} min`)
  setTimeout(() => {
    sendFakeClaim()
    scheduleNext()
  }, delayMs)
}

export function startFakeClaimsScheduler() {
  console.log('[FakeClaims] Scheduler started (5–30 min intervals)')
  scheduleNext()
}
