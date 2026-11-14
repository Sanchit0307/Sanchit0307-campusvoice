import { useContext } from 'react'
import { OnboardingContext } from './OnboardingContext'

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    // Provide a graceful no-op fallback in case invoked outside provider
    return {
      isTourActive: false,
      isWelcomeOpen: false,
      currentStepIndex: -1,
      startTour: () => {},
      skipTour: () => {},
      finishTour: () => {},
      nextStep: () => {},
      prevStep: () => {},
      closeTour: () => {},
    }
  }
  return context
}

export default useOnboarding
