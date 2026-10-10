import { useState, useEffect, useMemo, useCallback } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase'
import { AuthContext } from './AuthContext'

/**
 * Authentication Provider component that supplies user state, loading status,
 * and auth action handlers to the entire application.
 *
 * Auth state resolution hierarchy for consumers:
 * 1. `!isConfigured`: Firebase is not configured (missing env vars or auth init).
 * 2. `loading`: Firebase Auth session is currently resolving.
 * 3. `user !== null`: Authenticated user session active.
 * 4. `user === null`: Valid signed-out visitor state.
 */
export function AuthProvider({ children }) {
  const isConfigured = Boolean(isFirebaseConfigured() && auth)

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isConfigured)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    // If Firebase credentials are not configured or auth is not initialized, do nothing
    if (!isConfigured || !auth) {
      return undefined
    }

    // Subscribe to Firebase Auth state changes.
    // onAuthStateChanged is the canonical source of truth for the user state.
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setLoading(false)
        setAuthError(null)
      },
      (error) => {
        console.error('Firebase Auth state listener error:', error)
        setAuthError(error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [isConfigured])

  /**
   * Initiates Google Sign-In using a browser popup.
   * Handles user cancellation gracefully without throwing loud uncaught errors.
   */
  const signInWithGoogle = useCallback(async () => {
    if (!isConfigured || !auth || !googleProvider) {
      const err = new Error(
        'Firebase Authentication is not configured. Please define your VITE_FIREBASE_* credentials in .env.'
      )
      setAuthError(err)
      throw err
    }

    setAuthError(null)

    try {
      const credential = await signInWithPopup(auth, googleProvider)
      return credential.user
    } catch (error) {
      // User closed the popup window or triggered a secondary popup cancellation
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        // Treat as intentional user cancellation; return null without throwing
        return null
      }

      console.error('Google Sign-In error:', error)
      setAuthError(error)
      throw error
    }
  }, [isConfigured])

  /**
   * Signs the current user out of Firebase.
   * Does NOT manually mutate `user` state; relies on onAuthStateChanged
   * as the canonical source of truth for auth state transitions.
   */
  const signOutUser = useCallback(async () => {
    if (!auth) {
      return
    }

    try {
      await signOut(auth)
      setAuthError(null)
    } catch (error) {
      console.error('Sign-out error:', error)
      setAuthError(error)
      throw error
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signInWithGoogle,
      signOutUser,
      isConfigured,
    }),
    [user, loading, authError, signInWithGoogle, signOutUser, isConfigured]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
