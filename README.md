# E Track API (Deno)

Backend for the E Track offline-first expense tracker. Built with Deno 2, Hono, Mongoose and
MongoDB. Provides email/password authentication with HS256 bearer tokens and the foundation for
expense endpoints.

> **Status:** foundation phase. Health checks, bearer-token validation and a protected
> `/api/auth/me` route work. Login/register and expense CRUD are documented stubs returning
> `501 NOT_IMPLEMENTED`.

## Stack

| Concern        | Choice                                  |
| -------------- | --------------------------------------- |
| Runtime        | Deno 2.9                                |
| HTTP framework | Hono 4 (`npm:hono`)                     |
| Database       | MongoDB via Mongoose 9 (`npm:mongoose`) |
| Tokens         | `jose` 6 (HS256 JWT)                    |
| Environment    | `@std/dotenv`                           |
| Tests          | `deno test` + `@std/assert`             |

## Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `MONGODB_URI` and a long random `JWT_SECRET` (at least 32 characters).

3. Install/resolve dependencies (Deno resolves JSR/npm imports automatically, the lockfile is
   committed):

   ```bash
   deno cache main.ts
   ```

4. Run the API:

   ```bash
   deno task dev      # watch mode
   deno task start    # single run
   ```

The server listens on `PORT` (default `8000`). Check it with:

```bash
curl http://localhost:8000/api/health
```

## Tasks

```bash
deno task check   # type-check entrypoint + tests
deno task test    # run tests
deno task lint
deno task fmt
```

## Environment variables

| Name             | Required | Default       | Purpose                                  |
| ---------------- | -------- | ------------- | ---------------------------------------- |
| `APP_NAME`       | no       | `E Track API` | Startup log label                        |
| `PORT`           | no       | `8000`        | HTTP port                                |
| `MONGODB_URI`    | yes      | —             | MongoDB connection string                |
| `JWT_SECRET`     | yes      | —             | HS256 signing secret, min 32 chars       |
| `JWT_EXPIRES_IN` | no       | `24h`         | Access token lifetime                    |
| `CORS_ORIGIN`    | no       | `*`           | Allowed origin(s) for the Flutter client |

Never commit `.env`. See [.env.example](.env.example).

## Structure

```text
main.ts                         # load env, connect Mongo, Deno.serve
src/
  app.ts                        # createApp(): Hono wiring and routes
  config/env.ts                 # validated environment configuration
  db/mongo.ts                   # shared Mongoose connection
  middleware/
    auth.middleware.ts          # Bearer token validation
    error.middleware.ts         # JSON error envelope
  modules/
    auth/                       # token service + auth routes
    expenses/                   # Mongoose schema + protected routes
  shared/http/http-error.ts     # typed HTTP errors
  types/app-env.ts              # Hono context typings
main_test.ts                    # health/auth/404 tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) and [API.md](API.md) for details.

## Next phase

1. Add `POST /api/auth/register` and `POST /api/auth/login` with password hashing and a User model.
2. Implement expense CRUD scoped to the authenticated user.
3. Add refresh tokens and a token revocation strategy if needed.
4. Add request validation and rate limiting on auth routes.

## Related documents

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API.md](API.md)
- [AGENTS.md](AGENTS.md)
- [GEMINI.md](GEMINI.md)
