import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

// Create the Supabase URL from the project ID
const supabaseUrl = `https://${projectId}.supabase.co`

// Create a supabase client for frontend use - using the legacy public anon key for now
export const supabase = createClient(supabaseUrl, publicAnonKey)

// Helper function to get current user session
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  return user
}

// Helper function to get current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error getting current session:', error)
    return null
  }
  return session
}