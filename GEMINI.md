# GEMINI.md — E Track API

This project is governed by [AGENTS.md](AGENTS.md). Read it fully before making changes; it is the
source of truth for stack, structure and conventions.

## Quick reference

- Deno project: `e-track-api`. App name: **E Track API**.
- HTTP: Hono app factory in `src/app.ts`; entrypoint `main.ts`.
- Database: single Mongoose connection in `src/db/mongo.ts`, models under `src/modules/<feature>/`.
- Auth: `src/middleware/auth.middleware.ts` validates `Authorization: Bearer`,
  `src/modules/auth/auth.service.ts` signs/verifies HS256 tokens via `jose`; `src/modules/auth/`
  also holds the User model, scrypt password hashing and register/login routes.
- Global search: `src/modules/search/` provides authenticated `GET /api/search` across expenses and
  tasks (excludes soft-deleted records).
- CRUD + sync: `src/modules/expenses/` and `src/modules/tasks/` provide user-scoped CRUD with
  client-generated ids, `updatedAfter` cursors and soft-delete tombstones. `ExpenseService` and
  `TaskService` are injectable via `AppOptions`.
- Config: `src/config/env.ts` only; copy `.env.example` to `.env` locally.
- Current scope: login/register, global search and expense/task CRUD all work offline-first.

## Expectations

- Preserve the Hono middleware/route boundaries in `ARCHITECTURE.md`.
- Keep endpoint behavior and error codes in sync with `API.md`.
- Never commit secrets or `.env`; never log tokens or passwords.
- Run `deno task check` and `deno task test` after changes.
