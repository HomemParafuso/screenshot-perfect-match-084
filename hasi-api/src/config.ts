import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  BYOK_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "BYOK_ENCRYPTION_KEY must be 32 bytes hex"),
  CORS_ORIGINS: z.string().default(""),
  APP_RESET_URL: z.string().url(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("HASi <no-reply@localhost>"),
  TRUST_PROXY: z.string().default("true").transform((v) => v === "true"),
});

export const config = schema.parse(process.env);
