import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.it.test.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-jwt-secret-de-al-menos-32-caracteres",
      INTERNAL_SERVICE_TOKEN: "test-internal-service-token-de-32-caracteres",
      RABBITMQ_URL: "amqp://127.0.0.1:1",
      USER_SERVICE_URL: "http://127.0.0.1:47123",
      RATE_LIMIT_MAX: "100000",
    },
  },
});
