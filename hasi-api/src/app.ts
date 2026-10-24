import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { registerErrorHandler } from "./errors.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";

export async function buildApp() {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
    logger: config.NODE_ENV === "test" ? false : {
      level: "info",
      redact: ["req.headers.authorization"],
    },
  });
  registerErrorHandler(app);
  await app.register(helmet);
  const origins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, { origin: origins.length ? origins : false, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  await app.register(rateLimit, { max: config.NODE_ENV === "test" ? 100000 : 300, timeWindow: "1 minute" });

  app.get("/health", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", db: "ok", time: new Date().toISOString() };
    } catch {
      return reply.status(503).send({ status: "degraded", db: "down" });
    }
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes);
  return app;
}
