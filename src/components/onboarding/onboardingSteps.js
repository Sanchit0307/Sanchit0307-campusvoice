/**
 * Step definitions for the CampusVoice Interactive Onboarding Walkthrough.
 *
 * Provides structured steps tailored to the user's role (Student vs. Moderator).
 * Targets real DOM elements that exist in the interface with fallback selectors.
 */

export const ONBOARDING_STEP_IDS = {
  WELCOME: 'welcome',
  NAVIGATION: 'navigation',
  DISCOVER: 'discover',
  UPVOTE: 'upvote',
  SUBMIT: 'submit',
  TRACK: 'track',
}

/**
 * Returns the sequence of onboarding steps for the given role.
 *
 * @param {boolean} isModerator - Whether the active user is an authorized campus moderator.
 * @returns {Array<object>} Array of step configuration objects.
 */
export function getOnboardingSteps(isModerator = false) {
  const commonSteps = [
    {
      id: ONBOARDING_STEP_IDS.NAVIGATION,
      stepNumber: 1,
      totalSteps: 5,
      route: '/',
      targetSelector:
        '[data-tour="mobile-menu-btn"], .mobile-menu-btn, [data-tour="navbar-nav"], .navbar-nav',
      fallbackSelector: '[data-tour="navbar-container"], .navbar-container, .navbar-header',
      title: 'Effortless Navigation',
      description:
        'Use the navigation bar (or the mobile menu icon) to quickly jump between the campus ideas feed, proposal submission, and your personal dashboard at any time.',
      placement: 'bottom',
      highlightPadding: 8,
    },
    {
      id: ONBOARDING_STEP_IDS.DISCOVER,
      stepNumber: 2,
      totalSteps: 5,
      route: '/ideas',
      targetSelector: '[data-tour="ideas-filters"], .ideas-controls-card',
      fallbackSelector: '[data-tour="nav-ideas"], a[href="/ideas"]',
      title: 'Discover Campus Ideas',
      description:
        'Explore initiatives submitted by your peers. Search by keyword or filter proposals across categories like Facilities, Dining, Academics, and Sustainability.',
      placement: 'bottom',
      highlightPadding: 8,
    },
    {
      id: ONBOARDING_STEP_IDS.UPVOTE,
      stepNumber: 3,
      totalSteps: 5,
      route: '/ideas',
      targetSelector: '[data-tour="idea-upvote"], .idea-card .upvote-btn, .upvote-btn',
      fallbackSelector: '[data-tour="ideas-content"], .ideas-content-section',
      title: 'Support Proposals with Upvotes',
      description:
        'Found an idea you believe in? Click the upvote button to show your support. Highly-upvoted ideas gain visibility and direct consideration from campus leadership.',
      placement: 'top',
      highlightPadding: 8,
    },
    {
      id: ONBOARDING_STEP_IDS.SUBMIT,
      stepNumber: 4,
      totalSteps: 5,
      route: '/ideas',
      targetSelector: '[data-tour="submit-nav"], .navbar-cta-btn',
      fallbackSelector: '.ideas-header-action a[href="/submit"], a[href="/submit"]',
      title: 'Submit Your Own Idea',
      description:
        'Have a suggestion for campus improvement? Click "New Idea" to submit a proposal with a category and description to rally community backing.',
      placement: 'bottom',
      highlightPadding: 6,
    },
  ]

  if (isModerator) {
    // Moderator Step 5: Focuses on moderation queue, status management, and analytics
    const moderatorStep5 = {
      id: ONBOARDING_STEP_IDS.TRACK,
      stepNumber: 5,
      totalSteps: 5,
      route: '/dashboard?tab=moderation-queue',
      targetSelector: '[data-tour="moderator-tabs"], .dashboard-tab-bar',
      fallbackSelector: '[data-tour="nav-dashboard"], a[href="/dashboard"]',
      title: 'Moderation Queue & Analytics',
      description:
        'As campus staff, you can review submitted proposals in the Moderation Queue, advance lifecycle stages (Under Review, Accepted, In Progress, Implemented), and track engagement trends on the Analytics dashboard.',
      placement: 'bottom',
      highlightPadding: 8,
    }

    return [...commonSteps, moderatorStep5]
  }

  // Student Step 5: Focuses on tracking own proposals, lifecycle status, and notifications
  const studentStep5 = {
    id: ONBOARDING_STEP_IDS.TRACK,
    stepNumber: 5,
    totalSteps: 5,
    route: '/dashboard',
    targetSelector: '[data-tour="dashboard-stats"], .dashboard-stats-grid, [data-tour="notification-bell"], .notification-bell-container',
    fallbackSelector: '[data-tour="nav-dashboard"], a[href="/dashboard"]',
    title: 'Track Progress & Notifications',
    description:
      'Check your personal Dashboard to see the progress of your submitted proposals. When moderators review or update your idea, you will receive real-time notifications in the top bar.',
    placement: 'bottom',
    highlightPadding: 8,
  }

  return [...commonSteps, studentStep5]
}
