import { assertEquals } from "@std/assert";

import { createApp } from "./src/app.ts";
import { signAccessToken } from "./src/modules/auth/auth.service.ts";

const JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
const app = createApp({ jwtSecret: JWT_SECRET });

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

Deno.test("unknown routes return JSON 404", async () => {
  const response = await app.request("/api/does-not-exist");
  assertEquals(response.status, 404);

  const body = await response.json();
  assertEquals(body.error.code, "NOT_FOUND");
});
