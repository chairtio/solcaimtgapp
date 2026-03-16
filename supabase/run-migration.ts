import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('Connecting to Supabase...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Read migration file successfully. Executing SQL...')
    
    // In Supabase, we can't directly execute raw SQL via the standard JS client
    // unless we have a specific RPC function set up for it.
    // However, we can use the REST API to execute it if we have the service role key.
    
    // First, let's try to see if we can connect
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error && error.code === '42P01') {
      console.log('Tables do not exist yet. We need to create them.')
      console.log('\n⚠️ IMPORTANT: Supabase JS client cannot execute raw DDL (CREATE TABLE) statements directly for security reasons.')
      console.log('\nTo create your tables, you MUST do one of the following:')
      console.log('1. Go to your Supabase Dashboard -> SQL Editor')
      console.log('2. Click "New Query"')
      console.log('3. Copy and paste the contents of supabase/migrations/001_initial_schema.sql')
      console.log('4. Click "Run"')
      console.log('\nThis is a one-time setup step required by Supabase.')
    } else if (error) {
      console.error('Error connecting to Supabase:', error.message)
    } else {
      console.log('✅ Tables already exist! Database is ready.')
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

runMigration()