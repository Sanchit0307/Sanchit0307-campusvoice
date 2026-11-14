import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { OnboardingContext } from '../../context/OnboardingContext'
import { getOnboardingSteps } from './onboardingSteps'
import { getOnboardingStatus, setOnboardingStatus } from '../../utils/onboardingStorage'
import OnboardingWalkthrough from './OnboardingWalkthrough'

/**
 * OnboardingProvider manages the walkthrough lifecycle:
 * - Automatically detects first-login for authenticated users
 * - Tracks current step, role-based steps, and route transitions
 * - Supports manual replay from Help or Getting Started entry points
 * - Persists completion/skip state scoped to user UID
 */
export function OnboardingProvider({ children }) {
  const {
    user,
    loading: authLoading,
    isModerator,
    roleResolved = true,
    isRoleLoading = false,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isTourActive, setIsTourActive] = useState(false)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Track the user UID for which the auto-check has completed in this session
  const checkedUserUidRef = useRef(null)

  // Steps tailored to current role
  const steps = useMemo(() => {
    return getOnboardingSteps(isModerator)
  }, [isModerator])

  const userUid = user?.uid

  /**
   * Persists dismissal or completion and shuts down the tour UI.
   */
  const handleDismiss = useCallback(
    (skipped = true) => {
      if (userUid) {
        setOnboardingStatus(userUid, {
          completed: !skipped,
          skipped,
          role: isModerator ? 'moderator' : 'student',
        })
      }
      setIsTourActive(false)
      setIsWelcomeOpen(false)
      setCurrentStepIndex(0)
    },
    [userUid, isModerator]
  )

  /**
   * Explicitly launch or restart the walkthrough.
   * Can be invoked from Help/Tour entry points.
   *
   * @param {boolean} [showWelcome=true] - Whether to start from the welcome modal.
   */
  const startTour = useCallback((showWelcome = true) => {
    if (showWelcome) {
      setIsWelcomeOpen(true)
      setIsTourActive(false)
      setCurrentStepIndex(0)
    } else {
      setIsWelcomeOpen(false)
      setIsTourActive(true)
      setCurrentStepIndex(0)
    }
  }, [])

  /**
   * Confirms the welcome screen and begins guided step 1.
   */
  const confirmStartTour = useCallback(() => {
    setIsWelcomeOpen(false)
    setIsTourActive(true)
    setCurrentStepIndex(0)
  }, [])

  /**
   * Advances to the next tour step or finishes if on the last step.
   */
  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      // Completed last step
      handleDismiss(false)
    }
  }, [currentStepIndex, steps.length, handleDismiss])

  /**
   * Returns to the previous step if applicable.
   */
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [currentStepIndex])

  /**
   * Skips and marks onboarding dismissed.
   */
  const skipTour = useCallback(() => {
    handleDismiss(true)
  }, [handleDismiss])

  /**
   * Finishes tour and marks complete.
   */
  const finishTour = useCallback(() => {
    handleDismiss(false)
  }, [handleDismiss])

  /**
   * Dismisses the tour without marking it completed if needed, or defaults to skip.
   */
  const closeTour = useCallback(() => {
    handleDismiss(true)
  }, [handleDismiss])

  // Automatic first-login detection
  useEffect(() => {
    // 1. Never show tour while authentication or role lookup is still loading
    if (authLoading || isRoleLoading || roleResolved === false) {
      return
    }

    // 2. If user is logged out, reset state and ref cleanly
    if (!userUid) {
      checkedUserUidRef.current = null
      const timer = setTimeout(() => {
        setIsWelcomeOpen(false)
        setIsTourActive(false)
        setCurrentStepIndex(0)
      }, 0)
      return () => clearTimeout(timer)
    }

    // 3. Prevent duplicate auto-triggering on every render for the same user session
    if (checkedUserUidRef.current === userUid) {
      return
    }
    checkedUserUidRef.current = userUid

    // 4. Check persisted state asynchronously to prevent cascading renders
    const timer = setTimeout(() => {
      try {
        const status = getOnboardingStatus(userUid)
        if (!status || (!status.completed && !status.skipped)) {
          setIsWelcomeOpen(true)
          setIsTourActive(false)
          setCurrentStepIndex(0)
        }
      } catch (err) {
        console.warn('Error reading onboarding status on login:', err)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [authLoading, isRoleLoading, roleResolved, userUid])

  // Synchronize route changes required by the active step
  useEffect(() => {
    if (!isTourActive) return

    const currentStep = steps[currentStepIndex]
    if (!currentStep || !currentStep.route) return

    const targetRoute = currentStep.route
    const currentFullUrl = `${location.pathname}${location.search}`

    if (currentFullUrl !== targetRoute && location.pathname !== targetRoute) {
      navigate(targetRoute)
    }
  }, [isTourActive, currentStepIndex, steps, location.pathname, location.search, navigate])

  // When user signs out, ensure tour and welcome modal cease rendering immediately
  const activeWelcome = Boolean(userUid) && isWelcomeOpen
  const activeTour = Boolean(userUid) && isTourActive

  const contextValue = useMemo(
    () => ({
      isTourActive: activeTour,
      isWelcomeOpen: activeWelcome,
      currentStepIndex,
      currentStep: steps[currentStepIndex] || null,
      totalSteps: steps.length,
      steps,
      startTour,
      confirmStartTour,
      skipTour,
      finishTour,
      nextStep,
      prevStep,
      closeTour,
    }),
    [
      activeTour,
      activeWelcome,
      currentStepIndex,
      steps,
      startTour,
      confirmStartTour,
      skipTour,
      finishTour,
      nextStep,
      prevStep,
      closeTour,
    ]
  )

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <OnboardingWalkthrough />
    </OnboardingContext.Provider>
  )
}

export default OnboardingProvider
