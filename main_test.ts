import { assertEquals } from "@std/assert";

import { createApp } from "./src/app.ts";
import { signAccessToken, verifyAccessToken } from "./src/modules/auth/auth.service.ts";
import type { UserRecord, UserService } from "./src/modules/auth/user.service.ts";
import type { SearchResult } from "./src/modules/search/search.service.ts";

const JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

/// Injected so route tests never touch MongoDB.
const users = new Map<string, UserRecord>();
let nextUserId = 1;
const fakeUserService: UserService = {
  findByEmail: (email) => Promise.resolve(users.get(email) ?? null),
  create: ({ email, passwordHash, name }) => {
    const user: UserRecord = {
      id: `user-${nextUserId++}`,
      email,
      passwordHash,
      name,
    };
    users.set(email, user);
    return Promise.resolve(user);
  },
};

const app = createApp({
  jwtSecret: JWT_SECRET,
  userService: fakeUserService,
  searchService: ({ query, userId, limit }) =>
    Promise.resolve(
      [
        {
          type: "task" as const,
          id: "search-1",
          title: `Result for ${query}`,
          detail: userId,
          date: "2026-11-17T00:00:00.000Z",
        },
      ].slice(0, limit) as SearchResult[],
    ),
});

Deno.test("GET /api/health returns service status", async () => {
  const response = await app.request("/api/health");
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.status, "ok");
  assertEquals(body.name, "E Track API");
  assertEquals(typeof body.time, "string");
});

Deno.test("GET /api/expenses rejects a request without a bearer token", async () => {
  const response = await app.request("/api/expenses");
  assertEquals(response.status, 401);

  const body = await response.json();
  assertEquals(body.error.code, "UNAUTHORIZED");
});

Deno.test("GET /api/expenses rejects a malformed token", async () => {
  const response = await app.request("/api/expenses", {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  assertEquals(response.status, 401);

  const body = await response.json();
  assertEquals(body.error.code, "TOKEN_INVALID");
});

Deno.test("GET /api/auth/me returns claims for a valid token", async () => {
  const token = await signAccessToken(
    { sub: "user-123", email: "user@example.com" },
    JWT_SECRET,
  );

  const response = await app.request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.id, "user-123");
  assertEquals(body.email, "user@example.com");
});

Deno.test("GET /api/tasks requires auth and is currently stubbed", async () => {
  const unauthorized = await app.request("/api/tasks");
  assertEquals(unauthorized.status, 401);

  const token = await signAccessToken(
    { sub: "user-123", email: "user@example.com" },
    JWT_SECRET,
  );
  const response = await app.request("/api/tasks", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(response.status, 501);

  const body = await response.json();
  assertEquals(body.error.code, "NOT_IMPLEMENTED");
});

Deno.test("GET /api/search requires a bearer token", async () => {
  const response = await app.request("/api/search?q=coffee");
  assertEquals(response.status, 401);
});

Deno.test("GET /api/search validates the query", async () => {
  const token = await signAccessToken(
    { sub: "user-123", email: "user@example.com" },
    JWT_SECRET,
  );

  const response = await app.request("/api/search?q=x", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(response.status, 400);

  const body = await response.json();
  assertEquals(body.error.code, "VALIDATION_ERROR");
  assertEquals(body.error.details.field, "q");
});

Deno.test("GET /api/search returns merged results for a valid token", async () => {
  const token = await signAccessToken(
    { sub: "user-123", email: "user@example.com" },
    JWT_SECRET,
  );

  const response = await app.request("/api/search?q=coffee&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.query, "coffee");
  assertEquals(body.total, 1);
  assertEquals(body.results[0].type, "task");
  assertEquals(body.results[0].detail, "user-123");
});

function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("POST /api/auth/register creates a user and returns a token", async () => {
  const response = await postJson("/api/auth/register", {
    email: "  New.User@Example.com  ",
    password: "secret123",
    name: "New User",
  });
  assertEquals(response.status, 201);

  const body = await response.json();
  assertEquals(body.user.email, "new.user@example.com");
  assertEquals(body.user.name, "New User");
  assertEquals(typeof body.token, "string");

  const claims = await verifyAccessToken(body.token, JWT_SECRET);
  assertEquals(claims.sub, body.user.id);
  assertEquals(claims.email, "new.user@example.com");
});

Deno.test("POST /api/auth/register rejects a duplicate email", async () => {
  const first = await postJson("/api/auth/register", {
    email: "duplicate@example.com",
    password: "secret123",
  });
  assertEquals(first.status, 201);

  const second = await postJson("/api/auth/register", {
    email: "duplicate@example.com",
    password: "secret123",
  });
  assertEquals(second.status, 409);

  const body = await second.json();
  assertEquals(body.error.code, "CONFLICT");
});

Deno.test("POST /api/auth/register validates the payload", async () => {
  const response = await postJson("/api/auth/register", {
    email: "not-an-email",
    password: "123",
  });
  assertEquals(response.status, 400);

  const body = await response.json();
  assertEquals(body.error.code, "VALIDATION_ERROR");
  assertEquals(body.error.details.field, "email");
});

Deno.test("POST /api/auth/login accepts the right password", async () => {
  await postJson("/api/auth/register", {
    email: "login@example.com",
    password: "correct horse",
  });

  const response = await postJson("/api/auth/login", {
    email: "LOGIN@example.com",
    password: "correct horse",
  });
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.user.email, "login@example.com");
  assertEquals(typeof body.token, "string");
});

Deno.test("POST /api/auth/login rejects the wrong password", async () => {
  await postJson("/api/auth/register", {
    email: "wrong-password@example.com",
    password: "the-real-password",
  });

  const response = await postJson("/api/auth/login", {
    email: "wrong-password@example.com",
    password: "not-the-password",
  });
  assertEquals(response.status, 401);

  const body = await response.json();
  assertEquals(body.error.code, "INVALID_CREDENTIALS");
});

Deno.test("unknown routes return JSON 404", async () => {
  const response = await app.request("/api/does-not-exist");
  assertEquals(response.status, 404);

  const body = await response.json();
  assertEquals(body.error.code, "NOT_FOUND");
});
