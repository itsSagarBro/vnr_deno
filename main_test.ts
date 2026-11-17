import { assertEquals } from "@std/assert";

import { createApp } from "./src/app.ts";
import { notFound } from "./src/shared/http/http-error.ts";
import { signAccessToken, verifyAccessToken } from "./src/modules/auth/auth.service.ts";
import type { UserRecord, UserService } from "./src/modules/auth/user.service.ts";
import type { ExpenseRecord, ExpenseService } from "./src/modules/expenses/expense.service.ts";
import type { SearchResult } from "./src/modules/search/search.service.ts";
import type { TaskInput, TaskRecord, TaskService } from "./src/modules/tasks/task.service.ts";

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

/// In-memory stores so sync route tests never touch MongoDB.
const expenseStore = new Map<string, ExpenseRecord>();
const taskStore = new Map<string, TaskRecord>();
let clock = 0;
const nextTimestamp = () =>
  new Date(Date.parse("2026-11-17T00:00:00.000Z") + clock++ * 1000).toISOString();
const storeKey = (userId: string, id: string) => `${userId}:${id}`;

const fakeExpenseService: ExpenseService = {
  list: ({ userId, updatedAfter, limit }) =>
    Promise.resolve(
      [...expenseStore.values()]
        .filter((item) => (item as ExpenseRecord & { userId?: string }).userId === userId)
        .filter((item) => updatedAfter === undefined || item.updatedAt > updatedAfter)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, limit),
    ),
  upsert: ({ userId, id, input }) => {
    const timestamp = nextTimestamp();
    const previous = expenseStore.get(storeKey(userId, id));
    const record: ExpenseRecord = {
      ...input,
      id,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      userId,
    } as ExpenseRecord;
    expenseStore.set(storeKey(userId, id), record);
    return Promise.resolve(record);
  },
  softDelete: ({ userId, id }) => {
    const key = storeKey(userId, id);
    const previous = expenseStore.get(key);
    if (!previous || previous.deletedAt !== null) {
      throw notFound("Expense not found.", { field: "id" });
    }
    const record = {
      ...previous,
      updatedAt: nextTimestamp(),
      deletedAt: nextTimestamp(),
    };
    expenseStore.set(key, record);
    return Promise.resolve(record);
  },
};

const fakeTaskService: TaskService = {
  list: ({ userId, updatedAfter, limit }) =>
    Promise.resolve(
      [...taskStore.values()]
        .filter((item) => (item as TaskRecord & { userId?: string }).userId === userId)
        .filter((item) => updatedAfter === undefined || item.updatedAt > updatedAfter)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, limit),
    ),
  upsert: ({ userId, id, input }) => {
    const timestamp = nextTimestamp();
    const previous = taskStore.get(storeKey(userId, id));
    const record = {
      ...input,
      id,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      userId,
    } as TaskRecord;
    taskStore.set(storeKey(userId, id), record);
    return Promise.resolve(record);
  },
  patch: ({ userId, id, changes }) =>
    fakeTaskService.upsert({
      userId,
      id,
      input: {
        title: changes.title ?? "Task",
        category: changes.category ?? "Personal",
        description: changes.description ?? null,
        dueDate: changes.dueDate ?? null,
        isCompleted: changes.isCompleted ?? false,
      } satisfies TaskInput,
    }),
  softDelete: ({ userId, id }) => {
    const key = storeKey(userId, id);
    const previous = taskStore.get(key);
    if (!previous || previous.deletedAt !== null) {
      throw notFound("Task not found.", { field: "id" });
    }
    const record = {
      ...previous,
      updatedAt: nextTimestamp(),
      deletedAt: nextTimestamp(),
    };
    taskStore.set(key, record);
    return Promise.resolve(record);
  },
};

const app = createApp({
  jwtSecret: JWT_SECRET,
  userService: fakeUserService,
  expenseService: fakeExpenseService,
  taskService: fakeTaskService,
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

Deno.test("GET /api/tasks requires a bearer token", async () => {
  const response = await app.request("/api/tasks");
  assertEquals(response.status, 401);
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

async function authHeaders(sub = "sync-user") {
  const token = await signAccessToken(
    { sub, email: `${sub}@example.com` },
    JWT_SECRET,
  );
  return { Authorization: `Bearer ${token}` };
}

async function jsonRequest(
  method: string,
  path: string,
  body: unknown,
  sub = "sync-user",
) {
  return app.request(path, {
    method,
    headers: { ...await authHeaders(sub), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("expense sync upsert is idempotent and scoped to the token's sub", async () => {
  const payload = {
    title: "Coffee",
    amount: 250,
    category: "Food",
    date: "2026-11-17T09:30:00.000Z",
    note: "Team catch-up",
  };

  const first = await jsonRequest("PUT", "/api/expenses/expense-1", payload);
  assertEquals(first.status, 200);
  const created = await first.json();
  assertEquals(created.id, "expense-1");
  assertEquals(created.title, "Coffee");
  assertEquals(typeof created.updatedAt, "string");

  const second = await jsonRequest("PUT", "/api/expenses/expense-1", {
    ...payload,
    title: "Coffee and pastry",
  });
  assertEquals(second.status, 200);

  const list = await app.request("/api/expenses?limit=10", {
    headers: await authHeaders(),
  });
  const body = await list.json();
  assertEquals(body.items.length, 1);
  assertEquals(body.items[0].title, "Coffee and pastry");

  const otherUser = await app.request("/api/expenses", {
    headers: await authHeaders("someone-else"),
  });
  assertEquals((await otherUser.json()).items.length, 0);

  const incremental = await app.request(
    `/api/expenses?updatedAfter=${encodeURIComponent(created.updatedAt)}`,
    { headers: await authHeaders() },
  );
  assertEquals((await incremental.json()).items.length, 1);
});

Deno.test("expense delete leaves a tombstone for other devices", async () => {
  const deleted = await jsonRequest("DELETE", "/api/expenses/expense-1", {});
  assertEquals(deleted.status, 200);
  assertEquals((await deleted.json()).deleted, true);

  const list = await app.request("/api/expenses", {
    headers: await authHeaders(),
  });
  const items = (await list.json()).items;
  assertEquals(items.length, 1);
  assertEquals(typeof items[0].deletedAt, "string");

  const again = await jsonRequest("DELETE", "/api/expenses/expense-1", {});
  assertEquals(again.status, 404);
});

Deno.test("task sync supports upsert, patch and validation", async () => {
  const payload = {
    title: "File expense report",
    category: "Work",
    description: "Submit the November report",
    dueDate: "2026-11-25T17:00:00.000Z",
    isCompleted: false,
  };

  const created = await jsonRequest("PUT", "/api/tasks/task-1", payload);
  assertEquals(created.status, 200);
  assertEquals((await created.json()).category, "Work");

  const patched = await jsonRequest("PATCH", "/api/tasks/task-1", {
    isCompleted: true,
  });
  assertEquals(patched.status, 200);
  assertEquals((await patched.json()).isCompleted, true);

  const list = await app.request("/api/tasks", { headers: await authHeaders() });
  assertEquals((await list.json()).items.length, 1);

  const invalid = await jsonRequest("PUT", "/api/tasks/task-2", {
    ...payload,
    category: "Holiday",
  });
  assertEquals(invalid.status, 400);
  assertEquals((await invalid.json()).error.details.field, "category");
});

Deno.test("unknown routes return JSON 404", async () => {
  const response = await app.request("/api/does-not-exist");
  assertEquals(response.status, 404);

  const body = await response.json();
  assertEquals(body.error.code, "NOT_FOUND");
});
