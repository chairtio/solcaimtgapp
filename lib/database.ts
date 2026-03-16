import { supabaseAdmin } from './supabase-admin'

// Database types
export interface User {
  id: string
  telegram_id: string
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
  is_premium?: boolean
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  user_id: string
  public_key: string
  encrypted_private_key?: string
  salt?: string
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  updated_at: string
}

export interface TokenAccount {
  id: string
  wallet_id: string
  account_address: string
  mint_address: string
  balance: number
  rent_amount: number
  is_empty: boolean
  last_scanned: string
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  wallet_id: string
  signature: string
  type: 'claim_rent' | 'close_account' | 'batch_claim'
  status: 'pending' | 'confirmed' | 'failed'
  sol_amount: number
  accounts_closed: number
  fee_amount?: number
  error_message?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  type: 'telegram_share' | 'twitter_share' | 'referral' | 'daily_checkin' | 'content_creation'
  title: string
  description: string
  reward_points: number
  status: 'available' | 'completed' | 'expired'
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referee_id: string
  referral_code: string
  status: 'pending' | 'completed' | 'expired'
  reward_claimed: boolean
  reward_amount?: number
  created_at: string
  updated_at: string
}

export interface UserStats {
  id: string
  user_id: string
  total_sol_claimed: number
  total_accounts_closed: number
  total_tasks_completed: number
  total_referrals: number
  current_level: number
  experience_points: number
  created_at: string
  updated_at: string
}

// Database operations
export class Database {
  // User operations
  static async getUser(telegramId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  }

  static async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateUser(telegramId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('telegram_id', telegramId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Wallet operations
  static async getWallets(userId: string): Promise<Wallet[]> {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (error) throw error
    return data || []
  }

  static async createWallet(walletData: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>): Promise<Wallet> {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .insert(walletData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateWallet(walletId: string, updates: Partial<Wallet>): Promise<Wallet> {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', walletId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Token account operations
  static async getTokenAccounts(walletId: string): Promise<TokenAccount[]> {
    const { data, error } = await supabaseAdmin
      .from('token_accounts')
      .select('*')
      .eq('wallet_id', walletId)
      .order('rent_amount', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async upsertTokenAccounts(accounts: Omit<TokenAccount, 'id' | 'created_at' | 'updated_at'>[]): Promise<TokenAccount[]> {
    const { data, error } = await supabaseAdmin
      .from('token_accounts')
      .upsert(accounts, { onConflict: 'wallet_id,account_address' })
      .select()

    if (error) throw error
    return data || []
  }

  // Transaction operations
  static async createTransaction(txData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert(txData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateTransaction(txId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', txId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getUserTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, wallets!inner(user_id)')
      .eq('wallets.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  // Task operations
  static async getAvailableTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['available', 'completed'])
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert(taskData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async completeTask(taskId: string): Promise<Task> {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Referral operations
  static async createReferral(referralData: Omit<Referral, 'id' | 'created_at' | 'updated_at'>): Promise<Referral> {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .insert(referralData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getUserReferrals(userId: string): Promise<Referral[]> {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getReferralByCode(code: string): Promise<Referral | null> {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  }

  // User stats operations
  static async getUserStats(userId: string): Promise<UserStats | null> {
    const { data, error } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  }

  static async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats> {
    const existing = await this.getUserStats(userId)

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('user_stats')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const { data, error } = await supabaseAdmin
        .from('user_stats')
        .insert({
          user_id: userId,
          total_sol_claimed: 0,
          total_accounts_closed: 0,
          total_tasks_completed: 0,
          total_referrals: 0,
          current_level: 1,
          experience_points: 0,
          ...updates
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  }
}