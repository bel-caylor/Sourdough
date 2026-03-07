# 🍞 Levain — Sourdough Companion App

A personal sourdough starter manager and baking tracker built with React + Vite + Dexie.js. All data is stored locally in your browser — no account, no server, no cost.

---

## Features

- **Dashboard** — At-a-glance starter status, weekly goals, and active bakes
- **Starter Tracker** — Log every feeding (flour type, grams, hydration calc), track health checks (float test, smell, color, rise %), and set reminder intervals
- **Weekly Goals** — Plan your week's bakes and track their status (planned → in-progress → complete)
- **Baking Process** — Step-by-step guided 8-stage sourdough process for each active bake
- **Recipe Log** — Rate and review completed bakes, track improvement over time per recipe
- **Feeding Reminders** — Banner appears when it's time to feed your starter based on your configured interval

---

## Tech Stack

| Layer | Tool |
|---|---|
| UI Framework | React 18 + Vite |
| Styling | Tailwind CSS + custom CSS variables |
| Local Database | Dexie.js (IndexedDB) |
| Routing | React Router v6 |
| Dates | date-fns |
| Icons | Lucide React |

---

## Setup

### Prerequisites
- Node.js 18+ (download from https://nodejs.org)
- VS Code (recommended)

### VS Code Extensions to Install
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **ES7+ React Snippets** (`dsznajder.es7-react-js-snippets`)
- **GitLens** (`eamodio.gitlens`)

### Install & Run

```bash
# 1. Navigate to the project
cd sourdough-app

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Then open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
sourdough-app/
├── index.html                  # App entry point, Google Fonts loaded here
├── src/
│   ├── main.jsx                # React root mount
│   ├── App.jsx                 # Layout, sidebar nav, routing, reminder banner
│   ├── index.css               # Design tokens (CSS variables), global styles
│   ├── db/
│   │   └── database.js         # Dexie.js schema: feedings, goals, sessions, health
│   ├── hooks/
│   │   └── useData.js          # All data access functions (read + write)
│   ├── components/
│   │   └── shared/
│   │       └── FeedingReminderBanner.jsx
│   └── pages/
│       ├── Dashboard.jsx       # Overview: status cards, recent feedings, goals
│       ├── StarterPage.jsx     # Feeding log, health checks, reminder settings
│       ├── GoalsPage.jsx       # Weekly baking goals with status tracking
│       ├── BakingPage.jsx      # Active bake step-by-step process tracker
│       └── RecipesPage.jsx     # Completed bake log with ratings and notes
```

---

## Database Schema (Dexie.js / IndexedDB)

### `feedings`
Tracks every time you feed your starter.
- `date`, `flourType`, `flourGrams`, `waterGrams`, `starterGrams`
- `riseHeight`, `riseTime`, `temp`, `notes`

### `starterHealth`
Health check snapshots (float test, smell, color, rise %).
- `date`, `floatTest`, `smell`, `color`, `risePercent`, `notes`

### `weeklyGoals`
Planned bakes for the week.
- `weekStart`, `recipeName`, `targetDate`, `status`, `notes`

### `bakingSessions`
Active and completed baking process sessions.
- `goalId`, `recipeName`, `startDate`, `stage`, `stages[]`
- `rating`, `outcome`, `notes` (set on completion)

### `reminderSettings`
Single record for feeding interval config.
- `feedingIntervalHours`, `lastFed`, `notificationsEnabled`

---

## Customizing Baking Stages

The default 8-stage sourdough process is defined in `src/hooks/useData.js` in the `getDefaultStages()` function. You can customize or extend this to support different recipes (focaccia, ciabatta, etc.) in a future version.

---

## Future Ideas

- [ ] Add Supabase for cloud sync + cross-device access
- [ ] Email/push notifications via Resend + service worker
- [ ] Custom baking stages per recipe
- [ ] Photo uploads for each bake
- [ ] Hydration and timeline calculator
- [ ] Export bake history as CSV
