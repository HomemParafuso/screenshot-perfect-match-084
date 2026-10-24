import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://hasi:hasi_test@localhost:55432/hasi_test",
      JWT_SECRET: "test-secret-test-secret-test-secret-123",
      BYOK_ENCRYPTION_KEY: "0".repeat(64),
      APP_RESET_URL: "http://localhost/reset-password",
    },
  },
});
