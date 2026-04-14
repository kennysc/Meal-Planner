# AGENTS.md

## Repo overview

Meal planning web app (French-Canadian primary, English secondary). Monorepo with two independent packages:

- `frontend/` — React 19 + Vite, TypeScript, single-page app
- `backend/` — Node.js + Express 5, TypeScript (ESM), Prisma ORM, PostgreSQL

No shared package or workspace linking between them. Each has its own `node_modules` and `package.json`.

## Running the stack

**Preferred (Docker Compose) — only way to run everything together:**
```sh
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- DB: postgres:16-alpine on port 5432

On first boot the backend container automatically runs `prisma generate && db:push && seed && dev`. The seed is idempotent (uses `findUnique` before creating).

**Local dev (backend only):**
```sh
cd backend
DATABASE_URL=postgresql://mealplanner:mealplanner@localhost:5432/mealplanner?schema=public npm run dev
```
Uses `tsx watch` — no build step needed for dev.

**Local dev (frontend only):**
```sh
cd frontend
npm run dev
```
Vite proxies `/api` to `http://backend:4000` — this hostname only resolves inside Docker. For local frontend dev pointing at a local backend, override `VITE_API_URL` or edit `vite.config.ts` proxy target to `http://localhost:4000`.

## Backend commands (run from `backend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start with `tsx watch` (no compile) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled `dist/index.js` |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB without migrations |
| `npm run seed` | Seed with sample recipes + week entries |

**No migration files** — the project uses `prisma db push` (schema push), not `prisma migrate`. Do not create migration files.

After any schema change in `prisma/schema.prisma`, run `prisma:generate` then `db:push`.

## Frontend commands (run from `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

No typecheck script — typecheck is bundled into `build` (`tsc -b`). To typecheck without building: `npx tsc -b --noEmit` from `frontend/`.

## Architecture notes

- **All API logic lives in one file**: `backend/src/app.ts` (603 lines). No router files, no controller split.
- **Prisma client uses `@prisma/adapter-pg`** (driver adapter via `pg` Pool), not the default TCP connector. The client is instantiated in `backend/src/prisma.ts`.
- **`ensureWeek()`** (`backend/src/week.ts`) is called on most week endpoints — it upserts the current week and all 14 meal slots (7 days × DINNER + SUPPER) if they don't exist. Week starts on Monday (UTC).
- **Recipe update** (`PUT /api/recipes/:id`) does a two-step update: first deletes all `recipeTags` and `recipeIngredients`, then recreates them. This is intentional — don't "optimize" it to a diff without understanding cascade constraints.
- **`Ingredient` deletion is restricted** (`onDelete: Restrict` on `RecipeIngredient`). Deleting an ingredient that is used by any recipe will throw. Recipes must be updated/deleted first.
- **Shopping list dedup**: existing unchecked item for the same ingredient → quantities are concatenated with ` + `, not replaced.

## i18n

Translations live entirely in `frontend/src/i18n.ts` as two inline dictionaries (`fr-CA`, `en-CA`). No external i18n library. Add keys to both dictionaries when adding UI strings. The `t(locale, key)` fallback returns the key itself if missing.

## TypeScript / ESM quirks

- Backend `tsconfig.json` uses `"module": "NodeNext"` — all local imports must use `.js` extensions (e.g., `import { foo } from './foo.js'`), even though the source files are `.ts`. This is already the convention throughout `src/`.
- Both packages use `"type": "module"` in `package.json`.
- Frontend uses `tsconfig.app.json` + `tsconfig.node.json` (composite project) — `tsc -b` is required, not plain `tsc`.

## Environment variables

Backend reads from `.env` (via `dotenv`) or process env:

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `""` | Required. Full Postgres connection string. |
| `PORT` | `4000` | HTTP port. |

Frontend reads `VITE_API_URL` at build time (optional — defaults to `""`, meaning relative URLs, relying on Vite proxy).

`.env` and `.env.*` are gitignored.

## No test suite

There are no tests. There is no test runner configured in either package. Do not invent test commands.

## Lint

Only the frontend has ESLint configured (`frontend/eslint.config.js`). The backend has no linter configured. Run `npm run lint` from `frontend/` only.
