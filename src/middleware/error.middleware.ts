import type { Context } from "hono";

import type { AppEnv } from "../types/app-env.ts";
import { HttpError } from "../shared/http/http-error.ts";

export function errorHandler(error: Error, c: Context<AppEnv>) {
  if (error instanceof HttpError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      error.status,
    );
  }

  console.error("[e-track-api] Unhandled error:", error);
  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error.",
      },
    },
    500,
  );
}
