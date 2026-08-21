import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

// Create the Supabase URL from the project ID
const supabaseUrl = `https://${projectId}.supabase.co`

// Create a data-only Supabase client for frontend use - using the legacy public anon key for now.
// The null access-token provider bypasses the GoTrue client while preserving anon-key data access.
export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  accessToken: async () => null,
})

let supabaseAuthClient: ReturnType<typeof createClient> | null = null

// Create the normal auth-capable client only when an auth operation is requested.
export const getSupabaseAuthClient = (): ReturnType<typeof createClient> => {
  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(supabaseUrl, publicAnonKey)
  }

  return supabaseAuthClient
}

// Helper function to get current user session
export const getCurrentUser = async () => {
  const { data: { user }, error } = await getSupabaseAuthClient().auth.getUser()
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  return user
}

// Helper function to get current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await getSupabaseAuthClient().auth.getSession()
  if (error) {
    console.error('Error getting current session:', error)
    return null
  }
  return session
}
