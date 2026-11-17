import { Hono, type MiddlewareHandler } from "hono";

import { readBody } from "../../shared/http/read-body.ts";
import type { AppEnv } from "../../types/app-env.ts";
import {
  type ExpenseService,
  mongoExpenseService,
  parseExpenseInput,
  parseListLimit,
  validateRecordId,
} from "./expense.service.ts";

/// All expense endpoints require a valid bearer token and are scoped to its sub.
export function expenseRoutes(
  requireJwt: MiddlewareHandler<AppEnv>,
  service: ExpenseService = mongoExpenseService,
) {
  const router = new Hono<AppEnv>();
  router.use("*", requireJwt);

  /// Incremental sync cursor: only records updated after `updatedAfter`.
  /// Deleted records are returned as tombstones so the client can remove them.
  router.get("/", async (c) => {
    const limit = parseListLimit(c.req.query("limit") ?? null);
    const items = await service.list({
      userId: c.get("auth").sub,
      updatedAfter: c.req.query("updatedAfter") ?? undefined,
      limit,
    });
    return c.json({ items });
  });

  /// PUT is the primary sync operation: full replace, idempotent by client id.
  router.put("/:id", async (c) => {
    const id = validateRecordId(c.req.param("id"));
    const input = parseExpenseInput(await readBody(c));
    const record = await service.upsert({
      userId: c.get("auth").sub,
      id,
      input,
    });
    return c.json(record);
  });

  /// POST accepts a client-generated id in the body (same semantics as PUT).
  router.post("/", async (c) => {
    const body = await readBody(c);
    const id = validateRecordId(body.id);
    const input = parseExpenseInput(body);
    const record = await service.upsert({
      userId: c.get("auth").sub,
      id,
      input,
    });
    return c.json(record);
  });

  /// Soft delete so tombstones reach other devices through GET /api/expenses.
  router.delete("/:id", async (c) => {
    const id = validateRecordId(c.req.param("id"));
    const record = await service.softDelete({
      userId: c.get("auth").sub,
      id,
    });
    return c.json({ id: record.id, deleted: true });
  });

  return router;
}
