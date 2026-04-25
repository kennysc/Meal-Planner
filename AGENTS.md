# AGENTS.md

## Shape

- Full-stack meal planner; French-Canadian is primary, English secondary.
- Two independent Node packages, no workspace linking: `frontend/` and `backend/`. Install/run commands from the package directory, not repo root.
- Root `package.json` only has `version:show`.

## Run

- Full stack: `docker compose up --build` from repo root. Frontend `:3000`, API `:4000`, Postgres `:5432`.
- Backend container startup runs `npm run prisma:generate && npm run db:push && npm run seed && npm run dev`.
- Backend local dev needs DB and env: from `backend/`, `DATABASE_URL=postgresql://mealplanner:mealplanner@localhost:5432/mealplanner?schema=public npm run dev`.
- Frontend local dev: from `frontend/`, `npm run dev`. Vite proxies `/api` to `http://backend:4000`, which only resolves inside Docker; use `VITE_API_URL` or change the proxy target for local backend at `localhost:4000`.

## Commands

- Backend: `npm run dev`, `npm run typecheck`, `npm run build`, `npm run start`, `npm run prisma:generate`, `npm run db:push`, `npm run seed`.
- Frontend: `npm run dev`, `npm run typecheck`, `npm run build` (`tsc -b && vite build`), `npm run lint`, `npm run preview`.
- No test runner is configured in either package. Do not invent test commands.
- Only the frontend has ESLint. Run `npm run lint` from `frontend/` only.
- To typecheck frontend without building assets: `npm run typecheck` from `frontend/`.

## Backend Notes

- Backend is Express 5 + TypeScript ESM + Prisma + PostgreSQL. Entrypoint is `backend/src/index.ts`; API routes and error handling are all in `backend/src/app.ts`.
- `backend/tsconfig.json` uses `module`/`moduleResolution: NodeNext`; local TS imports must include `.js` extensions.
- Prisma uses `@prisma/adapter-pg` with a `pg` Pool in `backend/src/prisma.ts`, not Prisma's default connector URL behavior.
- Prisma datasource has no `url` in `schema.prisma`; `DATABASE_URL` is read by `dotenv`/process env and passed through the adapter.
- Schema workflow is `prisma db push`, not migrations. Do not create migration files. After editing `backend/prisma/schema.prisma`, run `npm run prisma:generate` then `npm run db:push` from `backend/`.
- `ensureWeek()` in `backend/src/week.ts` creates/repairs the week, all 14 meal slots, and the shopping list. Week starts Monday in UTC.
- Recipe update intentionally deletes and recreates `recipeTags` and `recipeIngredients` in two Prisma updates. Do not replace with a diff casually.
- `RecipeIngredient.ingredient` has `onDelete: Restrict`; deleting an ingredient used by a recipe will fail unless recipe links are removed first.
- Adding recipe ingredients to a shopping list deduplicates only existing unchecked items with the same ingredient; quantities are concatenated with ` + `.

## Frontend Notes

- Frontend is React 19 + Vite + TypeScript. Main app logic is concentrated in `frontend/src/App.tsx`; API helpers are in `frontend/src/api.ts`.
- API base is `import.meta.env.VITE_API_URL ?? ''`; empty base means relative `/api` paths through Vite/Docker routing.
- Translations are inline in `frontend/src/i18n.ts`; add UI strings to both `fr-CA` and `en-CA`. Missing keys render as the key.
- Types used by the UI are hand-written in `frontend/src/types.ts`; keep them in sync with backend serializers when changing API shape.

## Repo Conventions

- `.env` and `.env.*` are gitignored; do not commit environment files.
- Build artifacts are ignored: `frontend/dist`, `backend/dist`, `backend/generated`.
- `frontend/README.md` contains frontend-specific commands and API URL notes.
- `docs/ui-refresh-plan.md` contains an active phased UI workflow; if working that plan, follow its pause/test/commit gates instead of continuing phases automatically.
