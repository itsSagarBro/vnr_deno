import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, "VALIDATION_ERROR", details);
}

export function notImplemented(feature: string): HttpError {
  return new HttpError(
    501,
    `${feature} is not implemented yet.`,
    "NOT_IMPLEMENTED",
  );
}
