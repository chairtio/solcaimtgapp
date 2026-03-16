'use server'

import {
  getUser,
  getUserById,
  getUserStats,
  getReferralPayoutStats,
  getTaskDefinitions,
  getUserTaskCompletions,
  upsertUserTaskCompletion,
  getUserTaskPoints,
} from '@/lib/database'

export interface TaskWithStatus {
  id: string
  title: string
  description: string | null
  points: number
  type: string
  url: string | null
  icon: string | null
  button_text: string | null
  verification_type: string
  telegram_channel: string | null
  sort: number
  completed: boolean
  completedAt: string | null
  canComplete: boolean
}

export interface TasksForUserResult {
  tasks: TaskWithStatus[]
  experiencePoints: number
  currentLevel: number
  levelName: string
  levelProgress: number
  nextLevelAt: number
}

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000]
const LEVEL_NAMES = ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master']

function getLevelFromXP(xp: number): { level: number; name: string; progress: number; nextAt: number } {
  let level = 0
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i
      break
    }
  }
  const currentThreshold = LEVEL_THRESHOLDS[level]
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? currentThreshold + 500
  const progress = nextThreshold > currentThreshold
    ? (xp - currentThreshold) / (nextThreshold - currentThreshold)
    : 1
  return {
    level,
    name: LEVEL_NAMES[level] ?? 'Novice',
    progress: Math.min(1, Math.max(0, progress)),
    nextAt: nextThreshold,
  }
}

async function checkTelegramChannelMembership(
  telegramId: string,
  channelUsername: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(telegramId)}`
    )
    const json = await res.json()
    if (!json.ok) return false
    const status = json.result?.status
    return status === 'member' || status === 'administrator' || status === 'creator'
  } catch {
    return false
  }
}

async function checkTelegramUserBio(
  telegramId: string,
  referralLink: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !referralLink) return false
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(telegramId)}`
    )
    const json = await res.json()
    if (!json.ok) return false
    const bio = json.result?.bio ?? ''
    if (!bio || typeof bio !== 'string') return false
    const normalized = referralLink.replace(/^https?:\/\//, '').toLowerCase()
    const normalizedBio = bio.toLowerCase()
    return normalizedBio.includes(normalized)
  } catch {
    return false
  }
}

async function verifyTask(
  task: { id: string; verification_type: string; telegram_channel: string | null },
  userId: string,
  telegramId: string,
  user: { first_name?: string; last_name?: string } | null,
  stats: { total_sol_claimed: number },
  referralStats: { num_referred_users_made_claims: number }
): Promise<boolean> {
  switch (task.verification_type) {
    case 'auto_db_claim':
      return stats.total_sol_claimed > 0
    case 'auto_tg_name': {
      const name = [user?.first_name ?? '', user?.last_name ?? ''].filter(Boolean).join(' ')
      return name.toUpperCase().includes('$SOLCLAIM')
    }
    case 'auto_tg_channel':
      if (!task.telegram_channel) return false
      return checkTelegramChannelMembership(telegramId, task.telegram_channel)
    case 'auto_tg_bio': {
      const referralLink = `t.me/solclaimxbot?start=${telegramId}`
      return checkTelegramUserBio(telegramId, referralLink)
    }
    case 'auto_referral':
      return referralStats.num_referred_users_made_claims >= 5
    case 'manual':
      return false
    default:
      return false
  }
}

export async function getTasksForUser(userId: string): Promise<TasksForUserResult> {
  const [definitions, completions, experiencePoints, dbUser, stats] = await Promise.all([
    getTaskDefinitions(),
    getUserTaskCompletions(userId),
    getUserTaskPoints(userId),
    getUserById(userId),
    getUserStats(userId),
  ])

  const referralStats = dbUser?.telegram_id
    ? await getReferralPayoutStats(dbUser.telegram_id)
    : { total_ref_payout_amount: 0, total_referred_users: 0, num_referred_users_made_claims: 0, commission_percentage: 10 }

  const completedSet = new Set(completions.map((c) => c.task_definition_id))
  const { level, name, progress, nextAt } = getLevelFromXP(experiencePoints)

  const tasks: TaskWithStatus[] = await Promise.all(
    definitions
      .sort((a, b) => a.sort - b.sort)
      .map(async (def) => {
        const completed = completedSet.has(def.id)
        const completedAt = completions.find((c) => c.task_definition_id === def.id)?.completed_at ?? null

        let canComplete = false
        if (!completed && dbUser?.telegram_id) {
          canComplete =
            def.verification_type === 'manual'
              ? true
              : await verifyTask(
                  def,
                  userId,
                  dbUser.telegram_id,
                  dbUser,
                  stats ?? { total_sol_claimed: 0 },
                  referralStats ?? { num_referred_users_made_claims: 0 }
                )
        }

        return {
          ...def,
          completed,
          completedAt,
          canComplete,
        }
      })
  )

  return {
    tasks,
    experiencePoints,
    currentLevel: level,
    levelName: name,
    levelProgress: progress,
    nextLevelAt: nextAt,
  }
}

export async function verifyAndCompleteTask(
  userId: string,
  taskDefinitionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [definitions, completions, dbUser] = await Promise.all([
      getTaskDefinitions(),
      getUserTaskCompletions(userId),
      getUserById(userId),
    ])

    const task = definitions.find((d) => d.id === taskDefinitionId)
    if (!task) return { success: false, error: 'Task not found' }

    const alreadyCompleted = completions.some((c) => c.task_definition_id === taskDefinitionId)
    if (alreadyCompleted) return { success: true }

    if (!dbUser?.telegram_id) return { success: false, error: 'User not found' }

    const [stats, referralStats] = await Promise.all([
      getUserStats(userId),
      getReferralPayoutStats(dbUser.telegram_id),
    ])

    if (task.verification_type !== 'manual') {
      const verified = await verifyTask(
        task,
        userId,
        dbUser.telegram_id,
        dbUser,
        stats ?? { total_sol_claimed: 0 },
        referralStats ?? { num_referred_users_made_claims: 0 }
      )
      if (!verified) return { success: false, error: 'Task not completed yet' }
    }

    await upsertUserTaskCompletion(userId, taskDefinitionId, task.points)
    return { success: true }
  } catch (err) {
    console.error('[Tasks] verifyAndCompleteTask error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete task',
    }
  }
}
