import { createClient } from '@supabase/supabase-js'

// Declare process for Node.js environment support in case types are missing
declare const process: any

// Helper to get env vars in both Vite and Node environments
const getEnv = (key: string) => {
  // Check for Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key]
  }
  // Check for Node environment
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]
  }
  return ''
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabasePublishableKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY')

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase URL or Publishable Key is missing. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl || '', supabasePublishableKey || '')
