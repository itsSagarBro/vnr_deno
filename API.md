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

| Method | Path                 | Auth | Status      | Description                             |
| ------ | -------------------- | ---- | ----------- | --------------------------------------- |
| `GET`  | `/api/health`        | no   | implemented | Service status and timestamp            |
| `POST` | `/api/auth/register` | no   | 501 stub    | Create account with email/password      |
| `POST` | `/api/auth/login`    | no   | 501 stub    | Verify credentials, issue bearer token  |
| `GET`  | `/api/auth/me`       | yes  | implemented | Return current user identity from token |
| `GET`  | `/api/expenses`      | yes  | 501 stub    | List expenses for current user          |
| `POST` | `/api/expenses`      | yes  | 501 stub    | Create an expense                       |

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

## Status codes

| Code  | Meaning                                           |
| ----- | ------------------------------------------------- |
| `200` | Success                                           |
| `400` | Validation failure (planned)                      |
| `401` | Missing/invalid/expired bearer token              |
| `404` | Unknown route                                     |
| `409` | Conflict, e.g. email already registered (planned) |
| `500` | Unexpected server error                           |
| `501` | Endpoint scaffolded but not implemented yet       |

## Error codes

| Code                    | Meaning                              |
| ----------------------- | ------------------------------------ |
| `UNAUTHORIZED`          | No credentials supplied              |
| `TOKEN_INVALID`         | Bearer token invalid or expired      |
| `VALIDATION_ERROR`      | Request body/query invalid (planned) |
| `NOT_FOUND`             | Route/resource not found             |
| `NOT_IMPLEMENTED`       | Planned endpoint not built yet       |
| `INTERNAL_SERVER_ERROR` | Unhandled server error               |
