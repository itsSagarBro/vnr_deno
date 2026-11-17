# E Track API Architecture

Layered Hono application: composition root -> middleware -> modules -> shared infrastructure.
Modules are feature slices (auth, expenses, tasks, search), not technical layers.

## Request flow

```text
Request
  -> Hono app (src/app.ts)
  -> global middleware: logger, CORS
  -> route module (auth / expenses / tasks / search / health)
  -> requireAuth (for protected routes)
  -> handler (uses jose / Mongoose)
  -> JSON response
  -> onError -> { error: { code, message, details? } }
```

## Layers and folders

```text
main.ts                       Composition root: env, MongoDB, Deno.serve
src/
  app.ts                      Application factory, route registration
  config/env.ts               Single validated source of configuration
  db/mongo.ts                 One Mongoose connection shared by models
  middleware/
    auth.middleware.ts        Bearer validation, populates c.get("auth")
    error.middleware.ts       Consistent error envelope + 500 logging
  modules/
    auth/
      auth.service.ts         signAccessToken / verifyAccessToken
      auth.routes.ts          register, login, me
      password.service.ts     scrypt hashing + constant-time verification
      user.model.ts           Mongoose User schema (passwordHash only)
      user.service.ts         injectable user lookup/creation
    expenses/
      expense.model.ts        Mongoose schema
      expenses.routes.ts      protected CRUD stubs
    tasks/
      task.model.ts           Mongoose schema + TASK_CATEGORIES enum
      tasks.routes.ts         protected CRUD stubs
    search/
      search.service.ts       escaped-regex search over both models
      search.routes.ts        protected GET /api/search
  shared/http/http-error.ts   HttpError + notImplemented helpers
  types/app-env.ts            Hono environment typings
```

## Conventions

- `createApp(options)` must not perform I/O; pass secrets/config in. This is what makes tests fast
  and independent of MongoDB.
- Environment access is centralized in `loadEnv()`; handlers never call `Deno.env.get` directly.
- Protected routes mount `requireAuth(secret)` either individually or via
  `router.use("*", requireJwt)`.
- Handlers throw `HttpError` for expected failures. Unexpected errors are logged and returned as
  generic `500` responses to avoid leaking details.
- Mongoose models live next to their feature. Reuse `mongoose.models.X` on watch reloads.
- Route handlers are thin: validation, persistence and side effects move into service/module files
  as features grow.
- `SearchService` is injected into `searchRoutes` via `AppOptions.searchService`, so tests can
  validate the endpoint without a MongoDB fixture.
- Task categories are a shared contract: `TASK_CATEGORIES` in `task.model.ts` defines the Mongoose
  enum and must match the Flutter `TaskCategory.wireValue` labels.

## Authentication design

- Credentials: email + password. `POST /api/auth/register` and `/api/auth/login` return
  `{ token, user }`.
- Passwords: scrypt with a random 16-byte salt, stored as `scrypt$<salt>$<hash>`. Verification uses
  a constant-time compare; plaintext never leaves the request.
- User store: `UserService` is injected via `AppOptions.userService`, with `mongoUserService` as the
  default. Route tests use an in-memory implementation.
- Tokens: HS256 JWT signed with `JWT_SECRET` via `jose`.
- Claims: `sub` (user id), `email`, `iss=e-track-api`, `aud=e-track-app`, `iat`, `exp`.
- Validation: `Authorization: Bearer <token>`; the middleware verifies signature, algorithm, issuer,
  audience and expiry, then stores claims in the Hono context.
- Client storage: the Flutter app keeps the token in `flutter_secure_storage` and sends it on every
  protected request.
- Never store or log plaintext passwords; only the scrypt hash from `password.service.ts`.

## Offline-first considerations

- Expense and task creates must accept a client-generated idempotency key/uuid so retries from the
  Flutter outbox cannot duplicate records.
- Each expense/task is scoped by `userId` from the verified token; never trust a user id supplied in
  a request body.
- Include `updatedAt` (Mongoose timestamps) in responses so the client can reconcile local records.
- Design list endpoints for incremental sync (`updatedAt.gt` cursor, pagination) rather than only
  full snapshots.
- Global search currently queries MongoDB directly; local caching of search hits comes with sync.

## Testing

- Unit/integration-style tests call `app.request(...)` — no listening socket.
- Use a fixed test secret and `signAccessToken()` to exercise protected routes.
- Keep tests independent of MongoDB until a test database fixture is added.

```bash
deno task check
deno task test
```
