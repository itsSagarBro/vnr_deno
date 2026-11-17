import { Hono } from "hono";
import type { Context } from "hono";

import { requireAuth } from "../../middleware/auth.middleware.ts";
import { badRequest, conflict, unauthorized } from "../../shared/http/http-error.ts";
import type { AppEnv } from "../../types/app-env.ts";
import { signAccessToken } from "./auth.service.ts";
import { hashPassword, verifyPassword } from "./password.service.ts";
import { mongoUserService, type UserRecord, type UserService } from "./user.service.ts";

export interface AuthRouteOptions {
  jwtSecret: string;
  jwtExpiresIn?: string;
  userService?: UserService;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

async function readBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
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

function readEmail(body: Record<string, unknown>): string {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest("Enter a valid email address.", { field: "email" });
  }
  return email;
}

function readPassword(body: Record<string, unknown>): string {
  const password = body.password;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      { field: "password" },
    );
  }
  return password;
}

function readName(body: Record<string, unknown>): string | undefined {
  const raw = body.name ?? body.displayName;
  if (typeof raw !== "string") return undefined;
  const name = raw.trim();
  return name.length > 0 ? name : undefined;
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === 11000;
}

/// Email/password auth. The user store is injectable for route tests; the
/// default talks to MongoDB only when a request is handled.
export function authRoutes(options: AuthRouteOptions) {
  const router = new Hono<AppEnv>();
  const users = options.userService ?? mongoUserService;

  const issueToken = (user: UserRecord) =>
    signAccessToken(
      { sub: user.id, email: user.email },
      options.jwtSecret,
      options.jwtExpiresIn,
    );

  router.post("/register", async (c) => {
    const body = await readBody(c);
    const email = readEmail(body);
    const password = readPassword(body);
    const name = readName(body);

    if (await users.findByEmail(email)) {
      throw conflict("An account with this email already exists.", {
        field: "email",
      });
    }

    let user: UserRecord;
    try {
      user = await users.create({
        email,
        passwordHash: hashPassword(password),
        name,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict("An account with this email already exists.", {
          field: "email",
        });
      }
      throw error;
    }

    return c.json({ token: await issueToken(user), user: publicUser(user) }, 201);
  });

  router.post("/login", async (c) => {
    const body = await readBody(c);
    const email = readEmail(body);
    const password = readPassword(body);

    const user = await users.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    return c.json({ token: await issueToken(user), user: publicUser(user) });
  });

  /// Protected route used by the Flutter client to restore a session.
  router.get("/me", requireAuth(options.jwtSecret), (c) => {
    const claims = c.get("auth");
    return c.json({ id: claims.sub, email: claims.email });
  });

  return router;
}
