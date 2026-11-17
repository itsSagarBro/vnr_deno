import { createApp } from "./src/app.ts";
import { loadEnv } from "./src/config/env.ts";
import { connectMongo, disconnectMongo } from "./src/db/mongo.ts";

const env = loadEnv();

await connectMongo(env.mongodbUri);

const app = createApp({
  jwtSecret: env.jwtSecret,
  jwtExpiresIn: env.jwtExpiresIn,
  corsOrigin: env.corsOrigin,
});

const server = Deno.serve(
  {
    port: env.port,
    onListen: ({ port }) =>
      console.log(`[e-track-api] ${env.appName} listening on http://localhost:${port}`),
  },
  app.fetch,
);

Deno.addSignalListener("SIGINT", async () => {
  console.log("[e-track-api] Shutting down...");
  await server.shutdown();
  await disconnectMongo();
  Deno.exit(0);
});
