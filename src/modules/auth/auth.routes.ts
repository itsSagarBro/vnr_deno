import { Hono } from "hono";

import { requireAuth } from "../../middleware/auth.middleware.ts";
import { notImplemented } from "../../shared/http/http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";

export interface AuthRouteOptions {
  jwtSecret: string;
  jwtExpiresIn?: string;
}

export function authRoutes(options: AuthRouteOptions) {
  const router = new Hono<AppEnv>();

  // TODO(phase 2): validate body, hash password and create a User document.
  router.post("/register", () => {
    throw notImplemented("Registration");
  });

  // TODO(phase 2): verify credentials and respond with { token, user }.
  router.post("/login", () => {
    throw notImplemented("Login");
  });

  /// Demo-protected route: proves bearer validation works end to end.
  router.get("/me", requireAuth(options.jwtSecret), (c) => {
    const claims = c.get("auth");
    return c.json({ id: claims.sub, email: claims.email });
  });

  return router;
}
