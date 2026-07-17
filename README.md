# DeNoise OS — V0.1 (Phase 1)

The single-user professional operating system for creative production.
This is the **Phase 1 foundation**: authentication, app shell, dashboard with
placeholder data, and the routes that future phases will fill in with real
project and task tracking.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** (strict)
- **Tailwind CSS v4** with **shadcn/ui**
- **Prisma 7** with **better-sqlite3** driver adapter
- **NextAuth v5 (beta)** with Credentials provider
- **SQLite** for local development storage (`prisma/dev.db`)

> **Why SQLite for V0.1?** Phase 1 is single-user and local-only, so the data
> layer is intentionally simple. The Prisma schema is identical to the future
> Postgres deployment — switching providers in V0.2 (when collaboration and
> multi-user features arrive) is a one-line change in `prisma/schema.prisma`.

## Getting Started

```bash
# 1. Install dependencies (already done after scaffold)
npm install

# 2. Apply database migrations
npm run db:migrate

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/login`. Click **Register** to create your first account, then you'll land
on the Dashboard.

## Scripts

| Command              | What it does                                |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Start the dev server (Turbopack)            |
| `npm run build`      | Production build                            |
| `npm run start`      | Run the production build                    |
| `npm run lint`       | Lint the codebase                           |
| `npm run db:migrate` | Apply Prisma migrations                     |
| `npm run db:generate`| Regenerate the Prisma client                |
| `npm run db:studio`  | Open Prisma Studio (browse the local DB)    |

## What's in Phase 1

### Authentication
- `/login` — Email + password sign in
- `/register` — Create an account (auto-signs in)
- API routes: `/api/auth/[...nextauth]`, `/api/register`

### Protected App Shell
- Persistent sidebar: Dashboard, Projects, Tasks, Profile, Settings
- Top bar: signed-in user name + avatar menu (Profile, Settings, Logout)
- Auth guard on every `/(app)/*` route — unauthenticated requests redirect
  to `/login`

### Dashboard (with placeholder data)
- Quick stats: Active Projects, Open Tasks, Overdue, Due This Week
- **Active Projects** grid with role badges, progress bars, task counts
- **Overdue Tasks** list
- **Upcoming Tasks** list
- **Recent Activity** timeline

### Placeholder Pages
- **Projects** — grid of project cards with progress & task summaries
- **Tasks** — flat list of all tasks across all projects
- **Profile** — current user + roles held + project participation
- **Settings** — preferences (display + account stubs)

## Data Model (Phase 1)

Three Prisma models, single user, no permissions or tenancy:

```prisma
User      { id, name, email, password, createdAt, projects[] }
Project   { id, userId, name, description, role, startDate, endDate, status, createdAt, tasks[] }
Task      { id, projectId, title, description, status, priority, dueDate, createdAt }
```

Allowed project roles for V0.1: `director`, `assistant_director`, `art_director`.
Allowed task statuses: `todo`, `in_progress`, `done`.
Allowed task priorities: `low`, `medium`, `high`.

## What's NOT in Phase 1

Per the V0.1 specification, the following are explicitly deferred:

- Real CRUD for Projects, Tasks (Phase 2)
- Project Overview page, Project Health calculation (Phase 2)
- Kanban board view, drag-and-drop (Phase 3)
- Role-specific workspace tabs (Phase 3)
- Notes, References, Activity log (Phase 3)
- Teams, permissions, multi-user, event bus, realtime
- Enterprise features

## File Layout

```
productionos/
├── app/
│   ├── (auth)/{login,register}/page.tsx       # Auth screens
│   ├── (app)/                                  # Protected app shell
│   │   ├── layout.tsx                          # Sidebar + top bar
│   │   ├── dashboard/page.tsx                  # Phase 1 dashboard
│   │   ├── projects/page.tsx                   # Projects placeholder
│   │   ├── tasks/page.tsx                      # Tasks placeholder
│   │   ├── profile/page.tsx                    # Profile placeholder
│   │   └── settings/page.tsx                   # Settings placeholder
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts         # NextAuth handler
│   │   └── register/route.ts                   # Account creation
│   ├── layout.tsx                              # Root layout
│   └── page.tsx                                # Root redirect
├── components/
│   ├── ui/                                     # shadcn primitives
│   ├── sidebar.tsx                             # Left rail
│   ├── top-bar.tsx                             # User menu
│   └── providers.tsx                           # SessionProvider
├── lib/
│   ├── auth.ts                                 # NextAuth config
│   ├── prisma.ts                               # Prisma client
│   ├── dummy-data.ts                           # Phase 1 placeholders
│   └── utils.ts                                # cn() helper
├── prisma/
│   ├── schema.prisma                           # V0.1 schema
│   └── migrations/                             # Initial migration
├── types/
│   └── next-auth.d.ts                          # Session type aug
└── .env                                        # DATABASE_URL + secrets
```
