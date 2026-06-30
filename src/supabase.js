import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-supabase-project') || supabaseAnonKey.includes('your-supabase-anon-key')) {
  console.warn('Supabase credentials are not configured yet. Please update the frontend/.env file with your Supabase URL and Anon Key.')
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')
