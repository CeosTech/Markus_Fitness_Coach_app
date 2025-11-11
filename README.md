<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Fitness Form Coach

AI-powered coach that analyses your lifts (video or image), generates plans with Gemini, offers live coaching, marketing pages, and now a gamified dashboard with utility tools.

View on AI Studio: https://ai.studio/apps/drive/1LBLvGQbObR41CbkvKnAcguCef_XsETpT

---

## Features

- **Auth + Sessions**: Email/password or Google Sign-In with server-side sessions stored in SQLite.
- **Video & Image Analysis**: MediaPipe pose extraction + Gemini 2.5 (Pro/Flash) for form feedback.
- **Workout Plans**: AI-generated plans with optional RAG on past analyses.
- **History & Goals**: Save analyses, workout plans, personal goals, and replay 3D poses.
- **Live Coach**: Real-time Gemini live session (behind paywall).
- **Tools Hub**: Chronometer, boxing/HIIT timer, 1RM estimator and hydration tracker accessible to all tiers.
- **Nutrition AI**: 7-day meal planner with downloadable grocery list + Pro/Elite meal photo scanner for calories/macros/confidence.
- **Performance Log**: Record workouts, visualize volume/PR trends, and keep a sharable training diary.
- **Gamification**: XP, levels, streaks, and localized badges surfaced in the profile dashboard.
- **i18n**: English, French, Spanish with a language selector.
- **Admin console**: Manage users & subscriptions, run bulk actions, edit marketing copy via the CMS, and inspect stats/logs (restricted via `ADMIN_EMAILS`).

---

## Requirements

- **Node.js ≥ 20** (Gemini SDK requirement)
- **npm** (bundled with Node)
- Optional: SQLite GUI for inspecting `fitness_coach.db`

---

## Environment Variables

Create a `.env.local` (or copy from `.env.example`) at the repo root:

```dotenv
GEMINI_API_KEY=your_google_gemini_key
PUBLIC_GEMINI_API_KEY=browser_safe_or_secondary_key
SESSION_SECRET=super-secret-session
PORT=3001
GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
ADMIN_EMAILS=you@example.com,other@example.com
APP_BASE_URL=https://your-production-domain
FREE_MEAL_SCAN_LIMIT=0
PRO_MEAL_SCAN_LIMIT=30
ELITE_MEAL_SCAN_LIMIT=90
MEAL_SCAN_MODEL=gemini-2.5-flash
```

- `GEMINI_API_KEY` – required for all AI calls from the backend.
- `PUBLIC_GEMINI_API_KEY` – optional secondary key exposed to the browser (needed for live voice coaching). If unset, the server falls back to `GEMINI_API_KEY`.
- `APP_BASE_URL` – optional; used when generating public share links for workout plans (defaults to the current request origin).
- `SESSION_SECRET` – overrides the default session secret.
- `PORT` – optional; defaults to `3001`.
- `GOOGLE_CLIENT_ID` – OAuth client ID from Google Cloud Console (Web application). Required for Google Sign-In.
- `ADMIN_EMAILS` – comma-separated list of admin accounts allowed to access the admin dashboard & API.
- `FREE_MEAL_SCAN_LIMIT` / `PRO_MEAL_SCAN_LIMIT` / `ELITE_MEAL_SCAN_LIMIT` – monthly quotas for the AI meal photo scanner (defaults: 0 / 30 / 90).
- `MEAL_SCAN_MODEL` – override the Gemini vision model used for meal scans (default `gemini-2.5-flash`).

> **Tip**: If you deploy, configure these variables in your hosting provider as well.

### Admin Access

- Any email listed in `ADMIN_EMAILS` automatically sees the Admin tab after signing in.
- The admin dashboard lets you search/filter users, inspect recent analyses/plans/goals, and change their subscription tier.
- Global cards + charts surface total usage, XP averages, top users, and day-by-day analyses vs sign-ups.
- Bulk actions (tier updates, tool resets, notifications) operate on multi-select users with one click.
- The built-in CMS overrides let you tweak marketing copy or tier limits without a redeploy; every change is logged in the audit trail.
- All `/api/admin/*` routes are protected by the server; non-admin sessions receive `403`.

---

## Installation

```bash
npm install
```

This installs both backend (Express) and frontend (Vite + React) dependencies because they share one `package.json`.

---

## Local Development

```bash
npm run dev
```

This runs:

- `npm run dev:server` → Express API + SQLite on port `3001`
- `npm run dev:client` → Vite dev server on port `3000` with a proxy to the API

Access the app at http://localhost:3000. The dev proxy forwards `/api/*` to the backend, so sessions and uploads work seamlessly.

### Useful Scripts

| Script            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Run frontend + backend concurrently              |
| `npm run dev:client` | Run only the Vite client                        |
| `npm run dev:server` | Run only the Express API                        |
| `npm run build`   | Build the React app into `dist/`                 |
| `npm run preview` | Preview the built frontend via Vite              |
| `npm start`       | Start the API + serve built frontend from `dist` |

---

## Production Build

```bash
npm run build
npm start
```

`npm run build` compiles the frontend into `dist/`. `npm start` runs `server.js`, which:

1. Serves `/api/*` routes.
2. Serves static assets from `dist/`.

Ensure `GEMINI_API_KEY` and `SESSION_SECRET` are set in your environment before starting.

---

## Database

- Default database file: `fitness_coach.db` (SQLite).
- Tables are auto-created on startup. Columns for profile fields (first name, height, etc.) are migrated automatically.
- For deploys where the filesystem is ephemeral, consider migrating to a managed database (Cloud SQL/Postgres) or mounting a persistent volume.

---

## API Highlights

| Route                  | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `POST /api/signup`     | Sign up with extended profile fields            |
| `POST /api/signin`     | Sign in and start a session                     |
| `POST /api/auth/google`| Sign in/up via Google ID token                  |
| `GET /api/auth/check`  | Restore session/user data                       |
| `POST /api/analysis`   | Save analysis (video/image + pose data)         |
| `GET /api/analysis`    | Fetch history                                   |
| `GET /api/analysis/stats` | Monthly usage counts                         |
| `POST /api/plans`      | Save workout plans                              |
| `GET /api/plans`       | Retrieve saved plans                            |
| `POST /api/goals` etc. | CRUD for personal goals                         |
| `PUT /api/profile`     | Update profile (first name, DOB, height/weight) |
| `POST /api/upgrade`    | Simulated subscription change                   |
| `GET /api/gamification`| XP, streaks, badges, and plan/goal counters     |
| `GET /api/meal-scans`  | Recent meal photo scans (Pro/Elite)             |
| `GET /api/meal-scans/stats` | Monthly scan usage vs quota                 |
| `POST /api/meal-scans` | Analyze a meal photo to estimate calories/macros|
| `GET /api/performance` | List logged performances (filter by range)      |
| `POST /api/performance` | Add a new performance entry                     |
| `DELETE /api/performance/:id` | Remove an entry you created               |
| `GET /api/performance/analytics` | Summary stats + volume series          |

All routes require a valid session except signup/signin and static assets.

---

## Deployment Tips

- Build locally or via CI before deploying.
- Use Node 20 runtime.
- Provide persistent storage for `fitness_coach.db` or switch to a cloud database.
- Store secrets (Gemini key, session secret) in your platform’s secret manager.

---

## License / Credits

Distributed under the MIT License. See `LICENSE` for details. Respect Gemini usage limits and privacy considerations when uploading user media.
