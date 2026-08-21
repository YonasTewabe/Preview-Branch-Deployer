# Preview Branch Deployer

Preview Branch Deployer is a full-stack internal tool for managing preview environments.  
It provides a React frontend and an Express backend to manage projects, nodes, environment variables, and Jenkins preview jobs from one interface.

## What the app does

Preview Branch Deployer helps teams:

- Manage project and node configuration in a central UI
- Trigger preview builds/jobs through Jenkins
- Track preview build history and statuses
- Configure environment variables at project and node levels
- Handle authentication, user profiles, and password reset flows
- Manage deleted items through a trash/recovery workflow

## Main features

- Authentication and user management
  - Login flow
  - Forgot/reset password
  - User/profile pages
- Project and node management
  - Projects listing and dashboard views
  - Node configuration and build history
  - API branch-related operations
- Jenkins integration
  - Trigger preview jobs
  - Delete preview jobs/domains
  - Jenkins-specific app configuration
- Environment management
  - Project-level and node-level environment variables
  - Dedicated environment management pages
- Operational tooling
  - Trash management
  - System settings and stats endpoints

## Tech stack

- Frontend: React, Vite, React Router, Axios, TanStack Query, Ant Design, Tailwind CSS
- Backend: Node.js, Express, Sequelize, MySQL, JWT auth, Nodemailer, node-cron
- CI/CD integration: Jenkins

## Project structure

- `src/`: React frontend
- `server/`: Express backend
- `env.example`: frontend environment template
- `server/env.example`: backend environment template

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Postgres database
- Jenkins server and jobs (for preview build features)
- SMTP credentials

## Setup

### 1) Install dependencies

From the repo root:

```bash
npm install
cd server
npm install
```

### 2) Configure environment variables

Create environment files by copying the provided examples:

```bash
# from repo root
cp env.example .env
cp server/env.example server/.env
```

Then update values in:

- `.env` (frontend/Vite values such as backend URL, preview URL, Jenkins client settings)
- `server/.env` (backend values such as database, JWT, SMTP, Jenkins credentials)

### 3) Prepare the database

From `server/`:

```bash
npm run db:init
npm run db:migrate
```

Optional seed:

```bash
npm run db:seed
```

## Run the app

From the root directory:

```bash
npm run dev:full
```

This starts:

- Frontend on `http://localhost:5173`
- Backend on `http://localhost:4000` (default)

You can also run services separately:

```bash
# backend
cd server
npm run dev

# frontend (in another terminal, at repo root)
npm run dev
```

## How to use the app

1. Open `http://localhost:5173`
2. Log in with a valid user account
3. Navigate to projects/dashboard to choose a project or node
4. Configure required environment variables
5. Trigger preview builds from node/project controls
6. Monitor build status/history and open generated preview links
7. Use trash/settings pages for cleanup and operational admin tasks

## Useful scripts

### Root scripts

- `npm run dev`: start frontend
- `npm run build`: build frontend
- `npm run lint`: lint frontend
- `npm run preview`: preview production frontend build
- `npm run server`: start backend dev server from root
- `npm run dev:full`: run frontend + backend together

### Server scripts (`server/`)

- `npm run dev`: start backend with nodemon
- `npm run start`: start backend with node
- `npm run db:init`: initialize database
- `npm run db:migrate`: run migrations
- `npm run db:migrate:undo`: undo last migration
- `npm run db:migrate:undo:all`: undo all migrations
- `npm run db:seed`: run seeders
- `npm run db:seed:undo`: undo seeders

## Notes

- Ensure frontend `VITE_BACKEND_URL` points to the backend API path (for example `http://localhost:4000/api/`).
- Password reset and notification features require valid SMTP configuration in `server/.env`.
- Jenkins features require valid Jenkins URL, credentials, and job names in both frontend and backend env files where applicable.
