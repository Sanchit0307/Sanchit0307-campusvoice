import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase'
import { checkIsModerator } from '../services/ideasService'
import { AuthContext } from './AuthContext'

const maskUid = (id) => {
  if (!id || typeof id !== 'string') return 'none'
  const str = id.trim()
  return str.length > 8 ? `${str.slice(0, 4)}...${str.slice(-4)}` : `${str.slice(0, 2)}***`
}

/**
 * Authentication Provider component that supplies user state, loading status,
 * role permissions, and auth action handlers to the entire application.
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
  const [isModerator, setIsModerator] = useState(false)
  const [isRoleLoading, setIsRoleLoading] = useState(false)
  const [roleResolved, setRoleResolved] = useState(!isConfigured || !auth)
  const latestCheckSeqRef = useRef(0)

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info('[AuthDiag] AuthProvider mounted.', {
        authConfigured: isConfigured,
        firebaseConfigured: isFirebaseConfigured(),
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'not-set',
      })
    }

    // If Firebase credentials are not configured or auth is not initialized, do nothing
    if (!isConfigured || !auth) {
      return undefined
    }

    let isCancelled = false

    // Subscribe to Firebase Auth state changes.
    // onAuthStateChanged is the canonical source of truth for the user state.
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        const maskedUid = maskUid(currentUser?.uid)
        if (import.meta.env.DEV) {
          console.info('[AuthDiag] onAuthStateChanged dispatched:', {
            isSignedIn: Boolean(currentUser),
            maskedUid,
            authConfigured: Boolean(auth),
            firestoreConfigured: isFirebaseConfigured(),
          })
        }

        setUser(currentUser)

        if (currentUser?.uid) {
          const currentSeq = ++latestCheckSeqRef.current
          if (!isCancelled) {
            setIsRoleLoading(true)
            setRoleResolved(false)
          }
          if (import.meta.env.DEV) {
            console.info(`[AuthDiag] onAuthStateChanged starting check seq #${currentSeq} for user ${maskedUid}`)
          }

          try {
            const moderator = await checkIsModerator(currentUser.uid)
            if (isCancelled) {
              if (import.meta.env.DEV) {
                console.info(`[AuthDiag] onAuthStateChanged check seq #${currentSeq} discarded: component unmounted`)
              }
              return
            }

            if (currentSeq !== latestCheckSeqRef.current) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[AuthDiag] OVERLAPPING CHECK: onAuthStateChanged seq #${currentSeq} resolved after seq #${latestCheckSeqRef.current}. Discarding stale result.`
                )
              }
              return
            }

            if (import.meta.env.DEV) {
              console.info(`[AuthDiag] onAuthStateChanged setting isModerator=${moderator} (seq #${currentSeq})`)
            }
            setIsModerator(moderator)
            setIsRoleLoading(false)
            setRoleResolved(true)
          } catch (err) {
            console.warn('Failed to verify moderator status on auth change:', err)
            if (!isCancelled && currentSeq === latestCheckSeqRef.current) {
              setIsModerator(false)
              setIsRoleLoading(false)
              setRoleResolved(true)
            }
          }
        } else {
          latestCheckSeqRef.current++
          if (!isCancelled) {
            setIsModerator(false)
            setIsRoleLoading(false)
            setRoleResolved(true)
          }
        }

        if (!isCancelled) {
          setLoading(false)
          setAuthError(null)
        }
      },
      (error) => {
        console.error('Firebase Auth state listener error:', error)
        if (!isCancelled) {
          setAuthError(error)
          setIsModerator(false)
          setIsRoleLoading(false)
          setRoleResolved(true)
          setLoading(false)
        }
      }
    )

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [isConfigured])

  /**
   * Refreshes the moderator authorization status from Firestore for the active user.
   */
  const refreshModeratorStatus = useCallback(async () => {
    const targetUid = user?.uid || auth?.currentUser?.uid
    const maskedUid = maskUid(targetUid)
    if (!targetUid) {
      setIsModerator(false)
      return false
    }

    const currentSeq = ++latestCheckSeqRef.current
    if (import.meta.env.DEV) {
      console.info(`[AuthDiag] refreshModeratorStatus starting check seq #${currentSeq} for user ${maskedUid}`)
    }

    try {
      const moderator = await checkIsModerator(targetUid)
      if (currentSeq !== latestCheckSeqRef.current) {
        if (import.meta.env.DEV) {
          console.warn(
            `[AuthDiag] OVERLAPPING CHECK: refreshModeratorStatus seq #${currentSeq} resolved after seq #${latestCheckSeqRef.current}. Discarding stale result.`
          )
        }
        return moderator
      }

      if (import.meta.env.DEV) {
        console.info(`[AuthDiag] refreshModeratorStatus setting isModerator=${moderator} (seq #${currentSeq})`)
      }
      setIsModerator(moderator)
      return moderator
    } catch (err) {
      console.warn('Failed to refresh moderator status:', err)
      if (currentSeq === latestCheckSeqRef.current) {
        setIsModerator(false)
      }
      return false
    }
  }, [user?.uid])

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
      if (credential?.user?.uid) {
        const maskedUid = maskUid(credential.user.uid)
        if (import.meta.env.DEV) {
          console.info(`[AuthDiag] signInWithGoogle resolved popup for user: ${maskedUid}`)
        }
        setUser(credential.user)
        setIsRoleLoading(true)
        setRoleResolved(false)
        const currentSeq = ++latestCheckSeqRef.current
        try {
          if (import.meta.env.DEV) {
            console.info(`[AuthDiag] signInWithGoogle starting check seq #${currentSeq} for user ${maskedUid}`)
          }
          const mod = await checkIsModerator(credential.user.uid)
          if (currentSeq !== latestCheckSeqRef.current) {
            if (import.meta.env.DEV) {
              console.warn(
                `[AuthDiag] OVERLAPPING CHECK: signInWithGoogle seq #${currentSeq} resolved after seq #${latestCheckSeqRef.current}. Discarding stale result.`
              )
            }
            return credential.user
          }
          if (import.meta.env.DEV) {
            console.info(`[AuthDiag] signInWithGoogle setting isModerator=${mod} (seq #${currentSeq})`)
          }
          setIsModerator(mod)
          setIsRoleLoading(false)
          setRoleResolved(true)
        } catch (modErr) {
          console.warn('Moderator check error during sign in:', modErr)
          if (currentSeq === latestCheckSeqRef.current) {
            setIsModerator(false)
            setIsRoleLoading(false)
            setRoleResolved(true)
          }
        }
      }
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
      setUser(null)
      setIsModerator(false)
      setIsRoleLoading(false)
      setRoleResolved(true)
      latestCheckSeqRef.current++
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
      refreshModeratorStatus,
      isConfigured,
      isModerator,
      isRoleLoading,
      roleResolved,
    }),
    [
      user,
      loading,
      authError,
      signInWithGoogle,
      signOutUser,
      refreshModeratorStatus,
      isConfigured,
      isModerator,
      isRoleLoading,
      roleResolved,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
