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
| `POST`  | `/api/auth/register` | no   | 501 stub    | Create account with email/password      |
| `POST`  | `/api/auth/login`    | no   | 501 stub    | Verify credentials, issue bearer token  |
| `GET`   | `/api/auth/me`       | yes  | implemented | Return current user identity from token |
| `GET`   | `/api/expenses`      | yes  | 501 stub    | List expenses for current user          |
| `POST`  | `/api/expenses`      | yes  | 501 stub    | Create an expense                       |
| `GET`   | `/api/tasks`         | yes  | 501 stub    | List tasks for current user             |
| `POST`  | `/api/tasks`         | yes  | 501 stub    | Create a task                           |
| `PATCH` | `/api/tasks/:id`     | yes  | 501 stub    | Update or complete a task               |
| `GET`   | `/api/search`        | yes  | implemented | Search expenses and tasks globally      |

### GET /api/health

```json
{ "status": "ok", "name": "E Track API", "time": "2026-11-17T10:00:00.000Z" }
```

### GET /api/auth/me

Response:

```json
{ "id": "user-123", "email": "user@example.com" }
```

### Planned POST /api/auth/login

Request:

```json
{ "email": "user@example.com", "password": "correct-horse-battery-staple" }
```

Planned response:

```json
{
  "token": "<jwt>",
  "user": { "id": "user-123", "email": "user@example.com", "name": "Asha" }
}
```

The Flutter client stores `token` in `flutter_secure_storage` and reads `user` into its domain
`AppUser` entity.

### Planned POST /api/expenses

Request (client-generated `id` supports idempotent offline retries):

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

### Planned POST /api/tasks

Request (client-generated `id` supports idempotent offline retries):

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

`category` is one of `Personal`, `Work`, `Travel`, `Food`, `Other` (default `Personal`). These
values are shared with the Flutter client's `TaskCategory` enum.

`PATCH /api/tasks/:id` will accept partial updates such as `{ "isCompleted": true }`. All task
records are scoped to the authenticated user's `sub` claim.

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

| Code  | Meaning                                           |
| ----- | ------------------------------------------------- |
| `200` | Success                                           |
| `400` | Validation failure                                |
| `401` | Missing/invalid/expired bearer token              |
| `404` | Unknown route                                     |
| `409` | Conflict, e.g. email already registered (planned) |
| `500` | Unexpected server error                           |
| `501` | Endpoint scaffolded but not implemented yet       |

## Error codes

| Code                    | Meaning                         |
| ----------------------- | ------------------------------- |
| `UNAUTHORIZED`          | No credentials supplied         |
| `TOKEN_INVALID`         | Bearer token invalid or expired |
| `VALIDATION_ERROR`      | Request body/query invalid      |
| `NOT_FOUND`             | Route/resource not found        |
| `NOT_IMPLEMENTED`       | Planned endpoint not built yet  |
| `INTERNAL_SERVER_ERROR` | Unhandled server error          |
