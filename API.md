# E Track API Reference

Base URL (local): `http://localhost:8000`

All responses are JSON. Errors use this shape:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or malformed Authorization header.",
    "details": {}
  }
}
```

## Authentication

Protected routes require:

```http
Authorization: Bearer <access_token>
```

Tokens are HS256 JWTs issued by the API with claims `sub`, `email`, `iss`, `aud`, `iat` and `exp`.
Invalid, missing or expired tokens return `401`.

## Endpoints

| Method  | Path                 | Auth | Status      | Description                             |
| ------- | -------------------- | ---- | ----------- | --------------------------------------- |
| `GET`   | `/api/health`        | no   | implemented | Service status and timestamp            |
| `POST`  | `/api/auth/register` | no   | implemented | Create account with email/password      |
| `POST`  | `/api/auth/login`    | no   | implemented | Verify credentials, issue bearer token  |
| `GET`   | `/api/auth/me`       | yes  | implemented | Return current user identity from token |
| `GET`   | `/api/expenses`        | yes  | implemented | List expenses (incremental sync)        |
| `PUT`   | `/api/expenses/:id`    | yes  | implemented | Idempotent upsert by client id          |
| `POST`  | `/api/expenses`        | yes  | implemented | Create/upsert expense (id in body)      |
| `DELETE`| `/api/expenses/:id`    | yes  | implemented | Soft-delete, leaves a tombstone         |
| `GET`   | `/api/tasks`           | yes  | implemented | List tasks (incremental sync)           |
| `PUT`   | `/api/tasks/:id`       | yes  | implemented | Idempotent upsert by client id          |
| `POST`  | `/api/tasks`           | yes  | implemented | Create/upsert task (id in body)         |
| `PATCH` | `/api/tasks/:id`       | yes  | implemented | Partial task update                     |
| `DELETE`| `/api/tasks/:id`       | yes  | implemented | Soft-delete, leaves a tombstone         |
| `GET`   | `/api/search`          | yes  | implemented | Search expenses and tasks globally      |

### GET /api/health

```json
{ "status": "ok", "name": "E Track API", "time": "2026-11-17T10:00:00.000Z" }
```

### GET /api/auth/me

Response:

```json
{ "id": "user-123", "email": "user@example.com" }
```

### POST /api/auth/register

Request:

```json
{
  "email": "user@example.com",
  "password": "correct-horse-battery-staple",
  "name": "Asha"
}
```

`name` is optional. Emails are trimmed and lowercased; passwords need at least 6 characters. A
duplicate email returns `409 CONFLICT`.

### POST /api/auth/login

Request:

```json
{ "email": "user@example.com", "password": "correct-horse-battery-staple" }
```

Both auth endpoints return:

```json
{
  "token": "<jwt>",
  "user": { "id": "user-123", "email": "user@example.com", "name": "Asha" }
}
```

A wrong email or password returns `401 INVALID_CREDENTIALS`. Passwords are hashed with scrypt; only
the hash is stored. The Flutter client stores `token` in `flutter_secure_storage` and reads `user`
into its domain `AppUser` entity.

### Expenses

All expense endpoints are scoped to the authenticated user's `sub` claim. Client-generated ids make
writes idempotent, so a retried offline upload updates the same record instead of duplicating it.

#### PUT /api/expenses/:id  ·  POST /api/expenses

The `PUT` path id takes the client id; `POST` reads the same `id` from the body. Both are upserts.

Request body:

```json
{
  "id": "9b1f...uuid",
  "title": "Coffee",
  "amount": 3.5,
  "category": "Food",
  "date": "2026-11-17T09:30:00.000Z",
  "note": "Team catch-up"
}
```

`title`, `amount` (> 0), `category` and a valid ISO `date` are required; `note` is optional. Response
is the stored record including `id`, `createdAt`, `updatedAt` and `deletedAt: null`.

#### GET /api/expenses

Query parameters:

| Name           | Required | Default | Rules                                   |
| -------------- | -------- | ------- | --------------------------------------- |
| `updatedAfter` | no       | —       | ISO date cursor; returns records newer  |
| `limit`        | no       | `200`   | Integer between 1 and 500               |

```json
{ "items": [ { "id": "9b1f...", "title": "Coffee", "updatedAt": "...", "deletedAt": null } ] }
```

Soft-deleted records appear as tombstones with a non-null `deletedAt` so other devices can remove
their local copy.

#### DELETE /api/expenses/:id

Sets `deletedAt` rather than removing the row. Responds `{ "id": "...", "deleted": true }`; a second
delete for the same record returns `404 NOT_FOUND`. A later `PUT` upsert clears the tombstone.

### Tasks

Task endpoints mirror expenses and use the same scoping, idempotency and sync semantics.

#### PUT /api/tasks/:id  ·  POST /api/tasks

```json
{
  "id": "7c9e...uuid",
  "title": "File expense report",
  "category": "Work",
  "description": "Submit the November report",
  "dueDate": "2026-11-25T17:00:00.000Z",
  "isCompleted": false
}
```

`title` is required. `category` is one of `Personal`, `Work`, `Travel`, `Food`, `Other` (default
`Personal`) — shared with the Flutter client's `TaskCategory.wireValue`. `description` (also accepted
as `note`), `dueDate` and `isCompleted` are optional.

#### PATCH /api/tasks/:id

Accepts partial updates such as `{ "isCompleted": true }` or `{ "title": "New title" }`. Only
supplied fields change.

#### GET /api/tasks

Supports the same `updatedAfter` cursor and `limit` parameters as expenses and returns
`{ "items": [...] }` with tombstones.

#### DELETE /api/tasks/:id

Soft-deletes the task, returning `{ "id": "...", "deleted": true }`.

### GET /api/search

Query parameters:

| Name    | Required | Default | Rules                    |
| ------- | -------- | ------- | ------------------------ |
| `q`     | yes      | —       | 2–100 characters         |
| `limit` | no       | `20`    | Integer between 1 and 50 |

Example:

```http
GET /api/search?q=coffee&limit=20
Authorization: Bearer <token>
```

Response:

```json
{
  "query": "coffee",
  "total": 1,
  "results": [
    {
      "type": "expense",
      "id": "66f...",
      "title": "Morning coffee",
      "detail": "Food · Team catch-up",
      "date": "2026-11-17T09:30:00.000Z"
    }
  ]
}
```

`type` is `expense` or `task`. Results are scoped to the authenticated user's `sub` claim and sorted
newest-first across both collections.

## Status codes

| Code  | Meaning                                          |
| ----- | ------------------------------------------------ |
| `200` | Success                                          |
| `400` | Validation failure                               |
| `401` | Missing/invalid/expired token or bad credentials |
| `404` | Unknown route or missing/deleted record          |
| `409` | Conflict, e.g. email already registered          |
| `500` | Unexpected server error                          |

## Error codes

| Code                    | Meaning                         |
| ----------------------- | ------------------------------- |
| `UNAUTHORIZED`          | No credentials supplied         |
| `TOKEN_INVALID`         | Bearer token invalid or expired |
| `VALIDATION_ERROR`      | Request body/query invalid      |
| `INVALID_CREDENTIALS`   | Wrong email or password         |
| `CONFLICT`              | Email already registered        |
| `NOT_FOUND`             | Route/resource not found        |
| `INTERNAL_SERVER_ERROR` | Unhandled server error          |
