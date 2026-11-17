import { Hono, type MiddlewareHandler } from "hono";

import { notImplemented } from "../../shared/http/http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";

/// All task endpoints require a valid bearer token.
export function taskRoutes(requireJwt: MiddlewareHandler<AppEnv>) {
  const router = new Hono<AppEnv>();
  router.use("*", requireJwt);

  // TODO(phase 2): list tasks scoped to c.get("auth").sub.
  router.get("/", () => {
    throw notImplemented("Listing tasks");
  });

  // TODO(phase 2): create a task with an idempotency key from the client.
  router.post("/", () => {
    throw notImplemented("Creating tasks");
  });

  // TODO(phase 2): patch a task owned by the authenticated user.
  router.patch("/:id", () => {
    throw notImplemented("Updating tasks");
  });

  return router;
}
