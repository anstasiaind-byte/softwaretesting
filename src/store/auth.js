import { reactive, readonly } from 'vue'
import { supabase } from '../supabase'

// Reactive state
const state = reactive({
  user: null,
  session: null,
  loading: false,       // Used for login/logout actions
  initialized: false    // Used for the initial session check on app load
})

// Methods
const setUser = (user) => {
  state.user = user
}

const setSession = (session) => {
  state.session = session
  state.user = session?.user || null
}

const setLoading = (loading) => {
  state.loading = loading
}

// Check initial session
const checkSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
  } catch (error) {
    console.error('Error fetching session:', error)
  } finally {
    state.initialized = true
  }
}

// Listen to auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session)
  state.initialized = true
})

// Login
const login = async (email, password) => {
  setLoading(true)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    setLoading(false)
    throw error
  }
  setSession(data.session)
  setLoading(false)
  return data
}

// Register
const register = async (email, password) => {
  setLoading(true)
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    setLoading(false)
    throw error
  }
  setLoading(false)
  return data
}

// Logout
const logout = async () => {
  setLoading(true)
  const { error } = await supabase.auth.signOut()
  if (error) {
    setLoading(false)
    throw error
  }
  setSession(null)
  setLoading(false)
}

// Export auth store
export const authStore = {
  state: readonly(state),
  checkSession,
  login,
  register,
  logout
}
