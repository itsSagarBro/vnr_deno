import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { errorHandler } from "./middleware/error.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import { authRoutes } from "./modules/auth/auth.routes.ts";
import { expenseRoutes } from "./modules/expenses/expenses.routes.ts";
import { taskRoutes } from "./modules/tasks/tasks.routes.ts";
import { searchRoutes } from "./modules/search/search.routes.ts";
import { globalSearch, type SearchService } from "./modules/search/search.service.ts";
import type { AppEnv } from "./types/app-env.ts";

export interface AppOptions {
  jwtSecret: string;
  jwtExpiresIn?: string;
  corsOrigin?: string;
  searchService?: SearchService;
}

/// Builds the Hono app without touching the network or database, which keeps
/// it easy to exercise from tests and edge runtimes.
export function createApp(options: AppOptions) {
  const app = new Hono<AppEnv>();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: options.corsOrigin ?? "*",
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.onError(errorHandler);
  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    )
  );

  app.get("/api/health", (c) =>
    c.json({
      status: "ok",
      name: "E Track API",
      time: new Date().toISOString(),
    }));

  const requireJwt = requireAuth(options.jwtSecret);

  app.route(
    "/api/auth",
    authRoutes({
      jwtSecret: options.jwtSecret,
      jwtExpiresIn: options.jwtExpiresIn,
    }),
  );
  app.route("/api/expenses", expenseRoutes(requireJwt));
  app.route("/api/tasks", taskRoutes(requireJwt));
  app.route(
    "/api/search",
    searchRoutes(requireJwt, options.searchService ?? globalSearch),
  );

  return app;
}
