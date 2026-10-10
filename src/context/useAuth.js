import { useContext } from 'react'
import { AuthContext } from './AuthContext'

/**
 * Custom React hook to consume AuthContext values and actions.
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   loading: boolean,
 *   authError: Error | null,
 *   signInWithGoogle: () => Promise<import('firebase/auth').User | null>,
 *   signOutUser: () => Promise<void>,
 *   isConfigured: boolean
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth
