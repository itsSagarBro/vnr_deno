import { Hono, type MiddlewareHandler } from "hono";

import { notImplemented } from "../../shared/http/http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";

/// All expense endpoints require a valid bearer token.
export function expenseRoutes(requireJwt: MiddlewareHandler<AppEnv>) {
  const router = new Hono<AppEnv>();
  router.use("*", requireJwt);

  // TODO(phase 2): list expenses scoped to c.get("auth").sub.
  router.get("/", () => {
    throw notImplemented("Listing expenses");
  });

  // TODO(phase 2): create an expense with an idempotency key from the client.
  router.post("/", () => {
    throw notImplemented("Creating expenses");
  });

  return router;
}
