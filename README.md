[README_CampusVoice.md](https://github.com/user-attachments/files/33778669/README_CampusVoice.md)

# CampusVoice

**CampusVoice** is a campus ideas portal where students can submit proposals, discover ideas from peers, upvote suggestions, and follow an idea's progress.

🌐 **Live Demo:** [sanchit0307-campusvoice.vercel.app](https://sanchit0307-campusvoice.vercel.app/)

 ##Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Security Notes](#security-notes)
- [Contributing](#contributing)

## Overview

CampusVoice provides a central place for campus community members to submit ideas and engage with proposals. It is built with React and Vite, uses Firebase Authentication for sign-in, stores application data in Cloud Firestore, and is hosted on Vercel.

## Features

- Browse ideas submitted by the campus community
- Submit campus proposals
- Upvote ideas and engage with community suggestions
- Track ideas through a status lifecycle: Submitted, Under Review, Accepted, In Progress, and Implemented
- View idea status history
- Receive application notifications
- Role-aware navigation and onboarding
- Moderator analytics dashboard
- Student profiles, editable profile fields, privacy settings, and idea activity
- Search profile activity by title or description and sort supported lists
- Dark-themed interface

Feature availability and permissions depend on the current implementation and Firebase security rules.

## Technology Stack

| Area | Technology |
|---|---|
| UI | React 19 |
| Build tool | Vite |
| Language | JavaScript (ES modules) |
| Styling | CSS |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | Vercel |
| Testing | Vitest and project test suites |

## Getting Started

### Prerequisites

- Node.js (current LTS recommended)
- npm
- A Firebase project configured for Authentication and Cloud Firestore

### 1. Clone the repository

```bash
git clone https://github.com/Sanchit0307/campus-ideas-portal.git
cd campus-ideas-portal
```

If you are using a different fork or repository, replace the URL with its clone URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root and add the variables listed below, using values from your own Firebase project.

### 4. Run locally

```bash
npm run dev
```

Vite prints the local development URL in your terminal, typically `http://localhost:5173`.

### 5. Build and preview

```bash
npm run build
npm run preview
```

## Environment Variables

The frontend expects these Vite variables:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Get the values from **Firebase Console → Project settings → General → Your apps**. Do not commit `.env.local`, service-account JSON files, private keys, or other server-side secrets.

Variables prefixed with `VITE_` are included in the browser bundle. Firebase web configuration is not a substitute for security; protect data with Firestore Security Rules and appropriate API restrictions.

## Firebase Setup

1. Create or select a Firebase project and register a web app.
2. Add its configuration to `.env.local`.
3. Enable the sign-in provider(s) used by the application under **Authentication → Sign-in method**.
4. Add your development and production hostnames under **Authentication → Settings → Authorized domains**. The live hostname is `sanchit0307-campusvoice.vercel.app`; enter only the hostname, without `https://` or a trailing slash.
5. Configure Cloud Firestore and review the project's rules and indexes before deployment.

Review `firestore.rules`, `firestore.indexes.json`, and `firebase.json` before deploying to a different Firebase project. Do not weaken security rules just to suppress an error.

## Scripts

These scripts are used by the project; confirm the exact names in `package.json` for your checked-out branch.

```bash
npm run dev
npm run build
npm run preview
npm test
npm run lint
npm run test:rules
```

- `npm run dev` starts the Vite development server.
- `npm run build` builds the production frontend.
- `npm run preview` serves the production build locally.
- `npm test`, `npm run lint`, and `npm run test:rules` run the corresponding checks if those scripts are available in your branch.

## Project Structure

```text
.
├── public/                 # Static assets
├── src/
│   ├── pages/              # Application pages
│   └── utils/              # Shared utilities
├── tests/                  # Automated tests
├── firebase.json           # Firebase CLI configuration
├── firestore.indexes.json  # Firestore indexes
├── firestore.rules         # Firestore security rules
├── index.html
├── package.json
├── vercel.json             # Vercel SPA routing configuration
└── vite.config.js
```

The exact contents may evolve as the project develops.

## Deployment

The live application is hosted on Vercel:

**[Open CampusVoice](https://sanchit0307-campusvoice.vercel.app/)**

To deploy your own instance:

1. Import the repository into Vercel.
2. Select **Vite** as the framework preset.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Add all required `VITE_FIREBASE_*` environment variables in Vercel for the appropriate environments.
5. Add the deployed hostname to Firebase Authentication's authorized domains.
6. Deploy and test sign-in, idea submission, upvoting, profile updates, and refresh persistence.

The repository's `vercel.json` contains a rewrite to `/index.html` for client-side routing. Keep it unless the routing/deployment setup changes.

## Security Notes

- Never commit `.env.local`, service-account credentials, private keys, or other server-side secrets.
- Anything prefixed with `VITE_` is exposed to the browser; do not put secrets there.
- Enforce authorization with Firestore Security Rules, not only in the UI.
- Re-test security rules when changing profile fields, roles, status transitions, or user-generated content.
- Run relevant tests and a production build before deploying.

## Contributing

1. Open or select an issue describing the change.
2. Create a focused feature branch.
3. Implement the change and add or update tests where appropriate.
4. Run the available checks and production build.
5. Open a pull request with a clear summary and test results.

Avoid committing personal data, credentials, or unrelated generated files.

## Project Status

CampusVoice is deployed, and the current live deployment has been manually checked for sign-in and persistence after updates. Features and setup instructions may evolve.

**Live Demo of the Website:** https://sanchit0307-campusvoice.vercel.app/
