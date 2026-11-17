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

export function unauthorized(message: string, code = "UNAUTHORIZED"): HttpError {
  return new HttpError(401, message, code);
}

export function conflict(message: string, details?: unknown): HttpError {
  return new HttpError(409, message, "CONFLICT", details);
}

export function notFound(message: string, details?: unknown): HttpError {
  return new HttpError(404, message, "NOT_FOUND", details);
}

export function notImplemented(feature: string): HttpError {
  return new HttpError(
    501,
    `${feature} is not implemented yet.`,
    "NOT_IMPLEMENTED",
  );
}
