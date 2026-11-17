import type { Context } from "hono";

import { badRequest } from "./http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";

/// Reads a JSON object body and maps malformed payloads to a validation error.
export async function readBody(
  c: Context<AppEnv>,
): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // Fall through to the generic bad-request error below.
  }
  throw badRequest("A JSON request body is required.");
}
