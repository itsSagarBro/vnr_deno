import type { MiddlewareHandler } from "hono";

import { verifyAccessToken } from "../modules/auth/auth.service.ts";
import { HttpError } from "../shared/http/http-error.ts";
import type { AppEnv } from "../types/app-env.ts";

const BEARER_PREFIX = "Bearer ";

/// Hono middleware that validates `Authorization: Bearer <jwt>` and stores the
/// verified claims at `c.get("auth")` for downstream handlers.
export function requireAuth(secret: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new HttpError(
        401,
        "Missing or malformed Authorization header.",
        "UNAUTHORIZED",
      );
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (token === "") {
      throw new HttpError(
        401,
        "Missing bearer token.",
        "UNAUTHORIZED",
      );
    }

    try {
      const claims = await verifyAccessToken(token, secret);
      c.set("auth", claims);
      await next();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        401,
        "Invalid or expired access token.",
        "TOKEN_INVALID",
      );
    }
  };
}
