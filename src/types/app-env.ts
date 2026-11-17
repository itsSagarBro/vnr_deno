import type { AccessTokenClaims } from "../modules/auth/auth.service.ts";

/// Hono context variables available to every handler after auth middleware.
export type AppEnv = {
  Variables: {
    auth: AccessTokenClaims;
  };
};
