import { useState, useEffect } from 'react'
import { getUser, createUser, updateUser, type User } from '@/lib/database'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    auth_date: number
    hash: string
  }
  version: string
  platform: string
  close(): void
  expand(): void
  ready(): void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function useTelegram() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        // Mock user for local development outside of Telegram
        const isLocalDev = process.env.NODE_ENV === 'development' && (!window.Telegram || !window.Telegram.WebApp)
        
        let telegramUser: TelegramUser
        let webApp: TelegramWebApp | null = null

        if (isLocalDev) {
          console.log('Running in local dev mode, using mock Telegram user')
          telegramUser = {
            id: 123456789,
            first_name: 'Local',
            last_name: 'Tester',
            username: 'local_tester',
            is_premium: true
          }
        } else {
          // Wait for Telegram WebApp script to load (can be async in Telegram's WebView)
          for (let i = 0; i < 50; i++) {
            if (window.Telegram?.WebApp) break
            await new Promise((r) => setTimeout(r, 100))
          }
          if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
            setError('Open this app from the bot menu (tap the bot, then the menu button)—not from a link.')
            setIsLoading(false)
            return
          }

          webApp = window.Telegram.WebApp
          const initData = webApp.initDataUnsafe

          if (!initData.user) {
            setError('Unable to get user information from Telegram')
            setIsLoading(false)
            return
          }

          telegramUser = initData.user
          
          // Expand the WebApp to full height
          webApp.expand()
          webApp.ready()
        }

        // Check if user exists in database (with degraded fallback if DB fails)
        let dbUser: User | null = null
        let dbError: string | null = null

        try {
          dbUser = await getUser(telegramUser.id.toString())

          if (!dbUser) {
            dbUser = await createUser({
              telegram_id: telegramUser.id.toString(),
              username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
              is_premium: telegramUser.is_premium || false
            })
          } else {
            const needsUpdate =
              dbUser.username !== telegramUser.username ||
              dbUser.first_name !== telegramUser.first_name ||
              dbUser.last_name !== telegramUser.last_name ||
              dbUser.photo_url !== telegramUser.photo_url ||
              dbUser.is_premium !== (telegramUser.is_premium || false)

            if (needsUpdate) {
              dbUser = await updateUser(telegramUser.id.toString(), {
                username: telegramUser.username,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name,
                photo_url: telegramUser.photo_url,
                is_premium: telegramUser.is_premium || false
              })
            }
          }
        } catch (dbErr) {
          console.error('Database error (using limited mode):', dbErr)
          const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr)
          dbError = `Database unavailable: ${errMsg}. Wallet data won't be saved.`
          // Degraded mode: create in-memory user so app still works
          dbUser = {
            id: `temp-${telegramUser.id}`,
            telegram_id: telegramUser.id.toString(),
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            photo_url: telegramUser.photo_url,
            is_premium: telegramUser.is_premium || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }

        setUser(dbUser)
        setError(dbError)
        setIsLoading(false)

        // Expand the WebApp to full height (only in Telegram)
        if (webApp) {
          webApp.expand()
          webApp.ready()
        }

      } catch (err) {
        console.error('Error initializing Telegram:', err)
        setError('Failed to initialize Telegram integration')
        setIsLoading(false)
      }
    }

    initTelegram()
  }, [])

  const refreshUser = async (): Promise<User | null> => {
    if (!user?.telegram_id) return null
    try {
      const dbUser = await getUser(user.telegram_id)
      if (dbUser) {
        setUser(dbUser)
        return dbUser
      }
    } catch (err) {
      console.error('Error refreshing user:', err)
    }
    return null
  }

  return { user, isLoading, error, refreshUser }
}