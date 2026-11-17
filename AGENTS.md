# AGENTS.md — E Track API

Instructions for AI agents and contributors working in this repository.

## Project

- Service name: **E Track API** (backend for the E Track expense tracker).
- Deno project name: `e-track-api`. Do not rename folders; the path is fixed by the project owner
  (`D:\Sagar\Deno\vnr_deno`).
- Stack: Deno 2.9, Hono 4, Mongoose 9 + MongoDB, jose 6 (HS256 JWT), @std/dotenv, @std/assert.
- Flutter client lives separately at `D:\Sagar\Flutter\vnr_flutter`.

## Current phase

Foundation only. Hono app factory, env validation, Mongo connection, bearer middleware, token
service, health check and protected stubs exist. Login, registration and expense CRUD are
intentionally `501 NOT_IMPLEMENTED`.

## Rules

1. Keep `createApp()` free of I/O: inject secrets/config through `AppOptions`. Only `main.ts` loads
   env, connects to MongoDB and starts the server.
2. Read configuration only through `loadEnv()` in `src/config/env.ts`. Never call `Deno.env.get`
   from modules or handlers.
3. All protected routes must use `requireAuth(secret)` from `src/middleware/auth.middleware.ts`;
   read identity from `c.get("auth")`, never from a request body.
4. Throw `HttpError` (or its helpers) for expected failures so the global error middleware returns
   the standard `{ error: { code, message } }` envelope.
5. Use `jose` for JWT sign/verify. Keep issuer/audience/algorithm checks intact; do not weaken token
   validation to make tests pass.
6. Mongoose models belong under `src/modules/<feature>/`. Reuse `mongoose.models.X` to survive
   `deno task dev` watch reloads.
7. Never log or commit secrets, `.env`, tokens or plaintext passwords. Password hashing is mandatory
   when auth endpoints are implemented.
8. Expense records must be scoped by the authenticated user's `sub`. Accept a client-generated id
   for idempotent offline sync.
9. Update `README.md`, `ARCHITECTURE.md` and `API.md` when routes, modules or behavior change.
   `GEMINI.md` references this file; keep it aligned.
10. Prefer small, focused files and explicit TypeScript types. No `any` unless unavoidable with
    third-party typings.

## Commands

```bash
cp .env.example .env       # then fill in real values
deno task dev
deno task check
deno task test
deno task lint
deno task fmt
```

## Testing expectations

- Test through `app.request(...)` from `createApp()`; do not bind a socket.
- Use a fixed test secret (min 32 chars) and `signAccessToken()` for auth cases.
- After changes, `deno task check` and `deno task test` must pass.
