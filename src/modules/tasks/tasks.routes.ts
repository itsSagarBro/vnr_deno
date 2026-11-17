import { Hono, type MiddlewareHandler } from "hono";

import { readBody } from "../../shared/http/read-body.ts";
import type { AppEnv } from "../../types/app-env.ts";
import {
  mongoTaskService,
  parseListLimit,
  parseTaskInput,
  parseTaskPatch,
  type TaskService,
  validateRecordId,
} from "./task.service.ts";

/// All task endpoints require a valid bearer token and are scoped to its sub.
export function taskRoutes(
  requireJwt: MiddlewareHandler<AppEnv>,
  service: TaskService = mongoTaskService,
) {
  const router = new Hono<AppEnv>();
  router.use("*", requireJwt);

  router.get("/", async (c) => {
    const limit = parseListLimit(c.req.query("limit") ?? null);
    const items = await service.list({
      userId: c.get("auth").sub,
      updatedAfter: c.req.query("updatedAfter") ?? undefined,
      limit,
    });
    return c.json({ items });
  });

  router.put("/:id", async (c) => {
    const id = validateRecordId(c.req.param("id"));
    const input = parseTaskInput(await readBody(c));
    const record = await service.upsert({
      userId: c.get("auth").sub,
      id,
      input,
    });
    return c.json(record);
  });

  router.post("/", async (c) => {
    const body = await readBody(c);
    const id = validateRecordId(body.id);
    const input = parseTaskInput(body);
    const record = await service.upsert({
      userId: c.get("auth").sub,
      id,
      input,
    });
    return c.json(record);
  });

  router.patch("/:id", async (c) => {
    const id = validateRecordId(c.req.param("id"));
    const changes = parseTaskPatch(await readBody(c));
    const record = await service.patch({
      userId: c.get("auth").sub,
      id,
      changes,
    });
    return c.json(record);
  });

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
