/**
 * Sends fake claim notifications to the group claims topic on random intervals (5–30 min).
 * Runs 24/7. Names and amounts are randomized.
 */
import { bot, groupChatId, claimTopics } from '../private/private.js'

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Sam', 'Charlie', 'Jamie', 'Dakota', 'Skyler', 'Reese', 'Parker', 'Drew',
  'Kai', 'River', 'Phoenix', 'Blake', 'Hayden', 'Cameron', 'Logan', 'Noah',
  'Emma', 'Liam', 'Olivia', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas',
  'Mia', 'James', 'Ava', 'William', 'Ella', 'Oliver', 'Grace', 'Jack',
  'Lily', 'Henry', 'Chloe', 'Leo', 'Zoe', 'Alexander', 'Harper', 'Sebastian',
  'Aria', 'Benjamin', 'Mila', 'Elijah', 'Aurora', 'Daniel', 'Scarlett', 'Matthew'
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson',
  'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker',
  'Hall', 'Young', 'King', 'Wright', 'Hill', 'Scott', 'Green', 'Adams', 'Baker'
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
  return `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`
}

function sendFakeClaim() {
  const amount = randomFloat(0.002, 2)
  const walletCount = randomInt(1, 3)
  const name = pickRandomName()

  let icon = '🔴'
  if (amount >= 0.1) icon = '🟢'
  else if (amount >= 0.01) icon = '🟡'
  else if (amount >= 0.0015) icon = '🟠'

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
