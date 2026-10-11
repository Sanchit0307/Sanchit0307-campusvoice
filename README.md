# CampusVoice — Student Ideas & Suggestions Portal

A web application developed for **TechSpace BuildLab '26** (Solo Beginner Track). CampusVoice empowers students to propose campus improvement ideas, browse and upvote community suggestions, and track ideas through their review and implementation lifecycle

---

## Tech Stack

- **Frontend**: React 19 (JavaScript)
- **Tooling & Dev Server**: Vite
- **Styling**: Vanilla CSS (Custom design system with CSS tokens)
- **Backend & Database** *(Upcoming)*: Firebase Authentication & Cloud Firestore
- **Version Control**: Git & GitHub

---

## Project Structure

```text
campusvoice/
├── public/                 # Static assets (favicons, icons)
├── src/                    # Application source code
│   ├── assets/             # Images and SVG assets
│   ├── App.css             # Main component styles
│   ├── App.jsx             # Root application component
│   ├── index.css           # Global styles and design tokens
│   └── main.jsx            # React entry point (DOM root)
├── index.html              # HTML entry template
├── package.json            # Project dependencies and npm scripts
├── vite.config.js          # Vite configuration
└── README.md               # Project documentation
```

*Note: Future directories (e.g., `src/components/`, `src/pages/`, `src/services/`) will be introduced as specific features are developed in subsequent issues.*

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended, current environment: Node v24)
- [npm](https://www.npmjs.com/)

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Development Server

Run the local Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Open the displayed localhost URL (typically `http://localhost:5173`) in your browser.

### Production Build

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Development Roadmap

- [x] **#1 Project Setup & Architecture** *(Current)*
- [ ] #2 Application Shell & Navigation
- [ ] #3 Ideas Listing
- [ ] #4 Idea Submission
- [ ] #5 Idea Detail
- [ ] #6 Categories & Filtering
- [ ] #7 Upvoting
- [ ] #8 Authentication
- [ ] #9 Database Schema
- [ ] #10 Data/API Layer
- [ ] #11 User Dashboard
- [ ] #12 Moderator Dashboard
- [ ] #13 Idea Status Workflow
- [ ] #14 Search & Sorting
- [ ] #15 Analytics
- [ ] #16 Notifications
- [ ] #17 Responsive/Mobile Improvements
- [ ] #18 Testing & Bug Fixes
- [ ] #19 Deployment
- [ ] #20 Documentation
