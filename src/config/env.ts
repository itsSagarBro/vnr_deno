import "@std/dotenv/load";

export interface EnvConfig {
  appName: string;
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string;
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function loadEnv(): EnvConfig {
  const jwtSecret = required("JWT_SECRET", Deno.env.get("JWT_SECRET"));
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  const port = Number(Deno.env.get("PORT") ?? "8000");
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer.");
  }

  return {
    appName: Deno.env.get("APP_NAME") ?? "E Track API",
    port,
    mongodbUri: required("MONGODB_URI", Deno.env.get("MONGODB_URI")),
    jwtSecret,
    jwtExpiresIn: Deno.env.get("JWT_EXPIRES_IN") ?? "24h",
    corsOrigin: Deno.env.get("CORS_ORIGIN") ?? "*",
  };
}
