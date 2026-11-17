import { Hono, type MiddlewareHandler } from "hono";

import { badRequest } from "../../shared/http/http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";
import { globalSearch, type SearchService } from "./search.service.ts";

/// GET /api/search?q=<text>&limit=<1..50>
///
/// The search implementation is injected so tests can exercise validation and
/// the response envelope without connecting to MongoDB.
export function searchRoutes(
  requireJwt: MiddlewareHandler<AppEnv>,
  search: SearchService = globalSearch,
) {
  const router = new Hono<AppEnv>();

  router.get("/", requireJwt, async (c) => {
    const query = c.req.query("q")?.trim() ?? "";
    if (query.length < 2) {
      throw badRequest("q must be at least 2 characters.", { field: "q" });
    }
    if (query.length > 100) {
      throw badRequest("q must be at most 100 characters.", { field: "q" });
    }

    const limit = Number(c.req.query("limit") ?? "20");
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw badRequest("limit must be an integer between 1 and 50.", {
        field: "limit",
      });
    }

    const results = await search({
      userId: c.get("auth").sub,
      query,
      limit,
    });

    return c.json({ query, total: results.length, results });
  });

  return router;
}
