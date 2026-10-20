# CampusVoice — Student Ideas & Suggestions Portal

A full-stack web application developed for **TechSpace BuildLab '26** (Solo Beginner Track). CampusVoice empowers students to propose campus improvement ideas, browse and upvote community suggestions, track ideas through their review and implementation lifecycle, and enables campus moderators to review, analyze, and transition proposals transparently.

---

## Tech Stack

- **Frontend**: React 19 (JavaScript, ES Modules)
- **Routing**: React Router v7
- **Tooling & Dev Server**: Vite 8
- **Styling**: Vanilla CSS (Semantic design token system with light and dark theme foundations)
- **Backend & Database**: Firebase Authentication (Google Auth) & Cloud Firestore
- **Testing**: Vitest, React Testing Library, JSDOM, `@firebase/rules-unit-testing`
- **Linting**: Oxlint
- **Version Control**: Git & GitHub

---

## Core Features

1. **Campus Ideas Portal & Discovery**:
   - Browse student proposals with category pills, status indicators, and community upvote counts.
   - Real-time search across proposal titles and descriptions.
   - Multi-facet filtering by campus category (Academics, Facilities, Dining, Sustainability, Transportation, Campus Life, Wellness).
   - Lifecycle status filtering (Submitted, Under Review, In Progress, Accepted, Implemented, Rejected).
   - Multi-mode sorting (Newest first, Most upvoted).

2. **Idea Proposal Submission**:
   - Clean, accessible submission form with client-side length, required-field, and category validation.
   - Supports authenticated submissions linked to student UID and anonymous submissions.
   - Automatically initializes durable status timeline with atomic Firestore batch writes.

3. **Secure Community Upvoting**:
   - Atomic toggle upvote system enforced via `/ideas/{ideaId}/votes/{userId}` subcollection rules.
   - Real-time vote count derivation with optimistic UI feedback and guest sign-in prompts.

4. **Idea Status Timeline & Audit Trail**:
   - Durable status transition history stored in immutable per-idea subcollections (`/ideas/{ideaId}/statusHistory`).
   - Visual lifecycle timeline rendering chronological status transitions, actor attribution, and timestamps.

5. **In-App Notification System**:
   - Real-time notification bell with dynamic unread badge counter.
   - Automatic notification dispatch on proposal status transitions and moderator actions.
   - Dropdown menu with mark-as-read controls and direct links to affected proposals.

6. **Moderator Management & Moderation Queue**:
   - Strict role-based access control verified via `/moderators/{userId}` Firestore documents.
   - Dedicated Moderation Queue tab allowing authorized campus moderators to review proposals, advance review stages, reject, or safely delete proposals with confirmation modals.

7. **Moderator Analytics Dashboard**:
   - Comprehensive metrics: Total proposals, active proposals, completion rate, community engagement.
   - Date range presets (All Time, 7 Days, 30 Days, 90 Days, Custom Range).
   - Visual distribution charts: Status breakdown, category distribution, and submission trends over time.

8. **Student Profile, Activity & Privacy**:
   - Student profile overview displaying authenticated photo/initials, department, academic year, and bio.
   - Secure profile editing with strict client-side validation and Firestore field-level write constraints.
   - Student Idea Activity section displaying only the student's authored proposals with integrated search, status filtering, and sorting.
   - Private profile security rules ensuring only the profile owner can read or write their personal profile document.

9. **Interactive Role-Aware Onboarding Walkthrough**:
   - First-time login onboarding guide explaining navigation, idea browsing, upvoting, and submission.
   - Role-aware adaptation: highlights moderation queue and analytics for campus staff.
   - Non-blocking, keyboard accessible (Escape to dismiss), mobile-optimized, and re-playable anytime from the Navbar.

10. **Design System & Theme Engine**:
    - Semantic CSS variables for light and dark modes activated via `data-theme` on the document root.
    - Fully responsive across desktop, tablet, and mobile viewports (down to 360px).

---

## Project Structure

```text
campusvoice/
├── public/                 # Static assets (favicons, icons)
├── src/                    # Application source code
│   ├── assets/             # SVG and image assets
│   ├── components/         # Reusable presentation and interactive components
│   │   ├── analytics/      # Moderator analytics dashboard, charts, and filter bar
│   │   ├── onboarding/     # Role-aware onboarding walkthrough, modal, and steps
│   │   ├── DeleteConfirmationModal.jsx # Destructive action confirmation dialog
│   │   ├── EmptyState.jsx  # Context-aware empty state component
│   │   ├── Footer.jsx      # Application footer
│   │   ├── IdeaCard.jsx    # Proposal card with category badge and upvote button
│   │   ├── IdeaStatusTimeline.jsx # Visual audit trail and lifecycle timeline
│   │   ├── Layout.jsx      # Application layout shell with sticky navbar and footer
│   │   ├── Navbar.jsx      # Top navigation with theme toggle and notifications
│   │   ├── NotificationBell.jsx # Notification trigger and unread dropdown
│   │   ├── SignInPromptModal.jsx # Guest authentication prompt dialog
│   │   ├── ThemeToggle.jsx # Light/dark mode toggle button
│   │   └── UpvoteButton.jsx # Interactive community voting button
│   ├── context/            # React context providers (Auth, Theme, Onboarding)
│   ├── firebase/           # Firebase SDK initialization and emulator detection
│   ├── pages/              # Top-level page views
│   │   ├── DashboardPage.jsx # Student hub, moderation queue, and analytics tabs
│   │   ├── HomePage.jsx    # Hero landing page and platform highlights
│   │   ├── IdeaDetailPage.jsx # Full proposal view, timeline, and moderator workflow
│   │   ├── IdeasPage.jsx   # Public ideas catalog with search, filter, and sorting
│   │   ├── NotFoundPage.jsx # 404 error page
│   │   ├── ProfilePage.jsx # Student profile, bio editor, and idea activity
│   │   └── SubmitIdeaPage.jsx # New proposal submission form
│   ├── services/           # Firestore data services (ideas, profile, notifications, analytics)
│   ├── utils/              # Pure utility functions (filters, validation, timestamps)
│   ├── App.jsx             # Top-level route configuration
│   ├── index.css           # Global design tokens and base styles
│   └── main.jsx            # Application entry point
├── tests/                  # Automated test suites
│   ├── components/         # React Testing Library component tests
│   ├── rules/              # Firestore emulator security rules tests
│   └── unit/               # Vitest pure service and utility unit tests
├── firestore.rules         # Production Cloud Firestore Security Rules
├── firestore.indexes.json  # Composite Firestore index specifications
├── firebase.json           # Firebase configuration for Firestore & emulators
├── package.json            # Project dependencies and test scripts
├── vite.config.js          # Vite bundler configuration
├── SECURITY_TESTS.md       # Firestore security test matrix and audit documentation
└── README.md               # Project documentation
```

---

## Security Model & Firestore Rules

All client read and write operations are strictly governed by `firestore.rules`:

- **`/ideas/{ideaId}`**:
  - `read`: Publicly readable by guests and authenticated users.
  - `create`: Enforces valid 9-field schema, required title/desc/category, canonical status (`Submitted`), initial zero upvotes, and immutable authorId.
  - `update`: Ordinary users cannot mutate proposals. Only verified moderators can update `status` and `updatedAt` (validated with `request.time`).
  - `delete`: Restricted exclusively to verified moderators for content cleanup.
- **`/ideas/{ideaId}/votes/{userId}`**:
  - `read`: Publicly readable.
  - `create`: User can only vote for their own authenticated UID (`request.auth.uid == userId`); duplicate votes denied.
  - `delete`: User can only delete their own vote document (toggle unvote).
  - `update`: Strictly denied (votes are immutable).
- **`/ideas/{ideaId}/statusHistory/{historyId}`**:
  - `read`: Publicly readable.
  - `create`: Enforces valid transition history schema, valid canonical statuses, matching ideaId, actor attribution, and trusted server timestamp.
  - `update`: Strictly denied (history is an immutable audit log).
  - `delete`: Denied to students; permitted to moderators for proposal deletion cleanup.
- **`/moderators/{userId}`**:
  - `read`: Authenticated users can check their own moderator status.
  - `write`: Strictly denied to all client actors (assigned exclusively via Firebase console or Admin SDK).
- **`/users/{userId}`**:
  - `read`: Restricted strictly to the profile owner (`request.auth.uid == userId`).
  - `create` & `update`: Restricted strictly to the profile owner for permitted fields only (`displayName`, `bio`, `department`, `year`, `updatedAt`). Protected fields (`uid`, `email`, `role`, `createdAt`) cannot be tampered with.
  - `delete`: Denied to client actors.
- **`/notifications/{notificationId}`**:
  - Enforces per-recipient access control; users can only read and mark as read their own notifications.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended, developed on Node v24)
- [npm](https://www.npmjs.com/)
- [Java JRE/JDK](https://www.java.com/) (optional, only required if running local Firebase Firestore emulator)

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Environment Configuration

Create a `.env.local` file in the root directory with your Firebase Web App credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Development Server

Run the local Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Verification & Testing

The project maintains comprehensive test coverage across unit logic, component interactions, and Firestore security rules:

### 1. Unit & Component Tests

Run the complete Vitest test suite (309 passing tests):

```bash
npm test
```

### 2. Firestore Security Rules Tests

Execute the 80 automated security scenarios against the local Firestore Emulator:

```bash
npm run test:rules
```

### 3. Static Code Analysis (Lint)

Run the fast linter to verify zero warnings and zero errors across all files:

```bash
npm run lint
```

### 4. Production Build

Compile and validate the optimized production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Development Roadmap

- [x] #1 Project Setup & Architecture
- [x] #2 Application Shell & Navigation
- [x] #3 Ideas Listing
- [x] #4 Idea Submission
- [x] #5 Idea Detail
- [x] #6 Categories & Filtering
- [x] #7 Upvoting
- [x] #8 Authentication
- [x] #9 Database Schema
- [x] #10 Data/API Layer
- [x] #11 User Dashboard
- [x] #12 Moderator Dashboard
- [x] #13 Idea Status Workflow
- [x] #14 Search & Sorting
- [x] #15 Analytics
- [x] #16 Notifications
- [x] #17 Responsive/Mobile Improvements
- [x] #18 Testing & Bug Fixes
- [x] #19 Deployment
- [x] #20 Documentation
